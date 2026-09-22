// ONE SIDE OF THE FAMILY, AND WHERE IT STOPS.
//
// "I want to grow my mother's side of the family, Mandaba. I want to give that
//  family access to only grow that aspect without them seeing the full tree,
//  only limited to their part. If they should have a duplication, they are
//  told that that person is already added to the family tree and they are
//  through — whoever is available on their side to see. There should be ZERO
//  floating names."
//
// Until now this app had one wall, and it was the family: you are inside a
// tree or you are not, and inside it you see everything. That is right for one
// household and wrong for what a tree becomes after a year — two or three
// houses joined by marriages, where the Mandabas have every reason to record
// their own side and no business reading anybody else's.
//
// THE FAMILY THIS FILE USES, and it is the shape that makes the wall mean
// something:
//
//                Nhamo Mandaba ─── Ruth Chikwanha
//                        │
//         ┌──────────────┴──────────────┐
//     Evelyn Mandaba              Tendai Mandaba
//         │                             │
//    m. Sydney Musoni              m. Peter Moyo
//         │
//    Hazvineyi Musoni
//
//   and on the other side entirely, Sydney's own house:
//
//     Chaitezvi Musoni ─── (his other son) Baya Musoni
//
// The Mandaba branch is anchored on Evelyn. It reaches UP to Nhamo, DOWN
// through everybody below him — so Tendai, and Hazvineyi — and ACROSS to the
// husbands and wives of all of them, so Ruth, Sydney and Peter are in it.
//
// And it STOPS at Sydney. His father Chaitezvi and his brother Baya are his
// family's business. That one rule is the whole wall: without it "my mother's
// side" means "everybody my mother's side has ever married", which after two
// generations is the tree.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const { applyOps } = require('../db/ops');
const branch = require('../db/branch');
const express = require('express');
const http = require('http');

