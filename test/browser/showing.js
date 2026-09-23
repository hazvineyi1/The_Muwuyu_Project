// Seeing that somebody was added, and seeing where.
//
// "There are glitches, for example, adding a person, and not being able to
//  see that the person has been added or where they have been added."
//
// Everything worked. The person went in, the tree redrew, and the app said
// so — into #live, which is an aria-live region one pixel square and clipped
// to nothing. Heard by a screen reader, seen by nobody. Meanwhile the view
// was PANNED to the new pod and never zoomed, so on the scale a phone lands
// on — fit() on a family of a dozen comes out near 0.25, where a pod is
// thirty-five pixels wide — what arrived on screen was a grey smudge at the
// margin. Both halves of "I can't see it" were true at once, and neither was
// a bug in the saving.
//
// So this file holds three things that are not about correctness at all:
//
//   the tree goes to a size a name can be read at, if it was smaller
//   the new person and every bud around them is inside the screen
//   the confirmation is somewhere a person's eyes are, and says whose
//   they are
//
// It runs on a phone, because that is the only place the fault appeared:
// a 1280px window has room for a column of buds beside a pod at any zoom,
// and 390px has not.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser showing
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const section = t => console.log('\n' + t);

const W = 390, H = 740;

/* Eleven people, which is enough that fit() on a phone comes out below the
   size a name can be read at — which is the whole condition being tested.
   Sydney's eight children are the row that makes it wide. */
