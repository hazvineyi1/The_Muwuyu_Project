// Somebody who is not in the tree yet, arriving at a family that has been
// going for a year.
//
// "Nobody should be able to add their name unless they are attached to
//  somebody. So the instructions should advise them to look for someone who
//  might be on the tree they can attach to. Options are made available and
//  they can add themselves based on someone on the tree, not a random name
//  add. Plant the first person is not an option because the tree has already
//  begun and it leads to isolated people."
//
// TWO FAULTS, and they worked together. The planting screen — a box to type a
// name into and a button that says plant — was visible in the markup and
// hidden by the first render, so every page showed it for a moment and a page
// that never GOT the tree showed it for good. A newcomer has not got the tree:
// the server holds the family back until the session says who is looking. So
// the most obvious thing on a newcomer's screen was an invitation to plant
// themselves, which is exactly the isolated person the whole rule exists to
// prevent.
//
// And the form behind "Add me to the family" opened with an empty box headed
// "Your name", which is what every form that adds a stranger to a list looks
// like. The rule was kept — nothing written there has ever gone in unattached
// — but asked in that order it read as a name being typed into a family tree.
// Asked the other way round it is the same three answers and a different act:
// find the one you know, say what they are to you, and then sign it.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser newcomer
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, openApp, ready, onlyThisOrigin, PASSPHRASE } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d).slice(0,300) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, {got:a, want:b});
const section = t => console.log('\n' + t);
const ink = (p, s) => p.evaluate(x => (document.querySelector(x) || {}).textContent || '', s);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  // A family that has been going a while.
  const { page } = await openApp(browser);
  await ready(page);
  const treeId = await page.evaluate(() => treeId);
  const built = await page.evaluate(async id => {
    const r = await fetch(`/api/tree/${id}/ops`, { method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ ops: [
        { op:'addPerson', ref:'$gf', name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900' },
        { op:'addPerson', ref:'$gm', name:'Mbuya Sarah Moyo', sex:'f', totem:'Nzou', born:'1905' },
        { op:'addPerson', ref:'$d',  name:'Thomas Musoni', sex:'m', totem:'Mwendamberi', born:'1971' },
        { op:'addUnion', ref:'$u' },
        { op:'addPartner', unionId:'$u', personId:'$gf' },
        { op:'addPartner', unionId:'$u', personId:'$gm' },
        { op:'addChild', unionId:'$u', personId:'$d' }
      ] }) });
    return r.status;
  }, treeId);
  is(built, 200, 'a family of three already recorded');

  section('A NEWCOMER IS NEVER OFFERED "PLANT THE FIRST PERSON"');
  const them = await browser.newContext({ viewport:{ width:1280, height:940 } });
  await onlyThisOrigin(them);
  const p2 = await them.newPage();
  await p2.goto(BASE, { waitUntil:'domcontentloaded' });
  if (await p2.$('input[name="passphrase"]')) {
    await p2.fill('input[name="passphrase"]', PASSPHRASE);
    await Promise.all([p2.waitForNavigation({ waitUntil:'domcontentloaded' }).catch(()=>{}),
                       p2.click('button[type="submit"]')]);
  }
  await p2.waitForSelector('#whoQ', { timeout: 20000 });
  is(await p2.isVisible('#seed'), false,
     'the planting screen is not behind the question');

  // And if they dismiss the question, still not offered.
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(600);
  is(await p2.isVisible('#seed'), false, 'nor after they close it');

  section('THE FORM ASKS FOR THE RELATIVE FIRST, AND THE NAME LAST');
  await p2.reload({ waitUntil:'domcontentloaded' });
  await p2.waitForSelector('#whoQ', { timeout: 20000 });
  const asked = await p2.evaluate(() => document.querySelector('#whoQ').closest('div').textContent);
  is(/Not on this list/.test(asked), true, 'the question offers a way in for somebody not on it');
  await p2.click('#whoNew');
  await p2.waitForSelector('#jFind', { timeout: 10000 });

  const step1 = await ink(p2, '#form');
  is(/joined to somebody — that is what makes it a tree/.test(step1), true,
     'the rule is stated first');
  is(/1 · Somebody you know is already here/.test(step1), true,
     'and the first thing asked is who they know');
  is(await p2.$('#jName'), null, 'there is no name box yet');
  is(await p2.$('#jGo'), null, 'and nothing to submit yet');
  const offered = await p2.$$eval('#jList [data-jto]', bs => bs.map(b => b.firstChild.textContent.trim()).sort());
  is(offered, ['Chaitezvi Musoni','Mbuya Sarah Moyo','Thomas Musoni'],
     'every name in the family is offered to pick from');

  section('PICKING ONE OPENS THE SECOND QUESTION, AND THAT OPENS THE THIRD');
  await p2.click('#jList [data-jto]');
  await p2.waitForTimeout(400);
  const step2 = await ink(p2, '#form');
  is(/2 · /.test(step2), true, 'the second step appears');
  is(await p2.$('#jName'), null, 'and still no name box');

  await p2.click('[data-jas="grandfather"]');
  await p2.waitForTimeout(400);
  is(!!(await p2.$('#jName')), true, 'once the word is chosen, the name is asked for');
  is(/3 · And your own name/.test(await ink(p2, '#form')), true, 'as the third step');
  is(!!(await p2.$('#jGo')), true, 'and now there is something to submit');

  section('AND THEY GO IN, JOINED');
  await p2.fill('#jVia', 'Thomas');
  await p2.waitForTimeout(400);
  const via = await p2.$$eval('#jViaList [data-jvia]', bs => bs.map(b => b.textContent.trim()));
  is(via, ['Thomas Musoni'], 'the one in between is offered from the tree');
  await p2.click('[data-jvia]');
  await p2.waitForTimeout(300);
  await p2.fill('#jName', 'Hazvineyi Musoni');
  await p2.click('[data-jsex="m"]');
  await p2.waitForTimeout(200);
  await p2.click('#jGo');
  await p2.waitForTimeout(4000);
  const who = await p2.evaluate(() => {
    const me = state.people[meId], pu = parentUnionOf(meId);
    return { me: me && me.name, above: pu ? pu.partners.map(x => (state.people[x]||{}).name) : [],
             loose: adrift().map(p => p.name), n: people().length };
  });
  is(who.me, 'Hazvineyi Musoni', 'they are in the tree');
  is(who.above, ['Thomas Musoni'], 'joined under the one in between');
  is(who.loose, [], 'and nobody in the family is adrift');
  is(who.n, 4, 'four people, not five — no second Thomas');

  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
