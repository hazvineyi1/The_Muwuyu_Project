// The passcode on a deletion.
//
// "Deletion of a person should require a passcode. Edits can be made to dates
//  and relationships but deletions can only be done with the passcode."
//
// Two halves, and both are asserted here because either one alone is a bug.
// The gate has to HOLD — no code, a wrong code, or a thousand guesses must
// all leave the person in Postgres. And it has to LET GO — a family that has
// the passcode must still be able to correct a year, respell a name, record a
// marriage, set somebody aside and fold a duplicate away without being asked
// for anything at all. A gate that quietly gathers in the ordinary work of
// keeping a tree is the failure mode that would actually be shipped.

const { check, eq, rejects, section, freshPool, newTree, report } = require('./helpers');
const { applyOps } = require('../db/ops');
const passcode = require('../db/passcode');

const CODE = 'test-delete-code';

(async () => {
const pool = await freshPool();
const tree = await newTree(pool, 'passcode');

const run = (ops, opts) => applyOps(pool, tree, ops, 'tester', opts || {});
const withCode = ops => run(ops, { passcode: CODE, passKey: 'good' });

// A family to work on. Everybody branches from somebody — see db/joined.js.
const seeded = await withCode([
  { op:'addPerson', ref:'$gf',  name:'Chaitezvi Musoni', sex:'m', born:'1900' },
  { op:'addPerson', ref:'$dad', name:'Sydney Musoni',    sex:'m', born:'1938' },
  { op:'addPerson', ref:'$kid', name:'Bertha Musoni',    sex:'f', born:'1944' },
  { op:'addUnion',  ref:'$u' },
  { op:'addPartner', unionId:'$u', personId:'$gf' },
  { op:'addChild',   unionId:'$u', personId:'$dad' },
  { op:'addChild',   unionId:'$u', personId:'$kid' }
]);
const dad = seeded.refs.$dad, kid = seeded.refs.$kid;

const alive = async id => {
  const { rowCount } = await pool.query('SELECT 1 FROM people WHERE id = $1', [id]);
  return rowCount === 1;
};
/* Set aside first, always: that rule is older than this one and the gate must
   not be mistaken for it. See db/ops.js deletePerson. */
const setAside = async id => {
  await withCode([{ op:'setAside', id, why:'so the delete can be tried' }]);
};

section('WITHOUT THE PASSCODE, NOBODY IS REMOVED');
{
  passcode.forget();
  await setAside(kid);

  await rejects('a batch with no passcode at all is refused',
                () => run([{ op:'deletePerson', id:kid }], { passKey:'none' }),
                /passcode/i);
  eq('and they are still in Postgres', await alive(kid), true);

  await rejects('so is the wrong passcode',
                () => run([{ op:'deletePerson', id:kid }],
                          { passcode:'1234', passKey:'wrong-once' }),
                /not the passcode/i);
  eq('still there', await alive(kid), true);

  /* THE REST OF THE BATCH GOES WITH IT. The refusal happens before a single
     op runs, so an edit travelling alongside a delete is not half-applied —
     which is the difference between "that was refused" and "half of what I
     just did happened". */
  await rejects('a batch that edits AND deletes is refused whole',
                () => run([{ op:'updatePerson', id:dad, name:'Sydney Renamed' },
                           { op:'deletePerson', id:kid }], { passKey:'none' }),
                /passcode/i);
  const { rows } = await pool.query('SELECT name FROM people WHERE id = $1', [dad]);
  eq('and the edit in it did not happen either', rows[0].name, 'Sydney Musoni');
}

section('WITH IT, THEY ARE');
{
  passcode.forget();
  eq('still set aside from above', await alive(kid), true);
  const out = await withCode([{ op:'deletePerson', id:kid }]);
  eq('the op reports the person it removed', out.results[0].id, kid);
  eq('and they are gone from Postgres', await alive(kid), false);

  const { rows } = await pool.query(
    `SELECT payload FROM changes WHERE op = 'deletePerson' ORDER BY seq DESC LIMIT 1`);
  eq('with one line in the change log saying so', rows[0].payload.name, 'Bertha Musoni');
}

section('EVERY OTHER KIND OF CHANGE IS FREE');
{
  passcode.forget();
  /* The whole point of the rule is the line it draws. Each of these is the
     ordinary work of keeping a family tree and each goes through with no
     passcode anywhere near it. */
  await run([{ op:'updatePerson', id:dad, born:'1941' }], { passKey:'free' });
  const { rows: born } = await pool.query('SELECT born FROM people WHERE id = $1', [dad]);
  eq('a year can be corrected', born[0].born, '1941');

  await run([{ op:'updatePerson', id:dad, name:'Sydney T Musoni' }], { passKey:'free' });
  const { rows: nm } = await pool.query('SELECT name FROM people WHERE id = $1', [dad]);
  eq('a name can be respelled', nm[0].name, 'Sydney T Musoni');

  const made = await run([
    { op:'addPerson',  ref:'$w', name:'Evelyn Mandaba', sex:'f' },
    { op:'addUnion',   ref:'$m' },
    { op:'addPartner', unionId:'$m', personId:dad },
    { op:'addPartner', unionId:'$m', personId:'$w' }
  ], { passKey:'free' });
  const wife = made.refs.$w, marriage = made.refs.$m;
  check('a marriage can be recorded', !!wife && !!marriage, JSON.stringify(made.refs));

  await run([{ op:'removePartner', unionId:marriage, personId:wife }], { passKey:'free' });
  const { rowCount: still } = await pool.query(
    'SELECT 1 FROM union_partners WHERE person_id = $1', [wife]);
  eq('and undone', still, 0);

  await run([{ op:'setAside', id:wife, why:'entered by mistake' }], { passKey:'free' });
  const { rows: aside } = await pool.query(
    'SELECT aside_at FROM people WHERE id = $1', [wife]);
  check('somebody can be set aside without it', !!aside[0].aside_at, 'not set aside');

  await run([{ op:'restore', id:wife }], { passKey:'free' });
  const { rows: back } = await pool.query(
    'SELECT aside_at FROM people WHERE id = $1', [wife]);
  eq('and put back', back[0].aside_at, null);
}

section('MERGING TWO RECORDS OF ONE PERSON IS NOT A DELETION');
{
  passcode.forget();
  /* It takes a name off the screen and loses NOTHING — the folded record is
     set aside and pointed at the one that stayed, so it is reversible, which
     is exactly what a deletion is not. Gating it would leave the duplicates
     standing, which is the opposite of what was asked for. */
  const made = await run([
    { op:'addPerson', ref:'$a', name:'Tendai Musoni', sex:'m', born:'1968' },
    { op:'addPerson', ref:'$b', name:'Tendai Musoni', sex:'m', born:'1968' }
  ], { passKey:'free' });
  const a = made.refs.$a, b = made.refs.$b;

  await run([{ op:'mergePeople', keepId:a, mergeId:b }], { passKey:'free' });
  eq('no passcode was asked for', await alive(a), true);
  const { rows: folded } = await pool.query(
    'SELECT aside_at, merged_into FROM people WHERE id = $1', [b]);
  check('and the folded record was not deleted, only set aside',
        !!folded[0] && !!folded[0].aside_at, JSON.stringify(folded[0]));
  eq('pointed at the one that stayed', folded[0].merged_into, a);
}

section('GUESSING AT IT GETS SLOWER AND THEN STOPS');
{
  passcode.forget();
  const key = 'guesser';
  const now = Date.now();

  for (let i = 1; i <= passcode.FREE; i++){
    const said = passcode.check(key, 'nope', now);
    eq(`try ${i} of ${passcode.FREE} costs nothing`, said.waitMs, 0);
  }

  const fourth = passcode.check(key, 'nope', now);
  check('the next one starts a wait', fourth.waitMs > 0, String(fourth.waitMs));

  const tooSoon = passcode.check(key, CODE, now + 1);
  eq('and the right code is not even looked at while it lasts', tooSoon.reason, 'wait');

  const after = passcode.check(key, CODE, now + fourth.waitMs + 1);
  eq('once the wait is over, the right code works', after.ok, true);

  const fresh = passcode.check(key, 'nope', now + fourth.waitMs + 2);
  eq('and getting it right cleared the count', fresh.waitMs, 0);

  /* Doubling, not a fixed pause: ten thousand guesses at four digits is
     seconds at a fixed pause and weeks at this one. */
  passcode.forget(key);
  let at = now, last = 0;
  const growing = [];
  for (let i = 0; i < passcode.FREE + 4; i++){
    // each guess made the moment the previous wait runs out — which is the
    // fastest a patient attacker can go
    at += last;
    last = passcode.check(key, 'nope', at).waitMs;
    if (i >= passcode.FREE) growing.push(last);
  }
  check('each wait is longer than the last',
        growing.every((w, i) => i === 0 || w > growing[i - 1]), JSON.stringify(growing));
  check('and a wrong code is never just waved through while locked out',
        passcode.check(key, 'nope', at).reason === 'wait', 'it counted a guess during a wait');
}

section('A DEPLOYMENT WITH NO PASSCODE SET CANNOT DELETE AT ALL');
{
  /* Failing shut, deliberately. The worst a missing variable can do is make
     the family ask their keeper; the alternative is deletion quietly becoming
     free the moment somebody mislays an environment variable. */
  passcode.forget();
  const had = process.env.MW_DELETE_PASSCODE;
  delete process.env.MW_DELETE_PASSCODE;
  try {
    eq('the module says it has no code', passcode.set(), false);
    await setAsideUnset();
    await rejects('and every deletion is refused, right code or not',
                  () => run([{ op:'deletePerson', id:dad }],
                            { passcode:CODE, passKey:'unset' }),
                  /has not been given one/i);
    eq('the person is still there', await alive(dad), true);
  } finally {
    process.env.MW_DELETE_PASSCODE = had;
  }

  async function setAsideUnset(){
    // setAside is not gated, so it works with the variable removed.
    await run([{ op:'setAside', id:dad, why:'so the delete can be tried' }],
              { passKey:'unset' });
  }
}

await pool.end();
report();
})();
