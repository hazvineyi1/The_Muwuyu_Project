// The buds around a selected person, and whether they land in order.
//
// "These don't show up in a very orderly manner, they need to be more
//  orderly."
//
// They did not, and the reason was that every bud found its own place. Each
// was given a list of preferred angles and walked a ring around the pod at
// four radii until it found a gap, so six buds landed at six unrelated angles
// and distances and no two edges lined up. A bud that found no gap swept the
// whole screen for the nearest free spot, which is how Child ended up under
// its own person and Sibling ended up beside somebody else's.
//
// It has to be a browser test. What is being asserted is where things
// actually came out — a column is only aligned if the widths the browser gave
// the words agree, and the whole fault was that the code's idea of how wide a
// bud is and the page's idea were different numbers.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser buds
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

/* A crowded middle and a corner, in one family. Lynn has a husband on one
   side and her brother on the other, which is the case the old placer could
   not do anything tidy with: the pods to the left and right of somebody ARE
   their brother and their husband, so a column that steps sideways to avoid
   one walks into the next. Anesu is at the edge of the canvas, where one side
   has no room at all. */
const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Noel Mufambisi Musoni', sex:'m', born:'1948', root:true },
    p2:{ id:'p2', name:'Chipo Musoni',   sex:'f', born:'1952' },
    p3:{ id:'p3', name:'Lynn Constance Musoni', sex:'f', born:'1978', totem:'Mhesvi' },
    p4:{ id:'p4', name:'Simon Acquaah',  sex:'m', born:'1975', totem:'Acquaah' },
    p5:{ id:'p5', name:'Tendekayi Moyo', sex:'f', born:'1980', totem:'Moyo' },
    p6:{ id:'p6', name:'Kudakwashe Musoni', sex:'m', born:'1979' },
    p7:{ id:'p7', name:'Anesu Musoni',   sex:'f', born:'2004' },
    p8:{ id:'p8', name:'Tanaka Musoni',  sex:'m', born:'2006' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1','p2'], children:['p3','p6'] },
    u2:{ id:'u2', partners:['p3','p4'], children:['p7','p8'] },
    u3:{ id:'u3', partners:['p6','p5'], children:[] }
  },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                             localStorage.setItem('muti-baobab-me', 'p3'); }, FAMILY);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 8; } catch(e){ return false; } });
  await page.waitForTimeout(500);

  // Every bud's real rectangle, as the browser laid it out.
  const budsOn = async who => {
    await page.evaluate(w => { sel = w; render(); revealBuds(); }, who);
    await page.waitForTimeout(400);
    return page.$$eval('#buds .bud', els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { kind:e.dataset.bud, l:Math.round(r.left), r:Math.round(r.right),
               t:Math.round(r.top), b:Math.round(r.bottom) };
    }));
  };
  const podOf = who => page.$eval(`.pod[data-id="${who}"]`, e => {
    const r = e.getBoundingClientRect();
    return { l:r.left, r:r.right, t:r.top, b:r.bottom };
  });
  const rowsOf = buds => [...new Set(buds.map(b => b.t))].sort((a, b) => a - b);
  const colsOf = buds => [...new Set(buds.map(b => b.l))].sort((a, b) => a - b);
  const overlapping = buds => {
    const out = [];
    for (let i = 0; i < buds.length; i++) for (let j = i + 1; j < buds.length; j++){
      const a = buds[i], c = buds[j];
      if (a.l < c.r && c.l < a.r && a.t < c.b && c.t < a.b) out.push(a.kind + '×' + c.kind);
    }
    return out;
  };

  // ── the crowded middle ────────────────────────────────────────────────
  section('BESIDE SOMEBODY WITH A HUSBAND ON ONE SIDE AND A BROTHER ON THE OTHER');
  {
    const buds = await budsOn('p3');
    is(buds.length >= 5, true, `${buds.length} buds offered`);
    is(overlapping(buds), [], 'no bud sits on another');

    /* THE LINES THEY STAND ON. Every bud shares a top edge with the others on
       its line — not nearly, exactly. Nine pixels out is the kind of
       almost-straight that reads as careless. */
    const rows = rowsOf(buds);
    is(rows.length <= 2, true, 'they stand on at most two lines: ' + rows.join(', '));
    for (const y of rows){
      const line = buds.filter(b => b.t === y);
      is(new Set(line.map(b => b.b)).size, 1,
         `the ${line.length} on line ${y} share a bottom edge too`);
    }

    /* AND THE EDGES THEY LINE UP ON. Three columns, each one as wide as its
       widest bud, so both of a column's vertical edges are straight. */
    const cols = colsOf(buds);
    is(cols.length <= 3, true, 'in at most three columns: ' + cols.join(', '));
    for (const x of cols){
      const col = buds.filter(b => b.l === x);
      is(new Set(col.map(b => b.r)).size, 1,
         `the ${col.length} in column ${x} share a right edge`);
    }
  }

  section('and none of them covers a person');
  {
    const buds = await budsOn('p3');
    const pods = await page.$$eval('.pod', els => els.map(e => {
      const r = e.getBoundingClientRect();
      return { id:e.dataset.id, l:r.left, r:r.right, t:r.top, b:r.bottom };
    }));
    const covered = buds.filter(b => pods.some(q =>
      b.l < q.r && q.l < b.r && b.t < q.b && q.t < b.b)).map(b => b.kind);
    is(covered, [], 'nobody is under a bud');
  }

  section('the middle of the grid stands on the same lines as the sides');
  {
    const buds = await budsOn('p4');           // he has no parents recorded
    const by = Object.fromEntries(buds.map(b => [b.kind, b]));
    is(!!by.parent, true, 'a Parent bud is offered, since nobody is above him');
    is(by.child.t, by.sibling.t, 'Child is level with Sibling');
    is(by.parent.t, by.join.t, 'and Parent with the door below it');
    const pod = await podOf('p4');
    const mid = b => Math.round((b.l + b.r) / 2), cx = Math.round((pod.l + pod.r) / 2);
    is(Math.abs(mid(by.child) - cx) <= 1, true, 'Child is centred on the pod');
    is(Math.abs(mid(by.parent) - cx) <= 1, true, 'and so is Parent');
  }

  section('AND AT THE EDGE OF THE CANVAS THEY BECOME ONE COLUMN');
  /* There is no room on one side of somebody at the edge, and the tidy answer
     is not to cram a column into it. All four go in a single aligned column
     on the side that has the room — and the old code's answer, half a column
     off the screen altogether, is the one thing that must never happen. */
  {
    const buds = await budsOn('p7');
    is(buds.every(b => b.l >= 0 && b.r <= 1280), true,
       'not one of them is off the screen: ' + JSON.stringify(buds.map(b => [b.l, b.r])));
    is(overlapping(buds), [], 'and none sits on another');
    const sides = buds.filter(b => b.kind !== 'child' && b.kind !== 'parent');
    is(new Set(sides.map(b => b.l)).size, 1, 'the four of them share a left edge');
    is(new Set(sides.map(b => b.r)).size, 1, 'and a right edge');
    const ys = sides.map(b => b.t).sort((a, b) => a - b);
    const steps = ys.slice(1).map((y, i) => y - ys[i]);
    is(new Set(steps).size, 1, 'evenly spaced: ' + steps.join(', '));
  }

  section('and the same person tapped twice gets the same picture twice');
  /* Nothing is placed by search any more, so this is arithmetic rather than a
     hope. It was not: the old placer's answer depended on the order it
     happened to find gaps in. */
  {
    const once = await budsOn('p3');
    await page.evaluate(() => { sel = null; render(); });
    await page.waitForTimeout(200);
    const twice = await budsOn('p3');
    is(twice, once, 'the same places, to the pixel');
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
