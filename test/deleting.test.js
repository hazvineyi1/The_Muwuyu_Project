// Taking somebody out of the tree for good.
//
// THE RULE THIS CHANGES. Everything in this project used to say "there is no
// delete", and that was the right default: a tree is filled in by many people
// over years, the ordinary case is one relative doubting another's entry, and
// if a doubt could destroy a record the cost of being wrong would fall
// entirely on whoever knew the most.
//
// But a family that entered a person by mistake — the same grandmother typed
// twice, a name from the wrong household, somebody who asked not to be in it
// — is entitled to have that gone rather than merely hidden. So the delete
// exists, and nearly everything asserted here is about it being the second
// half of a deliberate act rather than the first half of an accident.

const { check, eq, rejects, section, freshPool, newTree, report, loadFrontend } = require('./helpers');
const { applyOps } = require('../db/ops');

(async () => {

// ── in the page ────────────────────────────────────────────────────────────
section('SET ASIDE FIRST, ALWAYS');
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const kid = fe.grow('child', gf, 'Child', 'm', 'Mwendamberi', { born:'1960' });

  eq('somebody still in the tree cannot be deleted', fe.deleteForever(kid), false);
  check('and they are still there', !!fe.getState().people[kid]);

  fe.setAside(kid, 'entered twice');
  eq('once they are aside, they can', fe.deleteForever(kid), true);
  check('and now they are not', !fe.getState().people[kid]);
}

section('their place in every marriage goes with them');
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const kid = fe.grow('child', gf, 'Child', 'm', 'Mwendamberi', { born:'1960' });
  const wife = fe.grow('partner', kid, 'Wife', 'f', 'Shava', { born:'1962' });
  fe.setAside(wife, 'wrong household');
  fe.deleteForever(wife);

  const unions = Object.values(fe.getState().unions);
  check('nobody is left pointing at them',
        unions.every(u => !u.partners.includes(wife) && !u.children.includes(wife)),
        JSON.stringify(unions));
}

section('a marriage left with nobody in it goes too');
// That is not a marriage, it is the hole where a person used to be.
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  const b = fe.grow('partner', a, 'B', 'f', 'Shava', { born:'1942' });
  eq('one marriage', Object.keys(fe.getState().unions).length, 1);
  fe.setAside(a, 'x'); fe.deleteForever(a);
  fe.setAside(b, 'x'); fe.deleteForever(b);
  eq('and none once both are gone', Object.keys(fe.getState().unions).length, 0);
}

section('but a marriage that still holds somebody else is kept');
/* It is that person's record as much as it was the deleted one's. Removing it
   would delete a fact about somebody nobody asked about. */
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const kid = fe.grow('child', gf, 'Child', 'm', 'Mwendamberi', { born:'1960' });
  fe.setAside(kid, 'x');
  fe.deleteForever(kid);
  const u = Object.values(fe.getState().unions);
  check('the grandfather still has his marriage',
        u.some(x => x.partners.includes(gf)), JSON.stringify(u));
}

section('the tree keeps an anchor rather than pointing at nobody');
/* state.rootId is where the picture is centred from — a different thing from
   the "root of the line" badge toggleRoot puts on a person. It must not go on
   naming somebody who has been deleted, the same guard setAside already has. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  const b = fe.addPerson('B', 'm', 'Mwendamberi', '1945', '');
  fe.getState().rootId = a;
  fe.setAside(a, 'x');
  fe.deleteForever(a);
  check('the anchor moved to somebody still here',
        fe.getState().rootId === b, String(fe.getState().rootId));
}

section("and the badge on the person goes with the person");
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  fe.toggleRoot(a);
  check('the badge is on them', fe.getState().people[a].root === true);
  fe.setAside(a, 'x');
  fe.deleteForever(a);
  check('and is gone with them, claiming nothing', !fe.getState().people[a]);
}

section('undo still works until the page saves');
// snapshot() runs first, so this is as reversible as anything else in the
// page right up to the moment it syncs. The button says so.
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  fe.setAside(a, 'x');
  fe.deleteForever(a);
  check('gone', !fe.getState().people[a]);
  check('undo brings them back', fe.undo());
  check('and there they are', !!fe.getState().people[a]);
}

section('and the sync says so, because silence used to mean a bug');
/* A record missing from `now` but present in `was` could previously only mean
   corrupted state, so diffOps said nothing. Now the absence is deliberate and
   has to be spoken. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  const synced = JSON.parse(JSON.stringify(fe.getState()));
  for (const p of Object.values(synced.people)) p.v = 1;
  fe.setAside(a, 'x');
  fe.deleteForever(a);
  const ops = fe.diffOps(synced, fe.getState());
  const del = ops.filter(o => o.op === 'deletePerson');
  eq('one delete op', del.length, 1);
  eq('naming them', del[0].id, a);
  check('and carrying the version it expects', del[0].expect === 1, JSON.stringify(del[0]));
}

// ── on the server ──────────────────────────────────────────────────────────
const pool = await freshPool();
const tree = await newTree(pool, 'deleting');
const run = (o, actor) => applyOps(pool, tree, o, actor || 'tester');

section('THE SERVER REFUSES IT TOO, not only the page');
/* The page's guard is a courtesy; this is the one that matters, because any
   client at all can post ops. */
{
  const r = await run([{ op:'addPerson', ref:'$p', name:'Still here', sex:'m' }]);
  const id = r.refs.$p;
  await rejects('deleting somebody who is not set aside',
                () => run([{ op:'deletePerson', id }]), /set them aside first/i);

  const { rows } = await pool.query('SELECT count(*)::int AS n FROM people WHERE id = $1', [id]);
  eq('and they are untouched', rows[0].n, 1);
}

