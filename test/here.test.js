// WHO ELSE OF THE FAMILY HAS THE TREE OPEN.
//
// "...intuitive, cohesive and collaborative."
//
// The project already keeps what the others have DONE: every change, with who
// made it, for good. This is the other half of working together, and it is
// much smaller — whether anybody else is there at all. Two relatives filling
// in the same branch from two countries have had no way of knowing they were
// both at it.
//
// THE WHOLE OF THIS TEST IS THE BOUNDARY. liveSessions() is read by the
// KEEPER, who stands outside every family and is told only THAT a session
// said who is viewing, never who. whoIsHere() is read from inside ONE family,
// by somebody holding that family's passcode who can already see every name
// in the tree. The name it gives is one the session gave about itself, about
// a person the caller can already read off the screen.
//
// So what has to hold is: this family's sessions and no other family's; the
// caller's own session left out; a session that never said who it is counted
// and not named; and one relative on a phone and a laptop counted once.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const access = require('../db/access');

(async () => {
  const pool = await freshPool();
  const treeId = await newTree(pool, 'the Musoni family');
  const otherTree = await newTree(pool, 'the Moyo family');

  const person = async (tree, name) => {
    const { rows } = await pool.query(
      'INSERT INTO people (tree_id, name) VALUES ($1, $2) RETURNING id', [tree, name]);
    return rows[0].id;
  };
  const bertha = await person(treeId, 'Bertha Musoni');
  const evelyn = await person(treeId, 'Evelyn Mandaba');
  const sydney = await person(treeId, 'Sydney Musoni');
  const stranger = await person(otherTree, 'Somebody Moyo');

  const sess = (tree, personId) => access.createSession(pool, {
    scope: 'family', treeId: tree, via: 'passcode', personId, personVia: 'self'
  });

  section('THE FAMILY IS TOLD WHO OF THEM IS HERE');
  {
    const mine = await sess(treeId, sydney);
    await sess(treeId, bertha);
    await sess(treeId, evelyn);
    const { here, unnamed } = await access.whoIsHere(pool, treeId, { exceptSessionId: mine.id });
    eq('the others, by name', here.map(h => h.name).sort(),
       ['Bertha Musoni', 'Evelyn Mandaba']);
    eq('and nobody unaccounted for', unnamed, 0);
    check('you are not told that you are here',
          !here.some(h => h.id === sydney), JSON.stringify(here));
  }

  section('AND NEVER ANOTHER FAMILY’S');
  {
    await sess(otherTree, stranger);
    const { here } = await access.whoIsHere(pool, treeId, {});
    check('the other family is not in this answer',
          !here.some(h => h.name === 'Somebody Moyo'), JSON.stringify(here));
    const theirs = await access.whoIsHere(pool, otherTree, {});
    eq('and they are told about their own', theirs.here.map(h => h.name), ['Somebody Moyo']);
    check('and not about ours',
          !theirs.here.some(h => /Musoni|Mandaba/.test(h.name)), JSON.stringify(theirs.here));
  }

  section('SOMEBODY WHO HAS NOT SAID WHO THEY ARE IS COUNTED, NOT NAMED');
  /* There is no name to give. Counting them is the truth; inventing one, or
     leaving them out so the count reads low, are both worse. */
  {
    const quiet = await newTree(pool, 'the Chikwanha family');
    const a = await person(quiet, 'Tendai Chikwanha');
    await sess(quiet, a);
    await sess(quiet, null);
    await sess(quiet, null);
    const { here, unnamed } = await access.whoIsHere(pool, quiet, {});
    eq('one named', here.map(h => h.name), ['Tendai Chikwanha']);
    eq('and two counted', unnamed, 2);
  }

  section('ONE RELATIVE ON TWO DEVICES IS ONE RELATIVE');
  {
    const twice = await newTree(pool, 'the Nyamhunga family');
    const a = await person(twice, 'Rudo Nyamhunga');
    await sess(twice, a);
    await sess(twice, a);
    await sess(twice, a);
    const { here } = await access.whoIsHere(pool, twice, {});
    eq('counted once', here.length, 1);
    eq('and it is her', here[0].name, 'Rudo Nyamhunga');
  }

  section('SOMEBODY WHO HAS GONE IS NOT STILL HERE');
  {
    const gone = await newTree(pool, 'the Mupfunde family');
    const a = await person(gone, 'Maxwell Mupfunde');
    const b = await person(gone, 'Musekiwa Mupfunde');
    const old = await sess(gone, a);
    await sess(gone, b);
    await pool.query(
      `UPDATE sessions SET last_seen_at = clock_timestamp() - interval '2 hours'
        WHERE id = $1`, [old.id]);
    const { here } = await access.whoIsHere(pool, gone, {});
    eq('only the one still reading', here.map(h => h.name), ['Musekiwa Mupfunde']);
  }

  section('and a session that was signed out is not here either');
  {
    const out = await newTree(pool, 'the Mandaba family');
    const a = await person(out, 'Evelyn Mandaba');
    const s = await sess(out, a);
    await pool.query(`UPDATE sessions SET revoked_at = clock_timestamp() WHERE id = $1`, [s.id]);
    const { here, unnamed } = await access.whoIsHere(pool, out, {});
    eq('nobody named', here, []);
    eq('and nobody counted', unnamed, 0);
  }

  section('THE KEEPER’S VIEW IS STILL NAMELESS');
  /* The line that must not move. If liveSessions ever starts carrying names,
     every family's names are on a dashboard outside every family. */
  {
    const rows = await access.liveSessions(pool, { treeId });
    check('the keeper is given sessions', rows.length > 0);
    check('with no name among them',
          !rows.some(r => 'name' in r || 'person_name' in r), Object.keys(rows[0]).join(','));
    check('only whether the question was answered',
          rows.every(r => typeof r.identified === 'boolean'), Object.keys(rows[0]).join(','));
  }

  // ── and the line the family actually reads ───────────────────────────────
  const { loadFrontend } = require('./helpers');
  const fe = loadFrontend();
  const words = d => fe.hereWords(d);

  section('AND IT IS SAID IN A LINE, NOT A COUNT');
  {
    eq('one relative', words({ here:[{ name:'Bertha Musoni' }], unnamed:0 }),
       'Bertha Musoni has the tree open too.');
    eq('two', words({ here:[{ name:'Bertha Musoni' }, { name:'Evelyn Mandaba' }], unnamed:0 }),
       'Bertha Musoni and Evelyn Mandaba have the tree open too.');
    eq('three, with the comma where a person would put it',
       words({ here:[{ name:'A' }, { name:'B' }, { name:'C' }], unnamed:0 }),
       'A, B and C have the tree open too.');
  }

  section('the ones who have not said who they are are said as that');
  /* Not dropped, because the count would then read low, and not invented a
     name for. They are here; who they are is not known. */
  {
    eq('nobody named at all', words({ here:[], unnamed:1 }),
       'Somebody else has the tree open. They have not said who they are.');
    eq('several', words({ here:[], unnamed:3 }),
       '3 others have the tree open. They have not said who they are.');
    eq('and alongside somebody named',
       words({ here:[{ name:'Bertha Musoni' }], unnamed:1 }),
       'Bertha Musoni has the tree open too. So does somebody who has not said who they are.');
  }

  section('AND AN EMPTY ANSWER SAYS NOTHING AT ALL');
  /* Reading a family tree by yourself is the ordinary case, and being told so
     every time is the kind of line that gets a panel closed. */
  {
    eq('nobody here', words({ here:[], unnamed:0 }), '');
    eq('and no answer at all', words(null), '');
    eq('and a broken one', words({}), '');
  }

  await pool.end();
  report();
})();