(async () => {
  const pool = await freshPool();

  const treeRoutes = require('../routes/tree');
  const familyRoutes = require('../routes/family');
  const app = express();
  app.use(express.json());
  let session = { id:'11111111-1111-1111-1111-111111111111', scope:'family',
                  treeId:null, personId:null, actor:'a relative', branchId:null };
  app.use((req, _res, next) => {
    req.muti = { session, scope:'family', treeId: session.treeId, actor: session.actor };
    next();
  });
  app.use(familyRoutes(pool));
  app.use('/api', treeRoutes(pool));
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const treeId = await newTree(pool, 'the Musoni family');
  session.treeId = treeId;

  const seed = await applyOps(pool, treeId, [
    // The Mandaba house.
    { op:'addPerson', ref:'$nhamo',  name:'Nhamo Mandaba',  sex:'m', totem:'Moyondizvo', born:'1925' },
    { op:'addPerson', ref:'$ruth',   name:'Ruth Chikwanha', sex:'f', totem:'Shumba', born:'1930' },
    { op:'addPerson', ref:'$evelyn', name:'Evelyn Mandaba', sex:'f', totem:'Moyondizvo', born:'1954' },
    { op:'addPerson', ref:'$tendai', name:'Tendai Mandaba', sex:'f', totem:'Moyondizvo', born:'1958' },
    { op:'addUnion', ref:'$nu' },
    { op:'addPartner', unionId:'$nu', personId:'$nhamo' },
    { op:'addPartner', unionId:'$nu', personId:'$ruth' },
    { op:'addChild', unionId:'$nu', personId:'$evelyn' },
    { op:'addChild', unionId:'$nu', personId:'$tendai' },
    { op:'addPerson', ref:'$farai', name:'Farai Mandaba', sex:'m', totem:'Moyondizvo', born:'1962' },
    { op:'addChild', unionId:'$nu', personId:'$farai' },

    // The Musoni house, which Evelyn married into.
    { op:'addPerson', ref:'$chai',   name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900' },
    { op:'addPerson', ref:'$sydney', name:'Sydney Musoni',    sex:'m', totem:'Mwendamberi', born:'1950' },
    { op:'addPerson', ref:'$baya',   name:'Baya Musoni',      sex:'m', totem:'Mwendamberi', born:'1948' },
    { op:'addUnion', ref:'$cu' },
    { op:'addPartner', unionId:'$cu', personId:'$chai' },
    { op:'addChild', unionId:'$cu', personId:'$sydney' },
    { op:'addChild', unionId:'$cu', personId:'$baya' },
    { op:'addPerson', ref:'$rati', name:'Ratidzo Musoni', sex:'f', totem:'Mwendamberi', born:'1962' },
    { op:'addChild', unionId:'$cu', personId:'$rati' },
    { op:'setRoot', personId:'$chai', root:true },

    // The marriage that joins the two houses, and the child of it.
    { op:'addPerson', ref:'$haz', name:'Hazvineyi Musoni', sex:'m', totem:'Mwendamberi', born:'1980' },
    { op:'addUnion', ref:'$su' },
    { op:'addPartner', unionId:'$su', personId:'$sydney' },
    { op:'addPartner', unionId:'$su', personId:'$evelyn' },
    { op:'addChild', unionId:'$su', personId:'$haz' },

    // And Tendai's own marriage, so the branch has a second married-in spouse.
    { op:'addPerson', ref:'$peter', name:'Peter Moyo', sex:'m', totem:'Nzou', born:'1955' },
    { op:'addUnion', ref:'$tu' },
    { op:'addPartner', unionId:'$tu', personId:'$tendai' },
    { op:'addPartner', unionId:'$tu', personId:'$peter' }
  ], 'the keeper');
  const id = k => seed.refs['$' + k];
  const nameOf = async who => (await pool.query(
    'SELECT name FROM people WHERE id = $1', [who])).rows[0]?.name;

  const go = async (path, opts = {}) => {
    const r = await fetch(base + path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type':'application/json' },
      ...(opts.json ? { body: JSON.stringify(opts.json) } : {}) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };

  // ───────────────────────────────────────────────────────────────────────
  section('WHO IS IN "MY MOTHER’S SIDE", ANCHORED ON HER');
  {
    const inside = await branch.membersOf(pool, treeId, id('evelyn'));
    const names = [];
    for (const who of inside) names.push(await nameOf(who));
    names.sort();
    eq('her house, the people who married into it, and nobody else', names, [
      'Evelyn Mandaba', 'Farai Mandaba', 'Hazvineyi Musoni', 'Nhamo Mandaba',
      'Peter Moyo', 'Ruth Chikwanha', 'Sydney Musoni', 'Tendai Mandaba'
    ]);
    check('her father is in, because the walk goes up', inside.has(id('nhamo')));
    check('her sister is in, because it then goes down again', inside.has(id('tendai')));
    check('her sister’s husband is in — a marriage cannot be half recorded',
          inside.has(id('peter')));
    check('her own husband is in for the same reason', inside.has(id('sydney')));
    check('AND HIS FATHER IS NOT — a husband is a wall, not a door',
          !inside.has(id('chai')));
    check('nor his brother', !inside.has(id('baya')));
  }

  section('and the marriages it may see are the ones it is wholly inside');
  {
    const inside = await branch.membersOf(pool, treeId, id('evelyn'));
    const unions = await branch.unionsOf(pool, treeId, inside);
    check('Nhamo and Ruth', unions.has(seed.refs['$nu']));
    check('Evelyn and Sydney, because both of them are in it', unions.has(seed.refs['$su']));
    check('Tendai and Peter', unions.has(seed.refs['$tu']));
    check('but NOT Chaitezvi and his sons — that union names two outsiders',
          !unions.has(seed.refs['$cu']));
  }

  // ───────────────────────────────────────────────────────────────────────
  section('THE KEEPER MAKES IT, AND IS SHOWN WHO WOULD BE IN IT BEFORE SHARING');
  let branchId = null;
  {
    const look = await go(`/api/branches/preview?anchorId=${id('evelyn')}`);
    eq('previewed', look.status, 200);
    eq('eight of the family', look.body.size, 8);
    eq('out of the eleven in it', look.body.family, 11);

    const made = await go('/api/branches', { method:'POST',
      json:{ anchorId: id('evelyn'), name:'the Mandaba side' } });
    eq('made', made.status, 201);
    branchId = made.body.id;
    eq('named in the family’s own words', made.body.name, 'the Mandaba side');
    check('and said back in people rather than a number',
          made.body.people.includes('Nhamo Mandaba'), JSON.stringify(made.body.people));
    check('never naming anybody outside it',
          !made.body.people.includes('Baya Musoni'), JSON.stringify(made.body.people));
  }

  // ───────────────────────────────────────────────────────────────────────
  section('AND A RELATIVE HOLDING IT SEES THAT AND ONLY THAT');
  const asMandaba = () => { session.branchId = branchId; session.personId = id('tendai'); };
  const asKeeper  = () => { session.branchId = null; session.personId = id('haz'); };
  {
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/tree`);
    eq('the tree came', status, 200);
    const names = body.people.map(p => p.name).sort();
    eq('eight people', names, [
      'Evelyn Mandaba', 'Farai Mandaba', 'Hazvineyi Musoni', 'Nhamo Mandaba',
      'Peter Moyo', 'Ruth Chikwanha', 'Sydney Musoni', 'Tendai Mandaba'
    ]);
    eq('and it says whose side it is', body.branch.name, 'the Mandaba side');
    check('no marriage points at anybody who was not sent', body.unions.every(u =>
      [...u.partners, ...u.children].every(x => body.people.some(p => p.id === x))),
      JSON.stringify(body.unions));
    eq('the family’s root is not handed over', body.rootId, null);
    eq('and the count is the count of their own side', body.total, 8);
  }

  section('the search will not find the other side either');
  {
    asMandaba();
    const mine = await go(`/api/tree/${treeId}/search?q=Mandaba`);
    check('their own names come back', mine.body.results.length > 0);
    const theirs = await go(`/api/tree/${treeId}/search?q=Baya`);
    eq('and nobody else’s', theirs.body.results, []);
  }

  section('nor may they say they are somebody on the other side');
  {
    asMandaba();
    session.personId = null;
    const { status, body } = await go('/api/me/person', { method:'POST',
      json:{ personId: id('baya') } });
    eq('refused', status, 403);
    check('in words rather than a shrug',
          /side of the family you were given/.test(body.message), body.message);
    const ok = await go('/api/me/person', { method:'POST', json:{ personId: id('tendai') } });
    /* Not 403. (Not 200 either, under this harness: identify writes to a real
       session row and this one is a stand-in. What is under test is the wall,
       and the wall lets their own side through.) */
    eq('but somebody on their own side is not refused for that', ok.status !== 403, true);
  }

  // ───────────────────────────────────────────────────────────────────────
  section('THEY MAY GROW THEIR OWN SIDE FREELY');
  {
    asMandaba();
    // Nhamo's own father — straight up the Mandaba line.
    const up = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$gf', name:'Garikai Mandaba', sex:'m', totem:'Moyondizvo', born:'1898' },
      { op:'addUnion', ref:'$gu' },
      { op:'addPartner', unionId:'$gu', personId:'$gf' },
      { op:'addChild', unionId:'$gu', personId: id('nhamo') }
    ] } });
    eq('a grandfather goes in', up.status, 200);

    // A sibling of Evelyn's that nobody had recorded.
    const across = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$b', name:'Rudo Mandaba', sex:'f', totem:'Moyondizvo', born:'1960' },
      { op:'addChild', unionId: seed.refs['$nu'], personId:'$b' }
    ] } });
    eq('and so does a sister', across.status, 200);

    // And Tendai's children.
    const down = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$k', name:'Anesu Moyo', sex:'f', totem:'Nzou', born:'1985' },
      { op:'addChild', unionId: seed.refs['$tu'], personId:'$k' }
    ] } });
    eq('and a niece', down.status, 200);

    const { body } = await go(`/api/tree/${treeId}/tree`);
    eq('all of them on their own side now', body.total, 11);
    check('including the grandfather they just added',
          body.people.some(p => p.name === 'Garikai Mandaba'));
  }

  section('AND MAY NOT TOUCH THE OTHER SIDE AT ALL');
  {
    asMandaba();
    const edit = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'updatePerson', id: id('baya'), born:'1949' }
    ] } });
    eq('editing somebody outside is refused', edit.status, 403);
    eq('with its own reason', edit.body.error, 'not_your_branch');
    check('which does not name who they reached for',
          !/Baya/.test(JSON.stringify(edit.body)), JSON.stringify(edit.body));

    const hang = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$x', name:'Somebody New', sex:'m' },
      { op:'addChild', unionId: seed.refs['$cu'], personId:'$x' }
    ] } });
    eq('and so is hanging a new name on their marriage', hang.status, 403);

    const { rows } = await pool.query(
      `SELECT born FROM people WHERE id = $1`, [id('baya')]);
    eq('nothing was changed', rows[0].born, '1948');
  }

  section('and reaching sideways through a marriage is the one thing closed');
  /* Peter Moyo is in the branch because he married Tendai, and his own
     parents are nobody's business here. Giving him a father would reach into
     the Moyo house through him, and that is exactly the door the wall is. */
  {
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$f', name:'Elias Moyo', sex:'m' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId:'$f' },
      { op:'addChild', unionId:'$u', personId: id('peter') }
    ] } });
    eq('refused', status, 403, JSON.stringify(body));
    eq('by the wall, not by anything else', body.error, 'not_your_branch');
    check('and says what to do instead',
          /from somebody on your own side/.test(body.message || ''), JSON.stringify(body));
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM people WHERE tree_id = $1 AND name = 'Elias Moyo'`,
      [treeId]);
    eq('and nothing at all was written', rows[0].n, 0);
  }

  // ───────────────────────────────────────────────────────────────────────
  section('IF THEY WRITE DOWN SOMEBODY WHO IS ALREADY HERE, THEY ARE TOLD');
  /* Baya Musoni is in the tree on the other side, where the Mandabas cannot
     see him. So when he marries their Tendai they write him down again —
     which is the commonest duplicate a family working behind a wall will make
     and the one they had no way of avoiding.

     WHERE THE APP IS CERTAIN, it folds the two, and the record that STAYS is
     the one that was already there. It gains the marriage they just recorded,
     which is what brings him into their view: they are told he was already
     here, and they are through to him. */
  {
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$b', name:'Baya Musoni', sex:'m', totem:'Mwendamberi', born:'1948' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId: id('tendai') },
      { op:'addPartner', unionId:'$u', personId:'$b' }
    ] } });
    eq('the write itself goes through', status, 200);
    eq('and the two were folded into one', (body.merged || []).length, 1);
    eq('the record already in the tree is the one that stayed',
       body.merged[0].keep.id, id('baya'));
    eq('and the copy they just typed is the one folded',
       body.merged[0].dropped.id !== id('baya'), true);
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM people
        WHERE tree_id = $1 AND name = 'Baya Musoni' AND aside_at IS NULL`, [treeId]);
    eq('so there is one Baya in the family, not two', rows[0].n, 1);

    /* AND THEY ARE THROUGH TO HIM. He is now married to a Mandaba, so he is
       on their side of the wall — which is the app telling the truth rather
       than making an exception: he IS their relative now. */
    const seen = await go(`/api/tree/${treeId}/tree`);
    check('he is on their side now, because he married into it',
          seen.body.people.some(p => p.id === id('baya')),
          JSON.stringify(seen.body.people.map(p => p.name)));
    check('and his own father is still not',
          !seen.body.people.some(p => p.name === 'Chaitezvi Musoni'),
          JSON.stringify(seen.body.people.map(p => p.name)));
  }

  section('and where it is not certain, they are simply told the name');
  /* Farai married Ratidzo Musoni. She is already in the tree, on the other
     side, as Chaitezvi's daughter — and nobody wrote down her birth year
     there, so the app is not certain and will not fold two women together on
     a guess about people it was told not to show anybody.

     Saying the name is enough to send somebody to ask an elder, which is how
     a family settles this anyway. The name is all they are told. */
  {
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$w', name:'Ratidzo Musoni', sex:'f', totem:'Mwendamberi' },
      { op:'addUnion', ref:'$fu' },
      { op:'addPartner', unionId:'$fu', personId: id('farai') },
      { op:'addPartner', unionId:'$fu', personId:'$w' }
    ] } });
    eq('the write goes through', status, 200);
    eq('nothing was folded on a guess', (body.merged || []).length, 0);
    check('and they are told she may already be in the family tree',
          /already in this family tree/.test(body.alreadyHereSaid || ''),
          JSON.stringify(body.alreadyHereSaid));
    check('by name', /Ratidzo Musoni/.test(body.alreadyHereSaid || ''),
          body.alreadyHereSaid);
    check('and told to ask somebody who can see the whole family',
          /can see the whole family/.test(body.alreadyHereSaid || ''),
          body.alreadyHereSaid);
    check('and nothing else about her — not whose child she is',
          !/Chaitezvi/.test(JSON.stringify(body.alreadyHere)),
          JSON.stringify(body.alreadyHere));
  }

  section('but a name on its own is never mentioned');
  /* Three living Garikais in one family is ordinary — children are named after
     their grandfathers. An app that announced every one of them would be
     reading the other side of the wall aloud, one common name at a time. */
  {
    asKeeper();
    await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$g', name:'Garikai Musoni', sex:'m' },
      { op:'addChild', unionId: seed.refs['$cu'], personId:'$g' }
    ], 'the keeper');
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$g2', name:'Garikai Musoni', sex:'m' },
      { op:'addUnion', ref:'$gu2' },
      { op:'addPartner', unionId:'$gu2', personId: id('tendai') },
      { op:'addPartner', unionId:'$gu2', personId:'$g2' }
    ] } });
    eq('it goes in', status, 200);
    eq('and nothing is said about the other Garikai', body.alreadyHere, undefined);
    eq('nor folded', (body.merged || []).length, 0);
  }

  section('AND ZERO FLOATING NAMES, HERE AS EVERYWHERE');
  {
    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/ops`, { method:'POST', json:{ ops:[
      { op:'addPerson', ref:'$x', name:'Nobody At All', sex:'m' }
    ] } });
    eq('a name joined to nothing is refused on a branch too', status, 422);
    eq('by the same rule', body.error, 'not_joined');
  }

  // ───────────────────────────────────────────────────────────────────────
  section('NOBODY GIVEN A SIDE CAN GIVE OUT A SIDE');
  {
    asMandaba();
    const made = await go('/api/branches', { method:'POST',
      json:{ anchorId: id('tendai'), name:'a slice of a slice' } });
    eq('refused', made.status, 403);
    const listed = await go('/api/branches');
    eq('and they cannot even read what has been shared', listed.status, 403);
    const shared = await go('/api/invites', { method:'POST',
      json:{ branchId } });
    eq('nor hand their own part on', shared.status, 403);
  }

  section('GIVING IT BACK STOPS IT AT ONCE');
  {
    asKeeper();
    const back = await go(`/api/branches/${branchId}/retire`, { method:'POST' });
    eq('given back', back.status, 200);
    check('and says so plainly', /no longer\s+shared/.test(back.body.message),
          back.body.message);

    asMandaba();
    const { status, body } = await go(`/api/tree/${treeId}/tree`);
    eq('the side stops opening', status, 403);
    check('with a reason somebody can act on',
          /no longer shared/.test(body.message || ''), body.message);
  }

  section('and the whole family still reads whole');
  {
    asKeeper();
    const { status, body } = await go(`/api/tree/${treeId}/tree`);
    eq('the keeper sees everybody', status, 200);
    check('including both houses',
          body.people.some(p => p.name === 'Baya Musoni') &&
          body.people.some(p => p.name === 'Nhamo Mandaba'));
    check('and a root, which a branch is never given', !!body.rootId);
  }

  await new Promise(r => server.close(r));
  await pool.end();
  report();
})().catch(e => { console.error(e); process.exit(1); });
