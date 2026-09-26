// USING MUTI, AND MAINTAINING MUTI.
//
// "Most family members should see a beautiful, simple family experience.
//  Editing functions should not dominate that experience. Someone visiting to
//  work out who their mother's cousin is should not be surrounded by
//  database-maintenance controls."
//
// They were. Tapping anybody in this tree opened a ring of six or seven buds,
// and every single one of them makes or moves a record: add a child, add a
// partner, add a parent, add a sibling, add by the word your family uses,
// bring somebody already here onto this branch, lift a root. Beside them on
// the pod sat a ✕ that deletes, and under them a toolbar with Undo. A woman
// who opened her family's tree to find out what her mother's cousin is to her
// was handed the tools for editing a database and had to find the answer
// behind them.
//
// TWO MODES, AND EXPLORE IS THE ONE YOU GET.
//
//   Exploring — a tap says what that person is to you. Their card, which
//   answers before it asks anything. No buds, no ✕, no Undo.
//
//   Helping build — a tap offers every way to add to the tree, exactly as
//   this app has always worked.
//
// NOTHING THAT SAYS SOMETHING IS PUT AWAY. That is the line this file
// defends: every word, every path, every panel about the family is there in
// both. What moves is the machinery for CHANGING records, which is a
// different job done by fewer people less often. A mode that quietly took
// away half of what the app can tell you would be a worse app pretending to
// be a simpler one.
//
// AND THE PERSON WHO IS ACTUALLY BUILDING SWITCHES ONCE. It is remembered per
// device, so the relative filling the tree in never thinks about it again
// while the relative they sent the link to gets the family rather than the
// database. Planting the first name of a family turns it on by itself —
// somebody who has just typed the first name is building.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser helping
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin, throughDoor, helpBuild } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Sydney Mandaba', sex:'m', totem:'Moyondizvo', born:'1900', root:true },
    p2:{ id:'p2', name:'Rudo Mandaba',   sex:'f', totem:'Moyondizvo', born:'1932' },
    p3:{ id:'p3', name:'Belinda Chirwa', sex:'f', totem:'Mangwenya',  born:'1958' },
    p4:{ id:'p4', name:'Tendai Mandaba', sex:'m', totem:'Moyondizvo', born:'1936' }
  },
  unions: { u1:{ id:'u1', partners:['p1'], children:['p2','p4'] },
            u2:{ id:'u2', partners:['p2'], children:['p3'] } },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

const open = async (ctx, me, size) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  if (size) await page.setViewportSize(size);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, m]) => {
    localStorage.removeItem('muti-baobab-helping');
    localStorage.setItem('muti-baobab-v1', f);
    if (m) localStorage.setItem('muti-baobab-me', m); else localStorage.removeItem('muti-baobab-me');
  }, [FAMILY, me || '']);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(300);
  return page;
};

