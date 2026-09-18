// A passphrase the keeper chose.
//
// The keeper's door had one key and it lived in an environment variable, so
// changing it meant opening the hosting dashboard and waiting for a redeploy.
// The practical consequence of that is that nobody ever changes it — not when
// it has been read over a shoulder, not when a helper who had it stops
// helping, not when it was weak to begin with.
//
// What is asserted here is mostly what it REFUSES, because a way to change
// the admin passphrase is a way to take the admin pages away from their owner
// if any of these is wrong.

const { check, eq, section, report, freshPool } = require('./helpers');
const keeper = require('../db/keeper');
const access = require('../db/access');

(async () => {
  const pool = await freshPool();

  // ── nothing set ──────────────────────────────────────────────────────────
  section('a deployment that has never chosen one behaves as it always did');
  // The state every deployment is in until somebody sets one, so it is the
  // case that has to be certain.
  eq('none is set', await keeper.isSet(pool), false);
  eq('and nothing matches it', await keeper.check(pool, 'anything at all'), false);
  eq('not even an empty string', await keeper.check(pool, ''), false);

  // ── choosing one ─────────────────────────────────────────────────────────
  section('the keeper chooses one, and it opens the door');
  const done = await keeper.set(pool, 'the baobab at Chivhu', { by: 'Hazvineyi' });
  check('set', done.ok, JSON.stringify(done));
  eq('it is now set', await keeper.isSet(pool), true);
  check('and it checks out', await keeper.check(pool, 'the baobab at Chivhu'));

  section('IT IS A HASH, not a passphrase in a table');
  /* The rule this project holds everywhere: the database keeps enough to
     CHECK a secret and never enough to PRESENT one. If this is ever false,
     the keeper's key is readable by anyone who can read the database — which
     is the thing every other secret here is carefully not. */
  const row = await keeper.current(pool);
  check('stored as scrypt', row.passphrase_hash.startsWith('scrypt$'),
        row.passphrase_hash.slice(0, 20));
  check('the passphrase is nowhere in the stored value',
        !row.passphrase_hash.toLowerCase().includes('baobab'));
  check('and it verifies against the same checker family passcodes use',
        await access.checkPasscode('the baobab at Chivhu', row.passphrase_hash));

  section('a near miss is not a match');
  eq('one character out', await keeper.check(pool, 'the baobab at Chivh'), false);
  eq('nor the empty string', await keeper.check(pool, ''), false);

  section('whitespace at the ends is not part of anybody’s secret');
  // Phone keyboards add a trailing space. Same rule as family passcodes.
  check('a trailing space still opens it', await keeper.check(pool, 'the baobab at Chivhu '));

  section('but the passphrase is case-sensitive in neither direction more than a passcode is');
  // Documented rather than asserted as good or bad: it goes through the same
  // normalise() as every other secret here, so it lowercases. Stated so that
  // nobody later "fixes" it in one place and not the other.
  check('capitals do not lock the keeper out',
        await keeper.check(pool, 'The Baobab At Chivhu'));

  // ── refusals ─────────────────────────────────────────────────────────────
  section('A PASSPHRASE TOO SHORT IS REFUSED');
  /* A floor, not a grade. The failures below it are not judgement calls: an
     empty box or a four-letter slip against the door that fronts every family
     on this deployment is an open door, and whoever made the mistake would
     have no way of knowing. */
  for (const bad of ['', '   ', 'short', 'nineletr']) {
    const r = await keeper.set(pool, bad, { by: 'x' });
    check(`"${bad}" refused`, !r.ok, JSON.stringify(r));
  }
  check('and the old one still works after a refusal',
        await keeper.check(pool, 'the baobab at Chivhu'));

  section('exactly the minimum is allowed — a floor is a floor, not a preference');
  const atFloor = 'a'.repeat(keeper.MIN);
  check('accepted', (await keeper.set(pool, atFloor, {})).ok);
  check('and works', await keeper.check(pool, atFloor));

  // ── changing and giving up ───────────────────────────────────────────────
  section('changing it retires the one before');
  await keeper.set(pool, 'the second passphrase', { by: 'Hazvineyi' });
  check('the new one opens it', await keeper.check(pool, 'the second passphrase'));
  eq('the old one does not', await keeper.check(pool, atFloor), false);

  section('there is only ever one row, however many times it is set');
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM keeper');
  eq('one', rows[0].n, 1);

  section('and no history of old passphrases is kept');
  // A list of a person's previous secrets is a list of secrets they probably
  // still use somewhere else. There is no reason here that outweighs holding
  // it, so it is not held.
  const cols = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'keeper'`);
  const names = cols.rows.map(c => c.column_name).sort();
  eq('only what is needed to check one', names,
     ['id', 'passphrase_hash', 'set_at', 'set_by']);

  section('giving it up leaves the environment’s key as the only one');
  await keeper.clear(pool);
  eq('none is set', await keeper.isSet(pool), false);
  eq('and the last one no longer opens anything',
     await keeper.check(pool, 'the second passphrase'), false);

  section('clearing twice is not an error');
  check('still fine', (await keeper.clear(pool)).ok);

  await pool.end();
  report();
})();
