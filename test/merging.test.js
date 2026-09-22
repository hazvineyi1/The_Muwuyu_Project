// WHEN NAMES ARE DUPLICATED, MERGE THEM.
//
// "When names are duplicated, merge them."
//
// Asked for twice, the second time after this project had argued against it.
// The argument is not abandoned — it decides where the line goes. Three living
// Garikais in one family is ordinary, because children are named after their
// grandfathers, and a tree that folds two of them together has destroyed a
// person rather than tidied a record.
//
// So only the pairs a family would not have to think about are folded:
//
//   (a) THE SHAPE SAYS SO — married to the same person, or the same child, or
//       the same mother and father, alike enough to clear the "very likely"
//       bar, and nothing at all against.
//   (b) ONE PERSON WRITTEN DOWN TWICE — the same name, the same birth year,
//       the same mutupo, and nothing against.
//
// "Nothing against" is doing most of the work and it is not a formality: a
// generation apart, married to different people, different children, different
// parents — any one of those and this refuses and leaves it for a person.
//
// AND EVERY ONE OF THEM CAN BE TAKEN BACK. That, and not the cleverness of the
// predicate, is what makes folding automatically defensible at all. The last
// half of this file is the undo, because an automatic act nobody can reverse
// is not a feature, it is a hazard.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const { applyOps } = require('../db/ops');
const duplicates = require('../db/duplicates');
const express = require('express');
const http = require('http');

