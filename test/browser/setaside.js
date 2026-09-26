// Setting somebody aside, in a real browser.
//
// The rule is asserted headlessly in test/setaside.frontend.test.js. What can
// only be checked here is the part a relative actually meets: that the ✕ asks
// WHY instead of asking yes/no, that it refuses to proceed without an answer,
// that the person who recorded the entry is told, and that anybody can put it
// back. Also that Clear — one tap from erasing a shared tree — no longer can.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser setaside
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
// The app opens on a door now; this presses the way through to the tree.
const { throughDoor, helpBuild } = require('./lib');

const BASE = process.env.MW_BASE_URL || 'http://127.0.0.1:3930/';
const EXE  = process.env.MW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + d : '')); };
const is  = (a, b, m) => a === b ? ok(m) : bad(m, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const section = t => console.log('\n' + t);

// Rudo entered everyone. Garikai is the one looking.
const FAMILY = {
  people: {
    p1:{ id:'p1', name:'Rufaro Moyo', sex:'m', born:'1940', by:'Rudo', root:true },
    p2:{ id:'p2', name:'Garikai',     sex:'m', born:'1968', by:'Rudo' },
    p3:{ id:'p3', name:'Tendai',      sex:'m', born:'1971', by:'Rudo' },
    p4:{ id:'p4', name:'Ruvarashe',   sex:'f', born:'1995', by:'Rudo' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1'], children:['p2','p3'] },
    u2:{ id:'u2', partners:['p2'], children:['p4'] }
  },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1400, height:950 } });
  await ctx.route('**', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(f => localStorage.setItem('muti-baobab-v1', JSON.stringify(f)), FAMILY);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
  await throughDoor(page);
  // These drive the building half of the app — see helpBuild.
  await helpBuild(page);
  // Garikai is the one looking, so what he sets aside is stamped with his name.
  await page.evaluate(() => { setMe('p2'); });

  /* THE DOORS MOVED BEHIND ONE DOOR. Set aside, Start again and the rest were
     buttons of their own on the bar; they are rooms behind the hub now, and
     the count that used to ride on each button rides on the hub's mark with
     everything else waiting to be looked at. The acts are the same acts. */
  const openRoom = async room => {
    await page.evaluate(() => closeForm());
    await page.click('#hub');
    await page.waitForSelector(`[data-room="${room}"]`, { timeout: 10000 });
    await page.click(`[data-room="${room}"]`);
    await page.waitForSelector('#form', { timeout: 10000 });
  };
  const roomText = async room => {
    await page.evaluate(() => closeForm());
    await page.click('#hub');
    await page.waitForSelector('#form', { timeout: 10000 });
    const el = await page.$(`[data-room="${room}"]`);
    const said = el ? (await el.textContent()).trim() : null;
    await page.evaluate(() => closeForm());
    return said;
  };

  const select = async id => {
    await page.evaluate(i => { sel = i; render(); revealBuds(); }, id);
    await page.waitForTimeout(150);
  };

  section('the ✕ on a pod deletes in one tap, and offers it straight back');
  /* IT USED TO OPEN THE SET-ASIDE FORM. A family said plainly that being made
     to type a name to take an entry out was too much, so the ✕ is now the
     quick act and setting aside is the considered one, reached from the card.
     Nothing is sent for a few seconds, and the bar carries the way back —
     which is what makes one tap safe rather than careless. */
  await select('p4');
  await page.click('.pod[data-id="p4"] .rm[data-rm="p4"]');
  await page.waitForTimeout(300);
  is(await page.evaluate(() => !!state.people.p4), false, 'Ruvarashe is gone in one tap');
  is(await page.isVisible('#undelete'), true, 'and the bar offers to put her back');
  is(/Ruvarashe deleted/.test(await page.textContent('#litbar')), true, 'saying who');
  await page.click('#undelete');
  await page.waitForTimeout(300);
  is(await page.evaluate(() => !!state.people.p4), true, 'one tap puts her back');
  is(await page.evaluate(() => people().length), 4, 'and the tree is whole');

  section('setting aside asks why, instead of asking yes or no');
  /* IT IS REACHED FROM THE CARD NOW. The ✕ on the pod used to open this; it
     deletes in one tap since a family said plainly that being made to type a
     name to remove one was too much. Setting aside did not change — it is the
     other act, and it lives where the other things you can do to a person
     live — and the ✕'s own behaviour is checked just above. */
  await select('p3');
  await page.evaluate(() => openCard('p3'));
  await page.waitForSelector('[data-fold="out"]', { timeout: 10000 });
  /* Behind a fold, and deliberately: taking somebody out is the one thing
     nobody opens a card to do, and it used to sit between the family's
     records and the Save button. */
  await page.click('[data-fold="out"] summary');
  await page.waitForSelector('#cAside', { state:'visible', timeout: 10000 });
  await page.click('#cAside');
  await page.waitForSelector('#saWhy', { timeout: 10000 });
  const form = await page.textContent('#form');
  is(/Set aside/.test(form), true, 'the form is headed Set aside, not Remove');
  is(/Nothing is deleted/.test(form), true, 'and says outright that nothing is deleted');
  is(/Rudo/.test(form), true, 'it names who recorded them and will be told');
  is(await page.isVisible('#saWhy'), true, 'and there is a box for the reason');

  section('and it will not proceed without one');
  await page.click('#saGo');
  await page.waitForTimeout(200);
  is(await page.isVisible('#form'), true, 'the form stays open');
  is(await page.evaluate(() => !!state.people.p3.aside), false, 'and nobody was set aside');
  await page.fill('#saWhy', '   ');
  await page.click('#saGo');
  await page.waitForTimeout(200);
  is(await page.evaluate(() => !!state.people.p3.aside), false, 'spaces do not count as a reason');

  section('with a reason, they leave the tree and the record stays');
  await page.fill('#saWhy', 'Entered twice — same Tendai as his brother recorded.');
  await page.click('#saGo');
  await page.waitForTimeout(400);
  is(await page.evaluate(() => !!state.people.p3.aside), true, 'they are set aside');
  is(await page.evaluate(() => state.people.p3.name), 'Tendai', 'the record keeps its name');
  is(await page.evaluate(() => state.people.p3.aside.by), 'Garikai', 'stamped with who did it');
  is(await page.evaluate(() => state.people.p3.aside.why),
     'Entered twice — same Tendai as his brother recorded.', 'and with the reason');
  is(await page.evaluate(() => people().length), 3, 'the tree is one smaller');
  is(await page.isVisible('.pod[data-id="p3"]'), false, 'their pod is off the canvas');
  is(await page.textContent('#count'), '3', 'and the tally agrees');

  section('the record survives a reload — it was saved, not just hidden');
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 3; } catch(e){ return false; } });
  await throughDoor(page);
  // These drive the building half of the app — see helpBuild.
  await helpBuild(page);
  is(await page.evaluate(() => !!state.people.p3), true, 'the person is still in the stored tree');
  is(await page.evaluate(() => state.people.p3.aside.why),
     'Entered twice — same Tendai as his brother recorded.', 'with the reason intact');

  section('the person who recorded them is told');
  await page.evaluate(() => { setMe('p1'); });      // nobody named Rudo yet
  is(await page.evaluate(() => noticesFor('Rudo').length), 1, 'Rudo has one notice');
  // Now look as Rudo: rename the selected person so meName() is Rudo.
  await page.evaluate(() => { state.people.p1.name = 'Rudo'; setMe('p1'); render(); });
  await page.waitForTimeout(200);
  const label = await roomText('aside');
  is(label !== null, true, 'the hub offers a Set aside room');
  is(/1 entry you recorded/.test(label || ''), true,
     'calling out that one is hers: ' + JSON.stringify(label));
  is(await page.evaluate(() => hubMark() > 0), true,
     'and the door itself is marked, so it is noticed without being opened');

  section('the panel says who, why, and offers it back');
  await openRoom('aside');
  const panel = await page.textContent('#form');
  is(/Tendai/.test(panel), true, 'it names the person');
  is(/Entered twice/.test(panel), true, 'it gives the reason');
  is(/Garikai/.test(panel), true, 'and who set them aside');
  is(/Yours/.test(panel), true, 'under a heading saying these are hers');
  is((await page.$$('#form .askrow[data-back="p3"]')).length, 1, 'with a way to put them back');

  section('anyone can put them back');
  await page.click('#form .askrow[data-back="p3"]');
  await page.waitForTimeout(400);
  is(await page.evaluate(() => !!state.people.p3.aside), false, 'they are restored');
  is(await page.evaluate(() => people().length), 4, 'the tree is whole again');
  is(await page.isVisible('.pod[data-id="p3"]'), true, 'their pod is back on the canvas');
  is(await roomText('aside'), null, 'and the room is gone, because nobody is out');

  section('Start again no longer erases a shared tree');
  page.on('dialog', d => d.accept());
  await page.evaluate(() => closeForm());
  await page.click('#hub');
  await page.waitForSelector('[data-room="clear"]', { timeout: 10000 });
  await page.click('[data-room="clear"]');
  await page.waitForTimeout(700);
  is(await page.evaluate(() => people().length), 0, 'the tree is emptied');
  is(await page.evaluate(() => Object.keys(state.people).length), 4,
     'but all four records are still there');
  is(await page.evaluate(() => asidePeople().length), 4, 'every one of them set aside');
  is(await page.isVisible('#bar'), true, 'the bar stays, so they are reachable');
  await openRoom('aside');
  is((await page.$$('#form .askrow[data-back]')).length, 4, 'all four can be put back');
  await page.click('#form .askrow[data-back="p1"]');
  await page.waitForTimeout(300);
  is(await page.evaluate(() => people().length), 1, 'and putting one back works');

  section('an emptied tree is not shown as a fresh one');
  // The welcome screen sits above everything. Shown here it would cover the
  // only panel that can bring these records back.
  await page.evaluate(() => {
    for (const p of people()) p.aside = { by:'x', at:new Date().toISOString(), why:'test' };
    render();
  });
  await page.waitForTimeout(200);
  is(await page.evaluate(() => people().length), 0, 'nobody is in the tree');
  is(await page.isVisible('#seed'), false, 'the plant-your-first-person screen stays away');
  is(await roomText('aside') !== null, true, 'the way back is still offered');
  is(/set aside/i.test(await page.textContent('#hint')), true, 'and the hint points at it');

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
