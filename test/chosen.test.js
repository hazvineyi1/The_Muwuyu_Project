// A passcode somebody chose.
//
// WHAT THIS FILE IS DEFENDING. A chosen passcode is a deliberate weakening —
// that is not a criticism of it, it is the reason it needs testing harder than
// the generated kind. A generated passcode is safe because of its entropy, so
// there is not much to get wrong. A chosen one is safe only because of the
// machinery around it, so every part of that machinery is asserted here:
//
//   * the hash is still a hash. The one thing that must never happen is a
//     chosen passcode being easier to STORE as well as easier to guess.
//   * the family can actually be found. A chosen passcode is also the handle,
//     and if the rename and the hash do not land together the family holds a
//     passcode whose handle no longer exists — locked out by the act meant to
//     let them in.
//   * nobody else is trampled. Taking a handle another family answers to
//     would lock THEM out, silently, to fix somebody else's problem.
//   * it is visible. The whole point of passcode_chosen is that a weak
//     passcode cannot be invisible to the keeper afterwards.
//   * it is reversible. "For now" has to mean for now.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const access = require('../db/access');

(async () => {
  const pool = await freshPool();
  const treeId = await newTree(pool, 'the Musoni family');
  const otherId = await newTree(pool, 'the Moyo family');

  // ── the shape of it ──────────────────────────────────────────────────────
  section('a passcode with no dash is its own handle');
  // This is the change that makes a one-word passcode possible at all. The
  // handle is the lookup key; with no dash, the whole word is the key.
  eq('a bare word looks itself up',
     access.splitPasscode('Musoni'), { handle: 'musoni', passcode: 'musoni' });
  eq('a generated one still splits at the first dash',
     access.splitPasscode('k7mpq3-w4ndra-pt9vbz').handle, 'k7mpq3');
  eq('a stray dash in the secret half does not move the handle',
     access.splitPasscode('k7mpq3-w4n-dra').handle, 'k7mpq3');

  section('and the things that are still not a passcode');
  eq('nothing', access.splitPasscode(''), null);
  eq('whitespace only', access.splitPasscode('   '), null);
  // A leading dash leaves an empty handle, which would look up every family
  // with handle = '' — that is not a sign-in, it is a query.
  eq('a leading dash', access.splitPasscode('-musoni'), null);

  // ── setting one ──────────────────────────────────────────────────────────
  section('the keeper can set a word, and the family can sign in with it');
  const before = await pool.query('SELECT handle FROM trees WHERE id = $1', [treeId]);
  const wasHandle = before.rows[0].handle;

  const set = await access.setPasscode(pool, treeId, 'Musoni', { by: 'keeper' });
  check('it was set', set.ok, JSON.stringify(set));
  eq('and is given back exactly once, normalised', set.passcode, 'musoni');
  eq('the handle moved to the word', set.handle, 'musoni');
  check('and the move is reported rather than done quietly',
        set.handleChanged === true && set.previousHandle === wasHandle,
        JSON.stringify({ changed: set.handleChanged, was: set.previousHandle }));

  section('IT IS STORED THE SAME WAY — a weak secret is not a stored secret');
  /* The one thing that would make this indefensible. A chosen passcode is
     easier to guess and that is the family's choice; it must not also be
     easier to READ, or a database that leaks hands over the word itself. */
  const row = await pool.query(
    'SELECT passcode_hash, passcode_chosen, passcode_gen FROM trees WHERE id = $1', [treeId]);
  check('still a scrypt hash', row.rows[0].passcode_hash.startsWith('scrypt$'),
        row.rows[0].passcode_hash.slice(0, 20));
  check('the word is nowhere in the stored value',
        !row.rows[0].passcode_hash.toLowerCase().includes('musoni'));
  check('and it verifies against that hash',
        await access.checkPasscode('musoni', row.rows[0].passcode_hash));

  section('sign-in finds the family by the word');
  const inOk = await access.signIn(pool, 'Musoni', { actor: 'Hazvineyi' });
  check('they are in', inOk.ok, JSON.stringify(inOk));
  eq('and it is their own tree', inOk.treeId, treeId);

  section('case and stray spaces do not lock anybody out');
  // Same reasoning as the generated kind: phone keyboards capitalise and add
  // a trailing space, and neither is part of what anybody chose.
  for (const typed of ['musoni', 'MUSONI', '  Musoni  ', 'MuSoNi']) {
    const r = await access.signIn(pool, typed, {});
    check(`"${typed}" opens it`, r.ok, JSON.stringify(r));
  }

  section('and a wrong word still does not');
  const wrong = await access.signIn(pool, 'musonii', {});
  check('refused', !wrong.ok, JSON.stringify(wrong));
  // 'musonii' is not a handle anybody holds, so this is the no_family path —
  // which must still cost a scrypt rather than answering instantly.
  eq('and says nothing about who exists', wrong.reason, 'no_family');

  // ── the old passcode ─────────────────────────────────────────────────────
  section('THE OLD PASSCODE STOPS WORKING, handle and all');
  const staleGen = await access.signIn(pool, `${wasHandle}-aaaaaa-bbbbbb`, {});
  check('a passcode under the old handle is refused', !staleGen.ok);
  eq('because that handle is nobody now', staleGen.reason, 'no_family');

  section('and every session opened under the old one is over');
  // Raising passcode_gen is what ends them. If the rename landed without the
  // generation moving, everyone signed in would stay signed in on a passcode
  // that no longer exists.
  check('the generation went up', row.rows[0].passcode_gen >= 1, row.rows[0].passcode_gen);

  // ── refusals ─────────────────────────────────────────────────────────────
  section('a word another family answers to is REFUSED, not taken');
  /* The failure this prevents is the ugly one: fixing one family's access by
     silently locking a different family out of theirs. */
  const takenSet = await access.setPasscode(pool, otherId, 'Musoni', { by: 'keeper' });
  check('refused', !takenSet.ok, JSON.stringify(takenSet));
  eq('and says why', takenSet.reason, 'handle_taken');

  const victim = await pool.query('SELECT handle FROM trees WHERE id = $1', [treeId]);
  eq('the first family still holds the handle', victim.rows[0].handle, 'musoni');
  const stillIn = await access.signIn(pool, 'musoni', {});
  check('and can still get in', stillIn.ok);
  eq('as themselves', stillIn.treeId, treeId);

  section('a word that could never be a handle is refused with a reason');
  for (const [word, why] of [['a', 'bad_handle'],            // too short
                             ['two words', 'bad_handle'],    // a space
                             ['mus@ni', 'bad_handle'],       // not a letter or digit
                             ['', 'empty']]) {
    const r = await access.setPasscode(pool, otherId, word, { by: 'keeper' });
    check(`"${word}" refused as ${why}`, !r.ok && r.reason === why, JSON.stringify(r));
  }

  section('a handle-prefixed passcode may have anything after the dash');
  // Only the FIRST part is the handle, so the secret half is unconstrained —
  // a family wanting a memorable phrase is not forced into one bare word.
  const phrase = await access.setPasscode(pool, otherId, 'moyo-two words!', { by: 'keeper' });
  check('set', phrase.ok, JSON.stringify(phrase));
  eq('the handle is only the first part', phrase.handle, 'moyo');
  const phraseIn = await access.signIn(pool, 'moyo-two words!', {});
  check('and it opens the tree', phraseIn.ok, JSON.stringify(phraseIn));
  eq('the right one', phraseIn.treeId, otherId);

  section('nothing was refused into a half-done state');
  // The rename and the hash are one transaction. A refusal must leave the
  // family exactly as it was, not renamed-but-unset.
  const beforeBad = await pool.query('SELECT handle, passcode_gen FROM trees WHERE id = $1', [otherId]);
  const bad = await access.setPasscode(pool, otherId, 'mus@ni', { by: 'keeper' });
  check('refused', !bad.ok);
  const afterBad = await pool.query('SELECT handle, passcode_gen FROM trees WHERE id = $1', [otherId]);
  eq('handle untouched', afterBad.rows[0].handle, beforeBad.rows[0].handle);
  eq('generation untouched', afterBad.rows[0].passcode_gen, beforeBad.rows[0].passcode_gen);

  // ── visible, and reversible ──────────────────────────────────────────────
  section('THE KEEPER CAN SEE THAT IT IS A WORD');
  /* A hash of "musoni" and a hash of 59 random bits are the same noise. If
     this flag were not recorded the keeper could never afterwards find out
     which families are protected by a guessable word. */
  check('flagged', row.rows[0].passcode_chosen === true);

  section('and issuing a generated one undoes it completely');
  const back = await access.issuePasscode(pool, treeId, { by: 'keeper' });
  check('the flag is cleared', back.passcode_chosen === false,
        JSON.stringify(back.passcode_chosen));
  check('the new passcode is the generated shape',
        back.passcode.startsWith(back.handle + '-') && back.passcode.split('-').length === 3,
        back.passcode);
  const wordGone = await access.signIn(pool, 'musoni', {});
  check('and the word no longer opens anything', !wordGone.ok, JSON.stringify(wordGone));
  // The handle stays 'musoni' — it is a name, not a secret, and moving it back
  // would break the passcode just issued.
  eq('the handle it was moved to is kept', back.handle, 'musoni');
  const backIn = await access.signIn(pool, back.passcode, {});
  check('the generated passcode works', backIn.ok, JSON.stringify(backIn));

  await pool.end();
  report();
})();