(async () => {
  const pool = await freshPool();
  const app = express();
  app.use(express.json());
  let session = { id:'22222222-2222-2222-2222-222222222222', scope:'family',
                  treeId:null, personId:null, actor:'a relative' };
  app.use((req, _res, next) => { req.muti = { session, scope:'family',
                                              treeId:session.treeId, actor:session.actor };
                                 next(); });
  app.use('/api', require('../routes/tree')(pool));
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = async (treeId, ops) => {
    const r = await fetch(`${base}/api/tree/${treeId}/ops`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ops }) });
    return { status:r.status, body: await r.json().catch(() => ({})) };
  };
  const present = async id => {
    const { rows } = await pool.query('SELECT aside_at, merged_into FROM people WHERE id = $1', [id]);
    return rows.length ? !rows[0].aside_at : false;
  };
  const kidsOf = async who => {
    const { rows } = await pool.query(
      `SELECT p.name FROM union_partners up
         JOIN union_children uc ON uc.union_id = up.union_id
         JOIN people p ON p.id = uc.person_id
        WHERE up.person_id = $1 AND p.aside_at IS NULL ORDER BY p.name`, [who]);
    return rows.map(r => r.name);
  };

  // ── the case that was sent ───────────────────────────────────────────────
  section('THOMAS MUSONI, BORN 1971, ENTERED TWICE — FOLDED WITHOUT BEING ASKED');
  let treeId, first, second, kid;
  {
    treeId = await newTree(pool, 'the Musoni family');
    session.treeId = treeId;
    const seed = await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$gf', name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900' },
      { op:'addPerson', ref:'$t', name:'Thomas Musoni', sex:'m', totem:'Mwendamberi', born:'1971' },
      { op:'addUnion', ref:'$gu' },
      { op:'addPartner', unionId:'$gu', personId:'$gf' },
      { op:'addChild', unionId:'$gu', personId:'$t' }
    ], 'the first relative');
    first = seed.refs['$t'];

    // Somebody else, from a funeral programme, enters the same man and a child.
    const { status, body } = await post(treeId, [
      { op:'addPerson', ref:'$t2', name:'Thomas Musonza Musoni', sex:'m',
        totem:'Mwendamberi', born:'1971' },
      { op:'addPerson', ref:'$k', name:'Musekiwa Mupfunde', sex:'m', totem:'Mwendamberi', born:'2001' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId:'$t2' },
      { op:'addChild', unionId:'$u2', personId:'$k' }
    ]);
    second = body.refs['$t2'];
    kid = body.refs['$k'];

    eq('the write went through', status, 200);
    check('and the answer says what was folded', (body.merged || []).length === 1,
          JSON.stringify(body.merged));
    check('the record already in the tree is the one that stayed',
          await present(first), 'the older record was the one folded');
    check('and the copy just typed is the one folded', !(await present(second)));
    eq('his child is on his branch now', await kidsOf(first), ['Musekiwa Mupfunde']);
  }

  section('and the longer name the second relative had is not lost');
  {
    const { rows } = await pool.query('SELECT name FROM people WHERE id = $1', [first]);
    /* The merge fills the survivor's BLANK fields only, so the shorter name
       stands. What the copy carried that the survivor lacked came across; the
       copy itself is set aside and still readable. */
    eq('the survivor keeps the name the family had been using', rows[0].name, 'Thomas Musoni');
    const { rows: gone } = await pool.query(
      'SELECT name, aside_why FROM people WHERE id = $1', [second]);
    eq('and the other spelling is still there to read', gone[0].name, 'Thomas Musonza Musoni');
    check('with the reason, and that it was the app that did it',
          /automatically/.test(gone[0].aside_why), gone[0].aside_why);
    check('and that it can be undone', /can be undone/.test(gone[0].aside_why), gone[0].aside_why);
  }

  // ── the cases that must NOT be folded ────────────────────────────────────
  section('A MAN AND THE BOY NAMED AFTER HIM ARE LEFT ALONE');
  /* The whole reason this was argued against. Children are named after their
     grandfathers; this is the ordinary case, not the exception. */
  {
    const t2 = await newTree(pool, 'the Garikai family');
    session.treeId = t2;
    const seed = await applyOps(pool, t2, [
      { op:'addPerson', ref:'$old', name:'Garikai Moyo', sex:'m', totem:'Nzou', born:'1930' },
      { op:'addPerson', ref:'$mid', name:'Farai Moyo', sex:'m', totem:'Nzou', born:'1955' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId:'$old' },
      { op:'addChild', unionId:'$u', personId:'$mid' }
    ], 'seed');
    const { body } = await post(t2, [
      { op:'addPerson', ref:'$boy', name:'Garikai Moyo', sex:'m', totem:'Nzou', born:'1980' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId: seed.refs['$mid'] },
      { op:'addChild', unionId:'$u2', personId:'$boy' }
    ]);
    eq('nothing was folded', (body.merged || []).length, 0);
    check('both are still in the tree',
          await present(seed.refs['$old']) && await present(body.refs['$boy']));
  }

  section('and two of the same name born in different years are left alone');
  {
    const t3 = await newTree(pool, 'the Chikwanha family');
    session.treeId = t3;
    await applyOps(pool, t3, [
      { op:'addPerson', ref:'$a', name:'Tendai Chikwanha', sex:'f', totem:'Shumba', born:'1960' }
    ], 'seed');
    const { body } = await post(t3, [
      { op:'addPerson', ref:'$b', name:'Tendai Chikwanha', sex:'f', totem:'Shumba', born:'1988' }
    ]);
    eq('no fold', (body.merged || []).length, 0);
  }

  section('and two of the same name with no year at all are left alone');
  /* No year is not the same as the same year. A name and a mutupo is how half
     a village is described. */
  {
    const t4 = await newTree(pool, 'the Nyamhunga family');
    session.treeId = t4;
    await applyOps(pool, t4, [
      { op:'addPerson', ref:'$a', name:'Rudo Nyamhunga', sex:'f', totem:'Nzou' }
    ], 'seed');
    const { body } = await post(t4, [
      { op:'addPerson', ref:'$b', name:'Rudo Nyamhunga', sex:'f', totem:'Nzou' }
    ]);
    eq('no fold', (body.merged || []).length, 0);
  }

  section('and two sharing one name out of two are left alone');
  {
    const t5 = await newTree(pool, 'the Mupfunde family');
    session.treeId = t5;
    await applyOps(pool, t5, [
      { op:'addPerson', ref:'$a', name:'Tendai Mupfunde', sex:'m', totem:'Nzou', born:'1970' }
    ], 'seed');
    const { body } = await post(t5, [
      { op:'addPerson', ref:'$b', name:'Tendai Musoni', sex:'m', totem:'Nzou', born:'1970' }
    ]);
    eq('no fold', (body.merged || []).length, 0);
  }

  section('and a pair somebody has already said are two people stays two people');
  {
    const t6 = await newTree(pool, 'the Mandaba family');
    session.treeId = t6;
    const seed = await applyOps(pool, t6, [
      { op:'addPerson', ref:'$a', name:'Evelyn Mandaba', sex:'f', totem:'Moyondizvo', born:'1954' }
    ], 'seed');
    // Entered a second time, through the door that folds — and then the
    // family says no, these are two women.
    const made = await post(t6, [
      { op:'addPerson', ref:'$b', name:'Evelyn Mandaba', sex:'f', totem:'Moyondizvo', born:'1954' }
    ]);
    eq('folded on the way in', (made.body.merged || []).length, 1);
    await applyOps(pool, t6, [{ op:'splitPeople', id: made.body.refs['$b'] }], 'a relative');

    const { body } = await post(t6, [
      { op:'updatePerson', id: made.body.refs['$b'], born:'1954' }
    ]);
    eq('the app does not argue with them', (body.merged || []).length, 0);
    check('and both are still in the tree',
          await present(seed.refs['$a']) && await present(made.body.refs['$b']));
  }

  // ── the undo ─────────────────────────────────────────────────────────────
  section('A FOLD CAN BE TAKEN BACK, AND WHAT MOVED MOVES BACK');
  {
    session.treeId = treeId;
    const done = await applyOps(pool, treeId, [{ op:'splitPeople', id: second }], 'a relative');
    const r = done.results[done.results.length - 1];
    check('it knew what the merge had moved', r.hadRecord, JSON.stringify(r));
    check('the folded record is a person again', await present(second));
    eq('with his child back under him', await kidsOf(second), ['Musekiwa Mupfunde']);
    eq('and off the other record', await kidsOf(first), []);
  }

  section('and the app does not immediately fold them again');
  /* An undo that has to be repeated every few seconds is an argument, not an
     undo. */
  {
    const { body } = await post(treeId, [
      { op:'updatePerson', id: second, born:'1971' }
    ]);
    eq('no fold', (body.merged || []).length, 0);
    check('both still separate people', await present(first) && await present(second));
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM not_duplicates WHERE tree_id = $1', [treeId]);
    eq('because the disagreement was written down', rows[0].n, 1);
  }

  section('AND A SURVIVOR GIVES BACK WHAT IT ONLY EVER HAD FROM THE OTHER RECORD');
  /* A merge fills the survivor's blank fields from the record it folds. An
     undo that left them would leave the survivor wearing the other person's
     birth year for good. */
  {
    const t7 = await newTree(pool, 'the Musekiwa family');
    session.treeId = t7;
    const seed = await applyOps(pool, t7, [
      { op:'addPerson', ref:'$a', name:'Maxwell Mupfunde', sex:'m', totem:'Nzou', born:'1950' },
      { op:'addPerson', ref:'$partner', name:'Ruth Moyo', sex:'f', totem:'Shumba', born:'1955' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId:'$a' },
      { op:'addPartner', unionId:'$u', personId:'$partner' }
    ], 'seed');
    /* The same man again, in a SECOND marriage to the same woman — which is
       what two relatives recording one couple separately actually produces —
       carrying a death year the first record does not have. Two records
       married to one woman are one man, so the shape folds them.

       Not the same union: two people recorded in one marriage are each
       other's partners, and the scan will never read a husband and a wife as
       two copies of one person. */
    const { body } = await post(t7, [
      { op:'addPerson', ref:'$b', name:'Maxwell Mupfunde', sex:'m', totem:'Nzou',
        born:'1950', died:'2011' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId:'$b' },
      { op:'addPartner', unionId:'$u2', personId: seed.refs['$partner'] }
    ]);
    eq('the shape folded them', (body.merged || []).length, 1);
    const { rows } = await pool.query('SELECT died FROM people WHERE id = $1', [seed.refs['$a']]);
    eq('and the year of death came across', rows[0].died, '2011');

    await applyOps(pool, t7, [{ op:'splitPeople', id: body.refs['$b'] }], 'a relative');
    const { rows: after } = await pool.query('SELECT died FROM people WHERE id = $1', [seed.refs['$a']]);
    eq('and goes back when the fold does', after[0].died, '');
  }

  section('THE PREDICATE ITSELF, ON THE PAIRS THAT DECIDE IT');
  {
    const same = { name:'Thomas Musoni', born_year:1971, totem:'Mwendamberi' };
    const copy = { name:'Thomas Musonza Musoni', born_year:1971, totem:'Mwendamberi' };
    const clean = { score:0.6, against:[], strong:false };
    check('one person written down twice', duplicates.conclusive(same, copy, clean));
    check('but not with something against',
          !duplicates.conclusive(same, copy, { ...clean, against:['one generation apart'] }));
    check('nor with a different year',
          !duplicates.conclusive(same, { ...copy, born_year:1972 }, clean));
    check('nor with a different mutupo',
          !duplicates.conclusive(same, { ...copy, totem:'Nzou' }, clean));
    check('nor with no mutupo at all',
          !duplicates.conclusive(same, { ...copy, totem:'' }, clean));
    check('and never on a single shared name',
          !duplicates.conclusive({ name:'Thomas', born_year:1971, totem:'Nzou' },
                                 { name:'Thomas', born_year:1971, totem:'Nzou' }, clean));
    check('the shape, on its own, where it is strong and clean',
          duplicates.conclusive(same, { name:'Thomas Mutasa', born_year:null, totem:'' },
                                { score:0.8, against:[], strong:true }));
    check('but not a strong shape with something against',
          !duplicates.conclusive(same, { name:'Thomas Mutasa', born_year:null, totem:'' },
                                 { score:0.8, against:['different parents recorded'], strong:true }));
    check('and not on no match at all', !duplicates.conclusive(same, copy, null));
  }

  // ── and the page never lets it happen quietly ────────────────────────────
  const { loadFrontend } = require('./helpers');
  const fe = loadFrontend();
  const folded = [{
    keep: { id:'p1', name:'Thomas Musoni', born:'1971' },
    dropped: { id:'p9', name:'Thomas Musonza Musoni', born:'1971' },
    why: ['both called Thomas Musoni', 'both born 1971', 'same totem, Mwendamberi']
  }];

  section('THE TREE NEVER CHANGES SHAPE QUIETLY');
  /* An automatic act nobody can see and nobody can reverse is not a feature,
     it is a hazard. This is the half that makes the other half defensible. */
  {
    fe.addPerson('Thomas Musoni', 'm', 'Mwendamberi', '1971', '');
    fe.setAutoMerged(folded);
    const bar = fe.barNotices();
    check('the bar says it happened', /Two records made one/.test(bar), bar);
    check('and names who', /Thomas Musonza Musoni was already here/.test(bar), bar);
    check('and says nothing was deleted', /Nothing was deleted/.test(bar), bar);
    check('with the way to look at it', /id="mergedGo"/.test(bar), bar);
  }

  section('AND THE ROOM SHOWS WHAT IT ACTED ON');
  {
    fe.setAutoMerged(folded);
    const room = fe.mergedRoom();
    check('both names', /Thomas Musonza Musoni/.test(room) && /Thomas Musoni/.test(room), room);
    check('the evidence, in full',
          /both born 1971/.test(room) && /same totem, Mwendamberi/.test(room), room);
    check('that nothing was deleted', /still readable/.test(room), room);
    check('and the way back', /data-msplit=/.test(room), room);
  }

  section('and an empty one says nothing at all');
  {
    fe.setAutoMerged([]);
    eq('no room', fe.mergedRoom(), '');
    check('and no pill', !/Two records made one/.test(fe.barNotices()));
  }

  await new Promise(r => server.close(r));
  await pool.end();
  report();
})();