const FAMILY = (() => {
  const people = {
    p1:{ id:'p1', name:'Chaitezvi Musoni', sex:'m', born:'1900', root:true },
    p2:{ id:'p2', name:'Sydney Musoni',    sex:'m', born:'1938' },
    p3:{ id:'p3', name:'Musekiwa Musoni',  sex:'m', born:'1968' }
  };
  const kids = ['p3'];
  const names = ['Bertha', 'Tapiwa', 'Farirai', 'Noel', 'Ida', 'Rudo', 'Grace', 'Tendai'];
  names.forEach((n, i) => {
    const id = 'k' + i;
    people[id] = { id, name:n + ' Musoni', sex:/Bertha|Ida|Rudo|Grace/.test(n) ? 'f' : 'm',
                   born:String(1970 + i) };
    kids.push(id);
  });
  return JSON.stringify({
    people,
    unions: { u1:{ id:'u1', partners:['p1'], children:['p2'] },
              u2:{ id:'u2', partners:['p2'], children:kids } },
    rootId:'p1', seq:40, notDuplicates:[], lexicon:{}
  });
})();

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                             localStorage.setItem('muti-baobab-me', 'p3'); }, FAMILY);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 11; } catch(e){ return false; } });
  /* THE LANDING FIRST, THEN THE WHOLE TREE. A page that knows who is looking
     opens ON them rather than on everything — so fit() has to be asked for
     after that has run its course, or it is simply undone half a second
     later and the test measures the landing instead of what it set up. */
  await page.waitForTimeout(900);
  await page.evaluate(() => { draw(); fit(); });
  await page.waitForTimeout(400);

  /* Add somebody the way a person does: tap them, tap the bud, type a name,
     press the button. Nothing here reaches past the page into the state,
     because the fault was entirely in what the page did AFTER the state was
     right. */
  const addChildOf = async (who, name) => {
    await page.evaluate(w => { sel = w; render(); }, who);
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.bud')].find(x => x.dataset.bud === 'child');
      if (b) b.click();
    });
    await page.waitForSelector('#fName', { timeout:5000 });
    await page.fill('#fName', name);
    await page.click('#fGo');
    await page.waitForTimeout(900);              // the glide is 450ms
  };

  const podOf = name => page.evaluate(n => {
    const p = people().find(q => q.name.indexOf(n) === 0);
    if (!p) return null;
    const el = document.querySelector(`.pod[data-id="${p.id}"]`);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { left:Math.round(r.left), right:Math.round(r.right),
             top:Math.round(r.top), bottom:Math.round(r.bottom),
             width:Math.round(r.width), k:+pos.k.toFixed(2),
             landed: el.classList.contains('landed') };
  }, name);

  const budBoxes = () => page.$$eval('#buds .bud', els => els.map(e => {
    const r = e.getBoundingClientRect();
    return { kind:e.dataset.bud, l:Math.round(r.left), r:Math.round(r.right),
             t:Math.round(r.top), b:Math.round(r.bottom) };
  }));

  const banner = () => page.evaluate(() => {
    const el = document.getElementById('others');
    if (!el || el.hidden) return null;
    const r = el.getBoundingClientRect();
    return { text:el.textContent.trim(), w:Math.round(r.width), h:Math.round(r.height) };
  });

  // ── the tree is drawn too small to read ───────────────────────────────
  section('ADDING SOMEBODY WHILE THE WHOLE TREE IS ON SCREEN AT ONCE');
  const before = await page.evaluate(() => +pos.k.toFixed(2));
  is(before < 0.6, true, `a phone fits eleven people at ${before} — under the readable scale`);

  await addChildOf('p3', 'Anotenda Musoni');
  const pod = await podOf('Anotenda');

  is(!!pod, true, 'the new person is drawn');
  is(pod.k >= 0.6, true, `the view went to a size a name can be read at (${pod.k})`);
  is(pod.width >= 80, true, `and the pod came out ${pod.width}px wide, not a smudge`);
  is(pod.left >= 0 && pod.right <= W && pod.top >= 56 && pod.bottom <= H - 74, true,
     'the new person is inside the screen, clear of both bars');
  is(pod.landed, true, 'and is ringed, so the words and the place agree');

  section('and every choice around them is reachable');
  /* This was the half that a pan alone could never fix. bringIntoView moves
     the pod to the margin and stops; the column of buds beside it then hangs
     off the edge, and a bud nobody can reach is not an offer. */
  {
    const buds = await budBoxes();
    is(buds.length >= 5, true, `${buds.length} buds offered`);
    const off = buds.filter(b => b.l < 0 || b.r > W || b.t < 0 || b.b > H).map(b => b.kind);
    is(off, [], 'none of them is off the screen');
  }

  section('and it is said where somebody can see it');
  /* say() is an announcement and nothing else — one pixel, clipped. This is
     the seeing half, and it names the parent as well as the child, because
     "where" is the question being asked. */
  {
    const said = await banner();
    is(!!said, true, 'a visible line, not only the announcement');
    is(said && said.w > 2 && said.h > 2, true, 'with a size on the screen');
    is(/Anotenda Musoni/.test(said.text) && /Musekiwa Musoni/.test(said.text), true,
       'naming who went in and whose they are: ' + JSON.stringify(said.text));
  }

  section('and the ring and the line both go, rather than staying for good');
  {
    await page.waitForTimeout(7200);
    const after = await podOf('Anotenda');
    is(after.landed, false, 'the ring is off');
    is(await banner(), null, 'and the line is gone');
  }

  // ── a tree already at a readable scale ────────────────────────────────
  section('AND WHERE THE TREE IS ALREADY BIG ENOUGH, IT DOES NOT JUMP');
  /* The old behaviour is the right one above the readable scale and is kept:
     the person you grew FROM holds their place on the screen, so the tree
     appears to grow around them. Zooming there would be the app taking the
     view away from somebody who had already chosen it.

     IN A WINDOW WITH ROOM, because holding still and putting the new buds on
     screen are two demands and a phone cannot always meet both. At 390px a
     column of buds beside a pod at 0.9 does not fit, so the view is nudged —
     deliberately, since a choice nobody can reach is not a choice. The claim
     being made here is about the zoom and the reflow, and it can only be
     measured where the nudge is not forced. */
  {
    const wide = await browser.newContext({ viewport:{ width:1280, height:900 } });
    await onlyThisOrigin(wide);
    const big = await wide.newPage();
    big.on('pageerror', e => bad('page error', e.message));
    await big.goto(BASE, { waitUntil:'domcontentloaded' });
    await big.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                              localStorage.setItem('muti-baobab-me', 'p3'); }, FAMILY);
    await big.goto(BASE, { waitUntil:'domcontentloaded' });
    await big.waitForFunction(() => { try { return people().length === 11; } catch(e){ return false; } });
    await big.waitForTimeout(900);
    /* Centred on them, with room on every side, so nothing has to be nudged
       and holding still is the only thing left for the view to do. */
    await big.evaluate(() => { sel = null; render(); focusOn('p3', 0.9); });
    await big.waitForTimeout(700);

    const at = name => big.evaluate(n => {
      const p = people().find(q => q.name.indexOf(n) === 0);
      const el = p && document.querySelector(`.pod[data-id="${p.id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left:Math.round(r.left), top:Math.round(r.top), k:+pos.k.toFixed(2),
               landed: el.classList.contains('landed') };
    }, name);

    const anchorBefore = await at('Musekiwa');
    await big.evaluate(() => { sel = 'p3'; render(); });
    await big.waitForTimeout(250);
    await big.evaluate(() => {
      const b = [...document.querySelectorAll('.bud')].find(x => x.dataset.bud === 'child');
      if (b) b.click();
    });
    await big.waitForSelector('#fName', { timeout:5000 });
    await big.fill('#fName', 'Ruvarashe Musoni');
    await big.click('#fGo');
    await big.waitForTimeout(900);

    const anchorAfter = await at('Musekiwa');
    is(Math.abs(anchorAfter.k - 0.9) < 0.01, true,
       `the scale somebody chose is left alone (${anchorAfter.k})`);
    is(Math.abs(anchorAfter.left - anchorBefore.left) <= 2 &&
       Math.abs(anchorAfter.top - anchorBefore.top) <= 2, true,
       'and the person grown from is where they were, to the pixel');
    const kid = await at('Ruvarashe');
    is(kid.landed, true, 'the new person is still ringed');
    const said = await big.evaluate(() => {
      const el = document.getElementById('others');
      return el && !el.hidden ? el.textContent.trim() : null;
    });
    is(!!said && /Ruvarashe Musoni/.test(said), true,
       'and still said where it can be seen: ' + JSON.stringify(said));
    await wide.close();
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