const tap = async (page, id) => {
  await page.click(`.pod[data-id="${id}"]`);
  await page.waitForTimeout(450);
};
const budCount = page => page.evaluate(() => document.querySelectorAll('#buds .bud').length);
const panel = page => page.evaluate(() => {
  const f = document.getElementById('form');
  return f ? f.textContent.replace(/\s+/g, ' ').trim() : null;
});

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await onlyThisOrigin(ctx);

  section('A TREE YOU HAVE ONLY BEEN SENT IS ONE YOU READ');
  const page = await open(ctx, 'p3');
  {
    is(await page.evaluate(() => helping), false, 'nobody is helping build to begin with');
    is(await page.evaluate(() => document.getElementById('undo').hidden), true,
       'there is nothing to take back, so Undo is not offered');
    is(await page.evaluate(() => document.getElementById('helping').textContent.trim()),
       'Help build', 'and the other job is named on the button that starts it');
  }

  section('and a tap answers rather than handing over the tools');
  {
    await tap(page, 'p4');
    is(await budCount(page), 0, 'no bud makes or moves a record here, so there are none');
    const said = await panel(page);
    check(said && /Tendai Mandaba/.test(said), 'the card opens instead', said && said.slice(0, 60));
    check(said && /Hukama hwenyu/.test(said), 'and the first thing on it is the word');
    check(said && /Sekuru/.test(said), 'which is Sekuru: ' + JSON.stringify(said && said.slice(0, 80)));
    is(await page.evaluate(() => document.querySelectorAll('.pod .rm[data-rm]').length), 0,
       'and nothing on the pod deletes anybody');
  }

  section('while NOTHING that says something is put away');
  /* The line this whole mode stands or falls on. A simpler app that can
     answer less is not a simpler app. */
  {
    for (const [id, what] of [['cRel',  'the whole relationship'],
                              ['cShow', 'showing them on the tree'],
                              ['cKin',  'everyone recorded around them']])
      check(await page.$(`#${id}`) !== null, what + ' is still offered', id);
    check(/How they are joined/.test(await panel(page)),
          'and the way the two of you are joined is still worked out');

    await page.evaluate(() => { closeForm(); openFind(); });
    await page.waitForSelector('#findQ', { timeout:5000 });
    await page.type('#findQ', 'Tendai', { delay:20 });
    await page.waitForTimeout(350);
    check(await page.$('#findList [data-kin]') !== null,
          'Find still answers who somebody is to you');
    await page.evaluate(() => { closeForm(); openKinship(); });
    await page.waitForTimeout(300);
    check(/What are they to each other/.test(await panel(page)),
          'and the kinship panel is where it was');
    await page.evaluate(() => closeForm());
  }

  section('HELPING BUILD IS ONE PRESS, AND IT IS THE OLD APP');
  {
    await page.click('#helping');
    await page.waitForTimeout(400);
    is(await page.evaluate(() => helping), true, 'the switch switches');
    is(await page.evaluate(() => document.getElementById('helping').textContent.trim()),
       '● Helping build', 'and says which of the two you are doing');
    is(await page.evaluate(() => document.getElementById('undo').hidden), false,
       'Undo comes back with the changes it undoes');

    /* Tendai is still the one picked, from the tap above — so the switch has
       to bring the ways to add up on him there and then. Making somebody tap
       again to see what the button they just pressed does is the app asking
       to be understood before it will work. */
    check(await budCount(page) > 0,
          `every way to add is offered on whoever was already picked ` +
          `(${await budCount(page)} of them)`);
    is(await page.evaluate(() => document.querySelectorAll('.pod .rm[data-rm]').length), 1,
       'and the pod carries the way to take somebody out');

    await tap(page, 'p1');
    check(await budCount(page) > 0, 'and a fresh tap does the same');
  }

  section('and it is remembered, so nobody switches twice');
  {
    const again = await ctx.newPage();
    await again.goto(BASE, { waitUntil:'domcontentloaded' });
    await again.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
    await throughDoor(again);
    await again.waitForTimeout(300);
    is(await again.evaluate(() => helping), true, 'a new page on this device is still building');
    await again.close();
  }

  section('and going back to reading takes the tools down at once');
  {
    await page.click('#helping');
    await page.waitForTimeout(400);
    is(await budCount(page), 0, 'the buds that were on screen are gone');
    is(await page.evaluate(() => helping), false, 'and the mode is off');
  }

  section('A CARD IS THE WAY IN, FOR SOMEBODY WHO CAME TO READ AND FOUND A MISTAKE');
  /* Nobody should have to know there is a mode, let alone find the switch. */
  {
    await tap(page, 'p4');
    await page.click('#cAdd');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => helping), true, 'adding something starts the other job');
    check(await page.evaluate(() => {
            const d = document.querySelector('#form [data-fold="record"]');
            return !!(d && d.open);
          }), 'and the card opens on the record, which is what they came for');
    check(await page.$('#cName') !== null, 'with the fields there to type in');
    await page.evaluate(() => { closeForm(); setHelping(false); });
  }

  section('AND THE FIRST NAME OF A FAMILY IS SOMEBODY BUILDING ONE');
  /* Asking them to find a switch before the tree will grow would be the app
     holding the door shut on the one person who is definitely coming in. */
  {
    const fresh = await ctx.newPage();
    fresh.on('pageerror', e => bad('page error', e.message));
    await fresh.goto(BASE, { waitUntil:'domcontentloaded' });
    await fresh.evaluate(() => { localStorage.clear(); });
    await fresh.goto(BASE, { waitUntil:'domcontentloaded' });
    await fresh.waitForSelector('#seedName', { timeout:5000 });
    is(await fresh.evaluate(() => helping), false, 'an empty family is nobody building yet');
    await fresh.fill('#seedName', 'Chaitezvi Musoni');
    await fresh.click('#seedGo');
    await fresh.waitForTimeout(600);
    is(await fresh.evaluate(() => helping), true, 'and planting the first name is');
    await fresh.close();
  }

  section('AND THE TOOLBAR STILL FITS A PHONE WITH BOTH OF THEM ON IT');
  /* Two more controls than it had, and this app has twice drawn a working
     control off the side of a phone — see test/browser/reach.js. */
  {
    for (const [W, H] of [[320, 700], [360, 740]]){
      const small = await open(ctx, 'p3', { width:W, height:H });
      await helpBuild(small);
      await small.waitForTimeout(300);
      const out = await small.evaluate(() =>
        [...document.querySelectorAll('#bar button')]
          .filter(b => { const r = b.getBoundingClientRect();
                         return r.width > 0 && (r.left < 0 || r.right > innerWidth); })
          .map(b => b.textContent.trim()));
      is(out, [], `${W}px: every toolbar button is on the screen while building`);
      const cut = await small.evaluate(() =>
        [...document.querySelectorAll('#bar button')]
          .filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim()));
      is(cut, [], `${W}px: and none of them is cut off mid-word`);
      await small.close();
    }
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
