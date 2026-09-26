// READING IT AT ARM'S LENGTH.
//
// "Replace tiny controls. From the handover, .mini actions are currently
//  around 26px. For important actions, I'd increase these substantially,
//  especially on mobile. Elder Mode: large text, ~44px tap targets."
//
// The whole interface is built on six type sizes, the largest of which is
// eighteen pixels. That is a scale chosen for somebody holding a phone at
// reading distance with good eyes, and this app is for families — which means
// it is for grandmothers, and for the grandchild who hands them the phone to
// ask who somebody is.
//
// ONE SWITCH, AND IT MOVES THE SCALE. Every size in this interface is one of
// six tokens and every control is set from them, so a bigger reading is six
// numbers: the hierarchy holds, the proportions hold, and nothing can be
// missed. That is the whole argument for having had a scale.
//
// AND FORTY-FOUR PIXELS, which is the size a finger is. Type alone does not
// get you there — a bigger word in the same padding is a bigger word in a
// small target — so this file measures the real boxes on a real phone-width
// screen and names anything that is still under it.
//
// IT IS NOT CALLED ELDER MODE ON THE SCREEN. The request's name is right
// about who asked for it and is not a label to put on a person; the same
// switch is for anybody reading in the sun, or without their glasses. It says
// what it does.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser bigger
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

/* Everything a finger has to find. Measured off the page rather than read out
   of the stylesheet: a rule that sets a floor and a selector that misses the
   control are the same thing on screen, and only one of them is visible in
   the CSS. */
const PRESSABLE = '.btn, .seg button, #bar button, #top .set button, ' +
                  '#form .found .mini, #form .join .mini, .bud, #door .way, ' +
                  '.linkbtn, #litbar .pill button, #litbar .chip button';
const tooSmall = page => page.evaluate(sel =>
  [...document.querySelectorAll(sel)]
    .filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; })
    .map(e => ({ what:e.textContent.trim().slice(0, 24),
                 h:Math.round(e.getBoundingClientRect().height) })), PRESSABLE);

const typeOf = page => page.evaluate(() => {
  const v = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  return ['--t-mark', '--t-note', '--t-read', '--t-act', '--t-name', '--t-head']
    .map(n => parseFloat(v(n)));
});

