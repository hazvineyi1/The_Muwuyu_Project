// WHO IS LOOKING, AND WHAT IT COSTS TO BE NOBODY.
//
// The one thing this app does that a western tree cannot is say what one
// person is to another in the family's own word — and every one of those
// words is reckoned from a single person. With nobody set there is nothing to
// reckon from, so not one Shona word is drawn. Amai, Baba, Sekuru, Ambuya all
// go, and what is left is a tree of bare names.
//
// THAT IS THE WHOLE APP SWITCHED OFF, and the only sign of it was an em-dash
// in the corner of the top bar. A family opening their own tree and finding
// the thing they came for missing does not read "You: —" as the cause. They
// read it as the app not working, and there is no reason they should read it
// any other way.
//
// AND THE FASTEST WAY TO GET INTO THAT STATE WAS THE BUTTON THAT REPORTS IT.
// Tapping "You: Belinda" emptied it. One tap, no confirmation, nothing said,
// on the single setting the whole tree is reckoned from — while its own
// tooltip read "Terms are shown from Belinda's side. Tap to change." It did
// not change. A woman handing her phone to her brother so he can see the
// family from where HE stands is the everyday reason to press it, and what
// she got was the app turned off.
//
// So the chip starts the pick, which is what change means; letting go
// entirely is still there and is now deliberate — your own name again, said
// out loud when the pick starts — because "nobody" is a real answer for
// somebody looking at another family's tree, just not an accidental one.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser whoami
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin, throughDoor } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Sydney Mandaba',  sex:'m', totem:'Moyondizvo', born:'1900', root:true },
    p2:{ id:'p2', name:'Rudo Mandaba',    sex:'f', totem:'Moyondizvo', born:'1932' },
    p3:{ id:'p3', name:'Joseph Chirwa',   sex:'m', totem:'Mangwenya',  born:'1930' },
    p4:{ id:'p4', name:'Belinda Chirwa',  sex:'f', totem:'Mangwenya',  born:'1958' },
    p5:{ id:'p5', name:'Tendai Mandaba',  sex:'m', totem:'Moyondizvo', born:'1936' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1'],      children:['p2','p5'] },
    u2:{ id:'u2', partners:['p2','p3'], children:['p4'] }
  },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});
const ALONE = JSON.stringify({
  people: { p1:{ id:'p1', name:'Sydney Mandaba', sex:'m', totem:'Moyondizvo', born:'1900', root:true } },
  unions: {}, rootId:'p1', seq:2, notDuplicates:[], lexicon:{}
});

const bar    = page => page.evaluate(() => {
  const e = document.getElementById('litbar');
  return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : '';
});
const chip   = page => page.evaluate(() => document.getElementById('who').textContent.trim());
const said   = page => page.evaluate(() => document.getElementById('live').textContent.trim());
/* The Shona words on the tree itself — the thing that is actually missing. */
const shona  = page => page.evaluate(() =>
  [...document.querySelectorAll('.pod .ttl:not(.vantage)')]
    .map(e => e.textContent.trim()).filter(Boolean).sort());

const open = async (ctx, family, me) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, m]) => {
    localStorage.setItem('muti-baobab-v1', f);
    if (m) localStorage.setItem('muti-baobab-me', m); else localStorage.removeItem('muti-baobab-me');
  }, [family, me || '']);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length > 0; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(500);
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await onlyThisOrigin(ctx);

  section('A TREE WITH NOBODY SET HAS NOT ONE SHONA WORD IN IT');
  const page = await open(ctx, FAMILY, null);
  {
    is(await shona(page), [], 'the words are gone, which is the app’s whole answer');
    is(await chip(page), 'You: —', 'and the top bar says it in one character');
  }

  section('so it is said in words, where it cannot be missed');
  {
    const line = await bar(page);
    check(/Nobody is set as you/.test(line), 'the bar says nobody is set: ' + JSON.stringify(line));
    check(/reckoned from one person/.test(line), 'and why that empties the tree');
    check(/only show names/.test(line), 'and what the tree is reduced to');
    check(await page.$('#meGo') !== null, 'and offers the one tap that answers it');
  }

  section('and it does not close, because it is a question and not a setting');
  {
    is(await page.evaluate(() =>
         [...document.querySelectorAll('#litbar .pill button')].map(b => b.id)), ['meGo'],
       'the only button on it is the answer');
  }

  section('AND ANSWERING IT PUTS THE WORDS BACK');
  {
    await page.click('#meGo');
    await page.waitForTimeout(250);
    check(/Tap your own name/.test(await said(page)), 'it says what to do next');
    await page.click('.pod[data-id="p4"]');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => meId), 'p4', 'tapping a name sets it');
    check((await shona(page)).length > 0,
          'and the tree has its words back: ' + JSON.stringify(await shona(page)));
    is(await bar(page), '', 'and the line has gone, having been answered');
    is(await chip(page), 'You: Belinda', 'and the top bar names her');
  }

  section('THE CHIP THAT SAYS WHO YOU ARE IS NOT A TRAPDOOR');
  /* One tap used to empty it, silently. */
  {
    await page.click('#who');
    await page.waitForTimeout(250);
    is(await page.evaluate(() => meId), 'p4', 'one tap does not let go of who you are');
    is(await chip(page), 'Tap your own name', 'it asks for the new answer instead');
    const s = await said(page);
    check(/Tap whoever you are/.test(s), 'and says so: ' + JSON.stringify(s));
    check(/Belinda again to be nobody/.test(s),
          'naming the way out as well, which is the only way there is');
  }

  section('and picking somebody else is a change, not a reset');
  {
    await page.click('.pod[data-id="p5"]');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => meId), 'p5', 'the tree is now read from where he stands');
    check((await shona(page)).length > 0, 'and it still has words');
    is(await bar(page), '', 'with nothing to report');
  }

  section('while your own name again is how you become nobody in particular');
  /* A real answer for somebody looking at another family's tree — and it has
     to be reachable, or "nobody" becomes a state you can only get into by
     accident and never on purpose. */
  {
    await page.click('#who');
    await page.waitForTimeout(200);
    await page.click('.pod[data-id="p5"]');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => meId), null, 'letting go still works');
    const s = await said(page);
    check(/names and no words/.test(s),
          'and it says what it cost rather than going quiet: ' + JSON.stringify(s));
    check(/Nobody is set as you/.test(await bar(page)), 'and the standing line is back');
  }

  section('AND A TREE OF ONE IS NOT ASKED THE QUESTION');
  /* There is nobody to be anything to, so there is nothing missing. */
  {
    const one = await open(ctx, ALONE, null);
    is(await bar(one), '', 'nothing is said to somebody who has entered one name');
    await one.close();
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
