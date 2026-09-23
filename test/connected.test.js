// NOBODY GOES IN ON THEIR OWN.
//
// "To be added to the tree you need to be connected to somebody. You have to
//  pick someone who you know to be in the tree and connect from them."
//
// The page has refused loose names for a while: the welcome field takes one
// name and only while the tree is empty, every bud grows off somebody, and the
// front door asks a newcomer for one relative before it writes anything down.
//
// All three of those live in a browser, and this project's own comment on the
// welcome field says why that is not enough: "a rule enforced only by what is
// on screen is not enforced". The write endpoint took a bare addPerson from
// anybody who asked, which is how a family ends up needing a room for finding
// adrift names.
//
// So the rule is kept at the door. This file is the door being tried.

const { check, eq, section, report, freshPool, newTree } = require('./helpers');
const { applyOps } = require('../db/ops');
const express = require('express');
const http = require('http');

(async () => {
  const pool = await freshPool();

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

  const post = async (treeId, ops) => {
    const r = await fetch(`${base}/api/tree/${treeId}/ops`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ops }) });
    return { status:r.status, body: await r.json().catch(() => ({})) };
  };
  const heads = async treeId => {
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM people WHERE tree_id = $1 AND aside_at IS NULL',
      [treeId]);
    return rows[0].n;
  };

  // A family to grow from.
  const family = async () => {
    const treeId = await newTree(pool, 'the Musoni family');
    session.treeId = treeId;
    const seed = await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$gf', name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900' },
      { op:'addPerson', ref:'$t',  name:'Thomas Musoni',    sex:'m', totem:'Mwendamberi', born:'1971' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId:'$gf' },
      { op:'addChild',   unionId:'$u', personId:'$t' }
    ], 'the first relative');
    return { treeId, gf: seed.refs['$gf'], t: seed.refs['$t'], u: seed.refs['$u'] };
  };

  section('A NAME JOINED TO NOTHING IS REFUSED AT THE DOOR');
  {
    const { treeId } = await family();
    const { status, body } = await post(treeId, [
      { op:'addPerson', ref:'$loose', name:'Nyarai Moyo', sex:'f' }
    ]);
    eq('refused', status, 422);
    eq('and says which rule', body.error, 'not_joined');
    check('in words a family would use',
          /connected to somebody|joined to somebody/i.test(body.message || ''), body.message);
    check('naming who it was about', /Nyarai Moyo/.test(body.message || ''), body.message);
    check('and saying what to do instead',
          /pick the relative/i.test(body.message || ''), body.message);
    eq('and the tree is exactly as it was', await heads(treeId), 2);
  }

  section('and the refusal takes the whole batch with it');
  /* All or nothing is the whole guarantee. A batch half-applied would leave a
     family with a marriage recorded and the wedding missing. */
  {
    const { treeId, t } = await family();
    const { status } = await post(treeId, [
      { op:'updatePerson', id: t, born:'1972' },
      { op:'addPerson', ref:'$loose', name:'Nyarai Moyo', sex:'f' }
    ]);
    eq('refused', status, 422);
    const { rows } = await pool.query('SELECT born FROM people WHERE id = $1', [t]);
    eq('the edit that shared the batch was not kept either', rows[0].born, '1971');
  }

  section('WHAT COUNTS AS CONNECTED');
  {
    const { treeId, gf, t, u } = await family();

    const asChild = await post(treeId, [
      { op:'addPerson', ref:'$k', name:'Musekiwa Musoni', sex:'m' },
      { op:'addChild', unionId: u, personId:'$k' }
    ]);
    eq('a child of a marriage is in', asChild.status, 200);

    const asPartner = await post(treeId, [
      { op:'addPerson', ref:'$w', name:'Rudo Moyo', sex:'f' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId: t },
      { op:'addPartner', unionId:'$u2', personId:'$w' }
    ]);
    eq('a wife beside a husband is in', asPartner.status, 200);

    const asParent = await post(treeId, [
      { op:'addPerson', ref:'$m', name:'Sarah Chikwanha', sex:'f' },
      { op:'addUnion', ref:'$u3' },
      { op:'addPartner', unionId:'$u3', personId:'$m' },
      { op:'addChild', unionId:'$u3', personId: gf }
    ]);
    eq('a mother above a child is in', asParent.status, 200);

    /* A union with one name in it and nothing else is not a join. It is a
       name in a box, which is the thing being refused, drawn differently. */
    const boxed = await post(treeId, [
      { op:'addPerson', ref:'$x', name:'Farai Nobody', sex:'m' },
      { op:'addUnion', ref:'$u4' },
      { op:'addPartner', unionId:'$u4', personId:'$x' }
    ]);
    eq('a marriage with nobody else in it is not a join', boxed.status, 422);
  }

  section('a whole branch arrives in one breath, and every one of them is in');
  /* A family does not add one name at a time. Somebody typing a grandfather,
     his wife and their four children sends all six in one batch, and only the
     grandfather touches anybody already recorded — the other five reach the
     tree through him. */
  {
    const { treeId, gf } = await family();
    const { status } = await post(treeId, [
      { op:'addPerson', ref:'$w',  name:'Mbuya Sarah',  sex:'f' },
      { op:'addPerson', ref:'$c1', name:'Baya Musoni',  sex:'m' },
      { op:'addPerson', ref:'$c2', name:'Tendai Musoni', sex:'f' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId: gf },
      { op:'addPartner', unionId:'$u2', personId:'$w' },
      { op:'addChild', unionId:'$u2', personId:'$c1' },
      { op:'addChild', unionId:'$u2', personId:'$c2' }
    ]);
    eq('the whole branch goes in', status, 200);
    eq('all of them', await heads(treeId), 5);
  }

  section('AND AN ISLAND IS NOT A BRANCH');
  /* Two new names married to each other and to nobody else are joined to each
     other and adrift from the family. That is the shape this rule exists to
     prevent, and it is the one a second tab or a half-finished sync makes. */
  {
    const { treeId } = await family();
    const { status, body } = await post(treeId, [
      { op:'addPerson', ref:'$a', name:'Garikai Moyo', sex:'m' },
      { op:'addPerson', ref:'$b', name:'Chipo Moyo', sex:'f' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId:'$a' },
      { op:'addPartner', unionId:'$u2', personId:'$b' }
    ]);
    eq('refused', status, 422);
    check('and it names both of them',
          /Chipo Moyo/.test(body.message || '') && /Garikai Moyo/.test(body.message || ''),
          body.message);
    eq('and the tree is exactly as it was', await heads(treeId), 2);
  }

  section('THE FIRST NAME IN AN EMPTY TREE IS ALLOWED TO STAND ALONE');
  /* Because there is nothing for it to be joined to. Every name after it has
     somebody. */
  {
    const treeId = await newTree(pool, 'a family being started');
    session.treeId = treeId;
    const first = await post(treeId, [
      { op:'addPerson', ref:'$seed', name:'Chaitezvi Musoni', sex:'m' }
    ]);
    eq('the first name goes in', first.status, 200);

    const second = await post(treeId, [
      { op:'addPerson', ref:'$loose', name:'Somebody Else', sex:'f' }
    ]);
    eq('and the second one does not', second.status, 422);
    eq('the tree has one person in it', await heads(treeId), 1);

    const joined = await post(treeId, [
      { op:'addPerson', ref:'$kid', name:'Thomas Musoni', sex:'m' },
      { op:'addUnion', ref:'$u' },
      { op:'addPartner', unionId:'$u', personId: first.body.refs['$seed'] },
      { op:'addChild', unionId:'$u', personId:'$kid' }
    ]);
    eq('but a second one joined to the first does', joined.status, 200);
  }

  section('and only ONE name may stand alone in an empty tree');
  {
    const treeId = await newTree(pool, 'another family being started');
    session.treeId = treeId;
    const { status } = await post(treeId, [
      { op:'addPerson', ref:'$a', name:'One Person', sex:'m' },
      { op:'addPerson', ref:'$b', name:'Another Person', sex:'f' }
    ]);
    eq('two loose names are still two loose names', status, 422);
    eq('and neither was written down', await heads(treeId), 0);
  }

  section('A TREE EMPTIED AND STARTED AGAIN IS AN EMPTY TREE');
  /* Setting everybody aside is how a family starts over. The records stay and
     are readable, but there is nobody in the tree — so the first name written
     after that is the first name in an empty tree, and must not be refused
     for want of somebody to join. */
  {
    const { treeId, gf, t } = await family();
    const why = 'Set aside when the tree was started again.';
    await applyOps(pool, treeId, [
      { op:'setAside', id: gf, why }, { op:'setAside', id: t, why }
    ], 'a relative');
    eq('nobody is in the tree', await heads(treeId), 0);
    const { status } = await post(treeId, [
      { op:'addPerson', ref:'$seed', name:'Chaitezvi Musoni', sex:'m' }
    ]);
    eq('so a name may be planted', status, 200);
  }

  section('AND THE NEWCOMER DOOR KEEPS THE SAME RULE');
  /* /join-me composes its own ops and every branch of it joins somebody to the
     anchor, so it should never trip this. The one door whose whole job is "do
     not let a name in on its own" is the one that should prove it. */
  {
    const { treeId, gf } = await family();
    const r = await fetch(`${base}/api/tree/${treeId}/join-me`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name:'Hazvineyi Musoni', sex:'m', to: gf, as:'grandfather',
                             via:{ name:'Baya Musoni', sex:'m' } }) });
    eq('a newcomer two generations down still gets in', r.status, 201);
    const body = await r.json();
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM union_children WHERE person_id = $1`, [body.id]);
    eq('with somebody above them', rows[0].n, 1);
  }

  section('AND THE PRIMITIVE IS STILL THE PRIMITIVE');
  /* applyOps takes a loose name when asked plainly, and must keep doing so:
     the migration importer builds a tree in pieces, and the room that finds
     adrift names needs adrift names to find. The rule belongs at the door
     people come through, not in the hands of everything that writes. */
  {
    const { treeId } = await family();
    await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$loose', name:'A Name From The Old Import' }
    ], 'the importer');
    eq('it went in', await heads(treeId), 3);
  }

  section('AND THE PAGE SAYS THE RULE BEFORE IT ASKS ANYTHING');
  /* Read off the shipped page, because the door a newcomer meets is the page
     and a rule nobody is told is a rule that feels like a bug. */
  {
    const fs = require('fs');
    const path = require('path');
    const html = fs.readFileSync(
      path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
    const form = html.slice(html.indexOf('function openJoinMe'),
                            html.indexOf('function openJoinMe') + 9000);

    /* Stitched, because the sentences are written across several source lines
       the way every long string in this page is. */
    const words = form.replace(/`\s*\+\s*\n\s*`/g, '');
    check('the rule is stated before anything is asked',
          /joined to somebody — that is what makes it a tree/i.test(words),
          words.slice(0, 900));
    check('and that you go in beside one of them',
          /go in beside one person you are sure of/i.test(words), words.slice(0, 900));

    /* THE RELATIVE IS ASKED FOR FIRST, and the name last. An empty box headed
       "Your name" at the top is what every form that adds a stranger to a
       list looks like, and it is what made this read as a name being typed
       into a family tree rather than somebody joining on beside their uncle.
       Read by position, because the order is the whole of the point. */
    const step1 = words.indexOf('1 · Somebody you know is already here');
    const step2 = words.indexOf('2 · ');
    const step3 = words.indexOf('3 · And your own name');
    check('the first thing asked is who they know here', step1 > -1, String(step1));
    check('the second is what that person is to them', step2 > step1,
          `${step1} then ${step2}`);
    check('and their own name is last of the three', step3 > step2,
          `${step2} then ${step3}`);
    check('the name field is not even drawn until the first two are answered',
          /said\.to && said\.as[\s\S]{0,200}3 · And your own name/.test(words),
          words.slice(Math.max(0, step3 - 300), step3 + 80));

    /* BROWSABLE. Somebody who knows their uncle is in the tree but not how
       his name was written cannot type their way to him. */
    check('the list is there before anything is typed',
          /if \(!needle\) return roster\.slice\(0, BROWSE\)/.test(form), form.slice(0, 400));
    check('and it scrolls rather than filling the screen',
          /#form \.kinlist\.browse\{max-height/.test(html));
    check('the field says the list can be scrolled',
          /or scroll the list/.test(form));
    check('and how many names are in the family',
          /names are/.test(form) && /roster\.length/.test(form));

    /* AND THE PAGE ANSWERS THE REFUSAL RATHER THAN STALLING ON IT. */
    check('a refused batch is taken back on screen too',
          /d\.error === 'not_joined'/.test(html));
    check('and said at once rather than queued behind a confirmation',
          /say\(undone, 'atonce'\)/.test(html));

    /* ── AND SAID WHERE SOMEBODY CAN SEE IT ────────────────────────────
     *
     * say() writes into #live, which is one pixel square and clipped: an
     * announcement for a screen reader, and nothing a sighted relative will
     * ever read. That was the whole of the feedback on a refused batch — so
     * three names appeared, vanished a second later, and nothing on the
     * screen said why. It looks exactly like losing work for no reason, and
     * the reason was sitting right there.
     *
     * Everywhere else the app has something to show, it shows it: a clash
     * paints #others, a stall paints #stalled. A refusal does now too. */
    check('the live region really is invisible, which is why this matters',
          /\.sr\{position:absolute; width:1px/.test(html));
    check('a refused batch is written where it can be read',
          /showRefused\(undone\)/.test(html));
    check('by a function that puts it on the screen and leaves it there',
          /function showRefused\(message\)\{[\s\S]{0,240}el\.hidden = false/.test(html));
    check('and the passcode refusal is written up the same way',
          /showRefused\(refused\)/.test(html));
  }

  /* ── AND NOBODY IS EVER CUT LOOSE ───────────────────────────────────────
   *
   * "3 names are recorded but not joined to anybody yet. This needs to be
   *  impossible."
   *
   * Everything above is the door. A name does not have to arrive adrift to
   * end up adrift — it can be cut loose later by the corrections this app
   * offers in one tap, and until now nothing checked. These are those taps.
   */
  section('TAKING OUT THE LAST THREAD IS REFUSED TOO');
  {
    // Chaitezvi and Thomas, father and son, and nothing else holds Thomas on.
    const { treeId, gf, t, u } = await family();
    const { status, body } = await post(treeId, [
      { op:'removeChild', unionId: u, personId: t }
    ]);
    eq('refused', status, 422);
    eq('and says which rule', body.error, 'not_joined');
    /* BOTH of them, because a family of one is not a family. With the only
       join gone there are two names and nothing holding either, and excusing
       whichever id sorted first would have reported half the truth. */
    check('naming who would have been left floating',
          /Thomas Musoni/.test(body.message || '') &&
          /Chaitezvi Musoni/.test(body.message || ''), body.message);
    check('and saying what to do instead',
          /join them to somebody else|take them out as well/i.test(body.message || ''),
          body.message);
    eq('both are still in the tree', await heads(treeId), 2);
    const { rows } = await pool.query(
      'SELECT count(*)::int AS n FROM union_children WHERE union_id = $1', [u]);
    eq('and the join is still there — the whole batch went back', rows[0].n, 1);
    check('nothing about the father either', !!gf, 'no father');
  }

  section('setting aside a bridge is refused, because they go off screen with it');
  {
    /* Set aside is the reversible door and it still cannot strand anybody:
       somebody set aside is off the screen, so a family behind them is off
       the screen too, which is exactly what the family would see.

       Thomas is the bridge — his father on one side, his own wife and child
       on the other — so this is the shape that matters, not a tree of two. */
    const { treeId, t } = await family();
    const made = await post(treeId, [
      { op:'addPerson', ref:'$w', name:'Evelyn Mandaba', sex:'f' },
      { op:'addUnion', ref:'$m' },
      { op:'addPartner', unionId:'$m', personId: t },
      { op:'addPartner', unionId:'$m', personId:'$w' }
    ]);
    eq('his marriage goes in', made.status, 200);

    const { status, body } = await post(treeId, [
      { op:'setAside', id: t, why:'entered twice' }
    ]);
    eq('refused', status, 422);
    check('naming the wife it would have stranded',
          /Evelyn Mandaba/.test(body.message || ''), body.message);
    eq('and nobody is set aside', await heads(treeId), 3);
  }

  section('a marriage can be taken out when it is not the last thread');
  {
    /* The rule refuses to make loose names, not to make corrections. Thomas
       is his father's son whether or not his marriage stands. */
    const { treeId, t } = await family();
    const made = await post(treeId, [
      { op:'addPerson', ref:'$w', name:'Evelyn Mandaba', sex:'f' },
      { op:'addUnion', ref:'$m' },
      { op:'addPartner', unionId:'$m', personId: t },
      { op:'addPartner', unionId:'$m', personId:'$w' },
      { op:'addPerson', ref:'$k', name:'Tendai Musoni', sex:'m' },
      { op:'addChild', unionId:'$m', personId:'$k' }
    ]);
    eq('the marriage and a child of it go in', made.status, 200);
    const marriage = made.body.refs.$m, wife = made.body.refs.$w, kid = made.body.refs.$k;

    /* Evelyn is held on by the marriage alone, so taking her out of it would
       strand her — and that is refused. */
    const her = await post(treeId, [{ op:'removePartner', unionId: marriage, personId: wife }]);
    eq('taking the wife out of her only marriage is refused', her.status, 422);
    check('naming her', /Evelyn Mandaba/.test(her.body.message || ''), her.body.message);

    /* AND SO IS TAKING THE HUSBAND OUT, which is the half of this I had
       backwards when I wrote it. Thomas is held on by his father, so he
       survives the act — but he is also the only thing holding his wife and
       their child to the Musonis, and pulling him out of the marriage floats
       the pair of them off. The rule is about who is left joined to nobody,
       not about who is doing the leaving. */
    const him = await post(treeId, [{ op:'removePartner', unionId: marriage, personId: t }]);
    eq('taking the husband out is refused — it floats his wife and child off',
       him.status, 422);
    /* AND NAMING THE RIGHT HALF. The tree tears into two pieces of two, so
       size cannot settle which piece is the family — the trunk does, and the
       trunk is where the family started. Told the wrong way round this reads
       "that would leave the patriarch joined to nobody", which is nonsense to
       anybody looking at the screen. */
    check('naming the pair that would have floated off',
          /Evelyn Mandaba/.test(him.body.message || '') &&
          /Tendai Musoni/.test(him.body.message || ''), him.body.message);
    check('and not the side the family started from',
          !/Chaitezvi/.test(him.body.message || ''), him.body.message);
    eq('and everybody is still in the tree', await heads(treeId), 4);

    check('and the child is still recorded', !!kid, 'no child');
  }

  section('and MOVING somebody still works, which is the act this must not break');
  {
    /* "Whose child" sends a removeChild and an addChild in one batch — the
       only order a move can succeed in, since a person carries one set of
       parents. Both halves are inside one transaction, so the person is never
       actually loose, and a rule that looked at the removal alone would have
       broken the commonest correction in the app. */
    const { treeId, gf, t, u } = await family();
    const second = await post(treeId, [
      { op:'addPerson', ref:'$w2', name:'Maria Chirwa', sex:'f' },
      { op:'addUnion', ref:'$u2' },
      { op:'addPartner', unionId:'$u2', personId: gf },
      { op:'addPartner', unionId:'$u2', personId:'$w2' }
    ]);
    eq('a second marriage for the father goes in', second.status, 200);

    const moved = await post(treeId, [
      { op:'removeChild', unionId: u, personId: t },
      { op:'addChild', unionId: second.body.refs.$u2, personId: t }
    ]);
    eq('the son can be moved from one of his father\'s marriages to the other',
       moved.status, 200);
    const { rows } = await pool.query(
      'SELECT union_id FROM union_children WHERE person_id = $1', [t]);
    eq('and he is under the second one now', rows[0].union_id, second.body.refs.$u2);
    eq('with nobody adrift', await heads(treeId), 3);
  }

  section('and an already-loose name is never a reason to refuse a repair');
  {
    /* Trees carry names cut loose before any of this existed. A rule that
       also demanded the past be tidy would refuse a family's correction to a
       loose name BECAUSE the name was loose. The primitive is used directly
       here to make the mess the door would not let in. */
    const { treeId, gf, u } = await family();
    // One more Musoni, so the family is plainly the bigger island. Two islands
    // of equal size have no principled winner and a real tree does not have
    // that problem.
    await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$b', name:'Bertha Musoni', sex:'f' },
      { op:'addChild', unionId: u, personId:'$b' }
    ], 'the first relative');
    const stray = await applyOps(pool, treeId, [
      { op:'addPerson', ref:'$x', name:'Nyarai Moyo', sex:'f' },
      { op:'addPerson', ref:'$y', name:'Rudo Moyo', sex:'f' },
      { op:'addUnion', ref:'$v' },
      { op:'addPartner', unionId:'$v', personId:'$x' },
      { op:'addChild',   unionId:'$v', personId:'$y' }
    ], 'before the rule existed');
    const x = stray.refs.$x, y = stray.refs.$y;

    // An island of two, adrift from the Musonis. Now repair it, which means
    // taking Rudo off her floating mother and hanging her on the family.
    const fix = await post(treeId, [
      { op:'removeChild', unionId: stray.refs.$v, personId: y },
      { op:'addChild', unionId: null, parentId: gf, personId: y }
    ].filter(o => o.op !== 'addChild'));
    /* The removal alone would leave Rudo adrift — but she was adrift already,
       out on the island, so the number does not grow and it is allowed. */
    eq('a repair that touches a name already adrift is not refused', fix.status, 200);
    check('and Nyarai is still there to be dealt with', !!x, 'no stray');
  }

  server.close();
  await pool.end();
  report();
})().catch(e => { console.error(e); process.exit(1); });
