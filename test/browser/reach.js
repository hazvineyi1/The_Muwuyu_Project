// Everything you can press is on the screen.
//
// Not a layout test. Every fault in this file was the same fault: a control
// that exists, works, and is drawn past the edge of a phone — which is worse
// than a missing feature, because nothing anywhere says it is there.
//
// TWO OF THEM, and both were invisible on a laptop, which is where they were
// being looked at.
//
//   THE TOOLBAR was pinned to the left with no right edge and no width, so
//   it grew to whatever its words came to — 476px — and carried on past the
//   side of the screen. Every phone lost Look, which is where dark mode, the
//   palette and how much of the tree live. A 320px screen lost This family
//   too, and that is the door to everything the app does that is not adding
//   a person: what the others have done, where it can grow, kinship, words,
//   mitupo, other families, start again. Half the app, behind two buttons
//   that could not be reached.
//
//   THE BUDS — the whole set of things you can do with a person — went off
//   the side on a 320px screen. A pod is 108 wide there and the column is
//   190, so neither side had room; the placer weighs off-screen at a hundred
//   a bud, found nothing better on either side, and put all six past the
//   edge. Held on screen they slide in until they fit, over the tree if they
//   must, because a bud is drawn above the tree and still takes the tap
//   while a bud past the edge takes nothing.
//
// The widths are the ones people hold: 320 is the small iPhone and plenty of
// older Android, 360 is the commonest Android, 390 and 414 the current
// iPhones. 1280 is here to prove nothing changed where there was room.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser reach
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const WIDTHS = [[320, 700], [360, 740], [390, 740], [414, 896], [1280, 900]];

const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900', root:true },
    p2:{ id:'p2', name:'Sydney Musoni',    sex:'m', totem:'Mwendamberi', born:'1938' },
    p3:{ id:'p3', name:'Musekiwa Musoni',  sex:'m', born:'1968' },
    p4:{ id:'p4', name:'Rudo Nyamayaro',   sex:'f', totem:'Nzou', born:'1972' },
    p5:{ id:'p5', name:'Tinashe Musoni',   sex:'m', born:'1996' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1'], children:['p2'] },
    u2:{ id:'u2', partners:['p2'], children:['p3'] },
    u3:{ id:'u3', partners:['p3','p4'], children:['p5'] }
  },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  for (const [W, H] of WIDTHS){
    section(`${W}×${H}`);
    const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
    await onlyThisOrigin(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => bad(`page error at ${W}px`, e.message));

    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                               localStorage.setItem('muti-baobab-me', 'p3'); }, FAMILY);
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => { try { return people().length === 5; } catch(e){ return false; } });
    await page.waitForTimeout(500);

    // ── the toolbar ─────────────────────────────────────────────────────
    const bar = await page.evaluate(() => {
      const el = document.getElementById('bar');
      const r = el.getBoundingClientRect();
      const out = [...el.querySelectorAll('button')].filter(b => {
        const q = b.getBoundingClientRect();
        return q.width > 0 && (q.left < 0 || q.right > innerWidth);
      }).map(b => (b.textContent || '').trim());
      return { right:Math.round(r.right), bottom:Math.round(r.bottom), out,
               n:el.querySelectorAll('button').length };
    });
    is(bar.out, [], `every one of the ${bar.n} toolbar buttons is on the screen`);
    check(bar.right <= W, 'and the bar itself does not run off the side',
          { right:bar.right, screen:W });

    // ── the line that says who is picked ────────────────────────────────
    /* It is placed against the toolbar, and the toolbar is a different
       height on a phone, where it wraps. A number here instead of a
       measurement put this line straight on top of Find and Undo. */
    await page.evaluate(() => { sel = 'p3'; render(); });
    await page.waitForTimeout(400);
    const lit = await page.evaluate(() => {
      const l = document.getElementById('litbar'), b = document.getElementById('bar');
      if (!l || l.hidden) return null;
      const a = l.getBoundingClientRect(), c = b.getBoundingClientRect();
      return { over: a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom,
               onScreen: a.left >= 0 && a.right <= innerWidth && a.top >= 0 };
    });
    check(lit && !lit.over, 'the picked line clears the toolbar rather than sitting on it', lit);
    check(lit && lit.onScreen, 'and is on the screen', lit);

    // ── the buds ────────────────────────────────────────────────────────
    /* Every person in the tree, not one: the placer's answer depends on
       who is around them, and the 320px failure was every person. */
    const budsOff = await page.evaluate(async () => {
      const out = [];
      for (const p of people()){
        sel = p.id; render(); revealBuds();
        await new Promise(r => setTimeout(r, 260));
        const off = [...document.querySelectorAll('#buds .bud')].filter(e => {
          const q = e.getBoundingClientRect();
          return q.left < 0 || q.right > innerWidth;
        }).map(e => e.dataset.bud);
        if (off.length) out.push({ who:p.name, off });
      }
      return out;
    });
    is(budsOff, [], 'no bud on anybody in the tree is drawn past the edge');

    await ctx.close();
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
