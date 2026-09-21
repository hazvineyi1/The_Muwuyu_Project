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

// ── deleting a LINK, which is not the same act at all ──────────────────────
//
// "I want to be able to delete."
//
// A link could only ever be replaced until now. Whose child could move
// somebody from one marriage to another, and a marriage entered in error
// could not be undone at all — so a family who had joined the wrong two
// people had one honest option left, which was to set one of them aside and
// lose everything else about them with it.
//
// Deleting a link is the opposite of deleting a person, and the tests below
// are mostly about that difference: nobody leaves the tree, nothing about
// them is lost, and the next tap of Undo puts it back.

section('A MARRIAGE ENTERED BY MISTAKE CAN BE TAKEN OUT');
{
  const fe = loadFrontend();
  const him = fe.addPerson('Sydney Musoni', 'm', 'Mwendamberi', '1940', '');
  const her = fe.grow('partner', him, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1944' });
  const kid = fe.grow('child', him, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  const u = fe.unionsOf(him).find(x => x.partners.includes(her));

  eq('they are recorded as married', fe.kinTerms(him, her).list[0].term, 'Mukadzi');
  check('and it comes out', fe.unlinkPartner(u.id, her));
  check('she is no longer his wife',
        !(fe.kinTerms(him, her).list || []).some(t => t.term === 'Mukadzi'),
        JSON.stringify((fe.kinTerms(him, her).list || []).map(t => t.term)));

  section('but nobody has left the tree, which is the whole difference');
  const st = fe.getState();
  check('she is still a person', !!st.people[her]);
  eq('with her name',  st.people[her].name, 'Evelyn Mandaba');
  eq('her years',      st.people[her].born, '1944');
  eq('and her mutupo', st.people[her].totem, 'Moyondizvo');

  section('and the children of it stay with whoever is left');
  /* A mother and her children are not undone by her husband turning out to be
     the wrong man. The children were never the thing in doubt. */
  eq('his child is still his', fe.kinTerms(him, kid).list[0].term, 'Mwanakomana');
  eq('and still in the picture', !!fe.layoutOf().persons[kid], true);
}

section('AND IT IS THE PARTNER NAMED WHO STEPS OUT, not the card you are on');
/* The one that cost a rewrite. Standing on Sydney's card and saying the
   marriage to Evelyn is wrong has to take EVELYN out. Taking Sydney out of
   his own marriage instead leaves the children of it hanging off Evelyn
   alone, so a man correcting a claim about his wife loses his own son. */
{
  const fe = loadFrontend();
  const him = fe.addPerson('Sydney', 'm', 'Mwendamberi', '1940', '');
  const her = fe.grow('partner', him, 'Evelyn', 'f', 'Moyondizvo', { born:'1944' });
  const kid = fe.grow('child', him, 'Hazvineyi', 'm', 'Mwendamberi', { born:'1979' });
  const u = fe.unionsOf(him).find(x => x.partners.includes(her));

  fe.unlinkPartner(u.id, her);
  eq('the son is still his father\u2019s son',
     (fe.kinTerms(him, kid).list[0] || {}).term, 'Mwanakomana');
  check('and the marriage now holds the one partner it should',
        JSON.stringify(fe.getState().unions[u.id].partners) === JSON.stringify([him]),
        JSON.stringify(fe.getState().unions[u.id]));

  section('and the other way round is the fault, kept here so it cannot come back');
  const fe2 = loadFrontend();
  const h2 = fe2.addPerson('Sydney', 'm', 'Mwendamberi', '1940', '');
  const e2 = fe2.grow('partner', h2, 'Evelyn', 'f', 'Moyondizvo', { born:'1944' });
  const k2 = fe2.grow('child', h2, 'Hazvineyi', 'm', 'Mwendamberi', { born:'1979' });
  const u2 = fe2.unionsOf(h2).find(x => x.partners.includes(e2));
  fe2.unlinkPartner(u2.id, h2);
  eq('taking the wrong one out costs him the child',
     ((fe2.kinTerms(h2, k2) || {}).list || []).length, 0);
}

section('AND NOBODY DISAPPEARS FROM THE PICTURE BY BEING UNMARRIED');
/* The promise the whole feature rests on. Somebody left with no marriage and
   no parents recorded is a person on their own, and a person on their own is
   still drawn — otherwise "nobody leaves the tree" is only true of the data
   and false of the thing the family is looking at. */
{
  const fe = loadFrontend();
  const him = fe.addPerson('Sydney', 'm', 'Mwendamberi', '1940', '');
  const her = fe.grow('partner', him, 'Evelyn', 'f', 'Moyondizvo', { born:'1944' });
  fe.grow('child', him, 'Hazvineyi', 'm', 'Mwendamberi', { born:'1979' });
  const u = fe.unionsOf(him).find(x => x.partners.includes(her));
  fe.unlinkPartner(u.id, her);
  check('she is still drawn, standing on her own', !!fe.layoutOf().persons[her],
        Object.keys(fe.layoutOf().persons).length + ' drawn');
}

section('A CHILD HUNG ON THE WRONG PARENTS CAN BE TAKEN OFF THEM');
/* The case the Whose child panel could not reach: it only appeared when there
   was somewhere ELSE to move the child to, so a child hung on the only
   household in the tree — the commonest wrong answer there is — had no
   correction at all. */
{
  const fe = loadFrontend();
  const dad = fe.addPerson('Farai Musoni', 'm', 'Mwendamberi', '1930', '');
  const kid = fe.grow('child', dad, 'Not his', 'm', 'Shumba', { born:'1960' });

  eq('the tree says he is the father', fe.kinTerms(kid, dad).list[0].term, 'Baba');
  check('and that can be taken out', fe.unlinkParents(kid));
  check('he is nobody\u2019s child now',
        !(fe.kinTerms(kid, dad).list || []).some(t => t.term === 'Baba'),
        JSON.stringify((fe.kinTerms(kid, dad).list || []).map(t => t.term)));
  check('but he is still in the tree', !!fe.getState().people[kid]);
  check('and so is the man who is not his father', !!fe.getState().people[dad]);
}

section('TAKING A LINK OUT IS UNDOABLE, which is why it asks nothing first');
/* The delete-a-person below makes you type the name, because it destroys a
   record and cannot be taken back. A link is not a record. Guarding a
   reversible act with a modal teaches people to dismiss modals, which is what
   you want least on the one that isn't. */
{
  const fe = loadFrontend();
  const him = fe.addPerson('Sydney', 'm', 'Mwendamberi', '1940', '');
  const her = fe.grow('partner', him, 'Evelyn', 'f', 'Moyondizvo', { born:'1944' });
  const u = fe.unionsOf(him).find(x => x.partners.includes(her));
  const before = JSON.stringify(fe.getState().unions[u.id].partners);
  fe.unlinkPartner(u.id, her);
  check('the link is gone', !fe.getState().unions[u.id].partners.includes(her));
  fe.undo();
  eq('and one step back puts it exactly as it was',
     JSON.stringify(fe.getState().unions[u.id].partners), before);
}

section('AND IT REFUSES WHAT IS NOT THERE, rather than pretending');
{
  const fe = loadFrontend();
  const a = fe.addPerson('Alone', 'm', 'Mwendamberi', '1940', '');
  eq('somebody with no parents recorded cannot be taken off them',
     fe.unlinkParents(a), false);
  eq('and a marriage nobody is in is not a marriage to leave',
     fe.unlinkPartner('u-that-does-not-exist', a), false);
}

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
