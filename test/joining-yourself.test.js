// PUTTING YOURSELF IN THE TREE, JOINED TO SOMEBODY.
//
// "Do not allow someone to start a name that is not linked. If they access the
//  tree and they are not yet added, they should be instructed to search for a
//  name they directly link to like a parent or sibling or grandparent and link
//  themselves appropriately."
//
// WHAT WAS THERE. The who-are-you panel offered "Add me to the family", which
// asked for a name in a browser prompt() and posted a bare addPerson. One tap,
// and a name joined to nothing. The app's own front door was the biggest maker
// of the floating names this project spent a week learning to find.
//
// WHY THE SERVER DOES THE JOINING. A session that has not said who it is is
// given a roster of names and nothing else, on purpose: every word this app
// produces is reckoned from one person and it will not describe a family to
// nobody. So the page asking to be joined does not know who is married to whom
// and must not learn — handing it the marriages so it could compose the ops
// itself would give the whole family graph to a session that has not yet said
// it is anybody. It says one sentence and the server does the rest.
//
// THE RULE THIS FILE HOLDS: there is no way through this door that leaves a
// person joined to nothing. Not one.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const { applyOps } = require('../db/ops');
const express = require('express');
const http = require('http');

(async () => {
  const pool = await freshPool();

  // A small server with only the route under test, standing in for a session
  // that is signed into the family and has NOT said who it is.
  const treeRoutes = require('../routes/tree');
  const app = express();
  app.use(express.json());
  let session = { id:'11111111-1111-1111-1111-111111111111', scope:'family',
                  treeId:null, personId:null, actor:'a relative' };
  app.use((req, _res, next) => { req.muti = { session, scope:'family',
                                              treeId: session.treeId, actor: session.actor };
                                 next(); });
  app.use('/api', treeRoutes(pool));
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const treeId = await newTree(pool, 'the Musoni family');
  session.treeId = treeId;

  const seed = await applyOps(pool, treeId, [
    { op:'addPerson', ref:'$gf', name:'Chaitezvi Musoni', sex:'m', born:'1900' },
    { op:'addPerson', ref:'$dad', name:'Sydney Musoni', sex:'m', born:'1940' },
    { op:'addPerson', ref:'$mum', name:'Evelyn Mandaba', sex:'f', born:'1954' },
    { op:'addUnion', ref:'$gu' },
    { op:'addPartner', unionId:'$gu', personId:'$gf' },
    { op:'addChild', unionId:'$gu', personId:'$dad' },
    { op:'addUnion', ref:'$u' },
    { op:'addPartner', unionId:'$u', personId:'$dad' },
    { op:'addPartner', unionId:'$u', personId:'$mum' },
    { op:'addPerson', ref:'$kid', name:'Bertha Musoni', sex:'f', born:'1975' },
    { op:'addChild', unionId:'$u', personId:'$kid' }
  ], 'seed');
  const id = k => seed.refs['$' + k];

  const join = async body => {
    const r = await fetch(`${base}/api/tree/${treeId}/join-me`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  // Is this person joined to anybody at all?
  const joinedUp = async who => {
    const { rows } = await pool.query(
      `SELECT (SELECT count(*) FROM union_partners WHERE person_id = $1)::int AS asPartner,
              (SELECT count(*) FROM union_children WHERE person_id = $1)::int AS asChild`,
      [who]);
    return rows[0].aspartner > 0 || rows[0].aschild > 0;
  };
  const parentsOf = async who => {
    const { rows } = await pool.query(
      `SELECT p.name FROM union_children uc
         JOIN union_partners up ON up.union_id = uc.union_id
         JOIN people p ON p.id = up.person_id
        WHERE uc.person_id = $1 ORDER BY p.name`, [who]);
    return rows.map(r => r.name);
  };

  section('"SYDNEY IS MY FATHER" PUTS YOU UNDER SYDNEY');
  {
    const { status, body } = await join({ name:'Hazvineyi Musoni', sex:'m',
                                          to:id('dad'), as:'father' });
    eq('recorded', status, 201);
    check('and said back in words', /is recorded as Sydney Musoni's son/.test(body.recorded),
          body.recorded);
    check('joined to somebody', await joinedUp(body.id));
    eq('to both his parents, because that is the marriage with the children in it',
       await parentsOf(body.id), ['Evelyn Mandaba', 'Sydney Musoni']);
  }

  section('"BERTHA IS MY SISTER" PUTS YOU BESIDE HER, UNDER HER PARENTS');
  {
    const { status, body } = await join({ name:'Tendai Musoni', sex:'m',
                                          to:id('kid'), as:'sister' });
    eq('recorded', status, 201);
    eq('same mother and father', await parentsOf(body.id),
       ['Evelyn Mandaba', 'Sydney Musoni']);
  }

  section('"CHAITEZVI IS MY GRANDFATHER" ASKS WHO IS IN BETWEEN');
  /* A grandchild cannot hang off a grandparent — there is a mother or a father
     between them and the tree is wrong without her. Asking is the honest way
     to find out, not an obstacle. */
  {
    const { status, body } = await join({ name:'Rudo Musoni', sex:'f',
                                          to:id('gf'), as:'grandfather' });
    eq('refused, and not with a shrug', status, 400);
    check('it names what is missing and why',
          /between you and Chaitezvi Musoni/.test(body.message), body.message);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM people WHERE tree_id = $1 AND name = 'Rudo Musoni'`,
      [treeId]);
    eq('and nothing at all was written', rows[0].n, 0);
  }

  section('and with the one in between named, both go in together');
  {
    const { status, body } = await join({ name:'Rudo Musoni', sex:'f',
                                          to:id('gf'), as:'grandfather',
                                          via:{ name:'Nyarai Musoni', sex:'f' } });
    eq('recorded', status, 201);
    check('the mother in between was made too', !!body.via, JSON.stringify(body));
    eq('she is a child of the grandfather', await parentsOf(body.via), ['Chaitezvi Musoni']);
    eq('and the newcomer is a child of her', await parentsOf(body.id), ['Nyarai Musoni']);
    check('so nobody made is joined to nothing',
          await joinedUp(body.id) && await joinedUp(body.via));
  }

  section('"BERTHA IS MY DAUGHTER" IS REFUSED, BECAUSE SHE HAS BOTH PARENTS');
  /* The one-set-of-parents rule is structural in this database, so the answer
     has to be a sentence somebody can act on rather than a constraint error. */
  {
    const { status, body } = await join({ name:'Somebody Else', sex:'f',
                                          to:id('kid'), as:'daughter' });
    eq('refused', status, 409);
    check('and says which fact is in the way',
          /already has both parents recorded/.test(body.message), body.message);
    check('and what to do about it',
          /find yourself on the list/.test(body.message), body.message);
  }

  section('"SYDNEY IS MY HUSBAND" JOINS THE MARRIAGE AS A SECOND WIFE');
  /* Which this model has always allowed and this family's does happen. */
  {
    const { status, body } = await join({ name:'Rudo Chikwanha', sex:'f',
                                          to:id('dad'), as:'husband' });
    eq('recorded', status, 201);
    check('joined', await joinedUp(body.id));
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM union_partners up
         JOIN union_partners mine ON mine.union_id = up.union_id
        WHERE mine.person_id = $1 AND up.person_id = $2`, [body.id, id('dad')]);
    eq('to him', rows[0].n, 1);
  }

  section('NOTHING GETS THROUGH WITHOUT ALL THREE ANSWERS');
  {
    eq('no name', (await join({ sex:'f', to:id('dad'), as:'father' })).status, 400);
    eq('no relation', (await join({ name:'A Name', to:id('dad') })).status, 400);
    eq('a relation that is not one of the words',
       (await join({ name:'A Name', to:id('dad'), as:'cousin' })).status, 400);
    eq('nobody to join to',
       (await join({ name:'A Name', to:'11111111-1111-1111-1111-111111111111',
                     as:'father' })).status, 404);
  }

  section('AND AFTER ALL OF IT, NOT ONE FLOATING NAME IN THE TREE');
  /* The whole point. Every person this door has made is joined to somebody. */
  {
    const { rows } = await pool.query(
      `SELECT p.name FROM people p
        WHERE p.tree_id = $1 AND p.aside_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM union_partners up WHERE up.person_id = p.id)
          AND NOT EXISTS (SELECT 1 FROM union_children uc WHERE uc.person_id = p.id)`,
      [treeId]);
    eq('nobody joined to nothing', rows.map(r => r.name), []);
  }

  await new Promise(r => server.close(r));
  await pool.end();
  report();
})();