section('once set aside, they go — and so does their place in a marriage');
{
  const r = await run([
    { op:'addPerson', ref:'$dad', name:'Dad', sex:'m' },
    { op:'addPerson', ref:'$kid', name:'Kid', sex:'m' },
    { op:'addUnion', ref:'$u' },
    { op:'addPartner', unionId:'$u', personId:'$dad' },
    { op:'addChild', unionId:'$u', personId:'$kid' }
  ]);
  const dad = r.refs.$dad, kid = r.refs.$kid;

  await run([{ op:'setAside', id:kid, why:'entered twice' }]);
  const out = await run([{ op:'deletePerson', id:kid }]);
  check('the batch succeeded', !!out.seq, JSON.stringify(out));

  const gone = await pool.query('SELECT count(*)::int AS n FROM people WHERE id = $1', [kid]);
  eq('the person is gone', gone.rows[0].n, 0);
  const link = await pool.query(
    'SELECT count(*)::int AS n FROM union_children WHERE person_id = $1', [kid]);
  eq('and so is their place in the marriage', link.rows[0].n, 0);
  const dadLeft = await pool.query('SELECT count(*)::int AS n FROM people WHERE id = $1', [dad]);
  eq('their father is untouched', dadLeft.rows[0].n, 1);
}

section('it is written in the change log, which is the only trace left');
/* Deliberate. The family's own log is how they find out why somebody is no
   longer in the tree, and a deletion that left no account of itself would be
   indistinguishable from a bug. */
{
  const { rows } = await pool.query(
    `SELECT op, payload FROM changes WHERE op = 'deletePerson' ORDER BY seq DESC LIMIT 1`);
  eq('one line', rows.length, 1);
  eq('naming who it was', rows[0].payload.name, 'Kid');
  check('and why they had been set aside',
        rows[0].payload.wasAsideWhy === 'entered twice', JSON.stringify(rows[0].payload));
}

section('a marriage emptied by the deletion is removed');
{
  const r = await run([
    { op:'addPerson', ref:'$a', name:'Alone', sex:'m' },
    { op:'addUnion', ref:'$u' },
    { op:'addPartner', unionId:'$u', personId:'$a' }
  ]);
  const a = r.refs.$a, u = r.refs.$u;
  await run([{ op:'setAside', id:a, why:'x' }]);
  const out = await run([{ op:'deletePerson', id:a }]);
  eq('it says it removed one', out.results[out.results.length - 1].unionsRemoved, 1);
  const left = await pool.query('SELECT count(*)::int AS n FROM unions WHERE id = $1', [u]);
  eq('and it is gone', left.rows[0].n, 0);
}

section('deleting somebody who is already gone is refused, not silently ignored');
// Two people deleting the same record at once must not both be told it worked.
{
  const r = await run([{ op:'addPerson', ref:'$p', name:'Twice', sex:'m' }]);
  const id = r.refs.$p;
  await run([{ op:'setAside', id, why:'x' }]);
  await run([{ op:'deletePerson', id }]);
  await rejects('the second attempt', () => run([{ op:'deletePerson', id }]), /./);
}

await pool.end();
report();
})();