const open = async (ctx, size, W, H) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  if (W) await page.setViewportSize({ width:W, height:H });
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, s]) => {
    localStorage.setItem('muti-baobab-v1', f);
    localStorage.setItem('muti-baobab-me', 'p3');
    if (s) localStorage.setItem('muti-baobab-size', s);
    else localStorage.removeItem('muti-baobab-size');
  }, [FAMILY, size || '']);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:390, height:800 } });
  await onlyThisOrigin(ctx);

  section('THE SCALE MOVES, AND STAYS A SCALE');
  {
    const small = await open(ctx, '');
    const ordinary = await typeOf(small);
    await small.close();
    const page = await open(ctx, 'big');
    const bigger = await typeOf(page);

    is(ordinary, [9, 10.5, 12, 13.5, 15, 18], 'the six sizes are the six sizes');
    check(bigger.every((v, i) => v > ordinary[i]),
          'every one of them goes up: ' + JSON.stringify(bigger));
    check(bigger.every((v, i) => i === 0 || v > bigger[i - 1]),
          'and they are still in order, so the hierarchy holds');
    /* The claim the tokens exist to make: one switch, not a list of places. */
    check(bigger[5] / ordinary[5] > 1.2 && bigger[2] / ordinary[2] > 1.2,
          'and the change is worth making — a third larger, not a nudge');
    await page.close();
  }

  section('AND NOTHING A FINGER HAS TO FIND IS UNDER FORTY-FOUR PIXELS');
  /* On a phone, and in each of the places this app puts controls. */
  {
    for (const [W, H] of [[390, 800], [320, 700]]){
      const page = await open(ctx, 'big', W, H);
      await page.waitForTimeout(500);

      is(await tooSmall(page), [], `${W}px: the door`);
      await throughDoor(page);
      await page.waitForTimeout(400);
      is(await tooSmall(page), [], `${W}px: the tree and its toolbar`);

      await page.click('.pod[data-id="p4"]');
      await page.waitForTimeout(600);
      is(await tooSmall(page), [], `${W}px: a person's card`);

      await page.evaluate(() => { closeForm(); openFind(); });
      await page.waitForSelector('#findQ', { timeout:5000 });
      await page.type('#findQ', 'Tendai', { delay:20 });
      await page.waitForTimeout(400);
      is(await tooSmall(page), [], `${W}px: a result, with Ona hukama on it`);

      await page.evaluate(() => { closeForm(); openKinship(); });
      await page.waitForTimeout(400);
      is(await tooSmall(page), [], `${W}px: the kinship panel`);

      await page.evaluate(() => { closeForm(); openLook(); });
      await page.waitForTimeout(400);
      is(await tooSmall(page), [], `${W}px: Look, where the switch itself is`);

      await page.evaluate(() => closeForm());
      await helpBuild(page);
      await page.click('.pod[data-id="p4"]');
      await page.waitForTimeout(700);
      is(await tooSmall(page), [], `${W}px: and every bud, while building`);
      await page.close();
    }
  }

  section('THE SWITCH IS WHERE SOMEBODY WHO NEEDS IT CAN READ IT');
  /* Near the top of Look rather than under the palettes: somebody who cannot
     read the panel cannot scroll to the thing that would let them. */
  {
    const page = await open(ctx, '');
    await throughDoor(page);
    await page.evaluate(() => openLook());
    await page.waitForSelector('#lookSize', { timeout:5000 });
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('#form .lbl')].map(e => e.textContent.trim()));
    check(order.indexOf('How big') <= 2,
          'it is among the first things in the panel: ' + JSON.stringify(order));
    is(await page.evaluate(() =>
         [...document.querySelectorAll('#lookSize button')].map(b => b.textContent.trim())),
       ['Ordinary', 'Bigger'], 'and says what it does rather than who it is for');

    await page.click('#lookSize button:last-child');
    await page.waitForTimeout(600);
    is(await page.evaluate(() => document.documentElement.dataset.size), 'big',
       'pressing it takes effect at once');
    const after = await typeOf(page);
    check(after[4] > 15, `and the words really are bigger (${after[4]}px names)`);
    await page.close();
  }

  section('and it is remembered, because eyesight does not change between visits');
  {
    const again = await ctx.newPage();
    await again.goto(BASE, { waitUntil:'domcontentloaded' });
    await again.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
    is(await again.evaluate(() => document.documentElement.dataset.size), 'big',
       'a new page on this device opens bigger');
    await again.close();
  }

  section('AND THE TREE IS SPACED FOR THE NAMES IT IS ACTUALLY DRAWING');
  /* The pods are cleared by a measured height, not a constant — see
     test/browser/standing.js, which exists because a constant that meant
     something else put one name on top of another. Bigger type makes bigger
     pods, and a layout that kept the old measurement would do it again. */
  {
    const page = await open(ctx, 'big', 1280, 950);
    await throughDoor(page);
    await page.evaluate(() => fit());
    await page.waitForTimeout(700);
    const seen = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('.pod')]
        .map(e => e.getBoundingClientRect().height / pos.k);
      return { tallest:Math.round(Math.max(...hs)), POD_TALL };
    });
    check(seen.POD_TALL >= seen.tallest,
          `the clearance is at least the pod (${seen.POD_TALL} for ${seen.tallest})`, seen);

    const over = await page.evaluate(() => {
      const P = layout.persons, ids = Object.keys(P), out = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++)
        if (Math.abs(P[ids[i]].x - P[ids[j]].x) < POD_W - 2 &&
            Math.abs(P[ids[i]].y - P[ids[j]].y) < POD_TALL - 2)
          out.push([state.people[ids[i]].name, state.people[ids[j]].name]);
      return out;
    });
    is(over, [], 'and nobody is standing on anybody at this size either');
    await page.close();
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
