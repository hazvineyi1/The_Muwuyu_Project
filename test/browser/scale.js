// Does the page stay usable as a family gets large?
//
// THE THING THIS EXISTS TO CATCH. render() used to run the duplicate scan —
// every person against every other one, walking the unions inside each
// comparison — on every redraw. It is quadratic with a rescan inside, so it
// does not degrade, it falls off a cliff: measured on this tree, 200 people
// took a second per frame, 400 took five and a half, 800 took thirty-five.
//
// The scan now runs on the server, which blocks candidates into buckets, and
// the page paints a cached answer. This suite builds a family big enough for
// the old code to have been unusable and asserts that a redraw is quick — and
// prints what the old path would have cost on the same tree, so the number is
// a measurement rather than a claim.
//
// It also checks the feature still WORKS, which is the half a speed test
// forgets: a scan that finds nothing is very fast.
//
// AND WHAT THE ROOM IS FOR HAS NARROWED SINCE THIS WAS WRITTEN. The write door
// now folds conclusive duplicates by itself, so what reaches the room is
// everything the app declines to decide — which is what the planted pair is
// built to be. See plantedDuplicates.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser scale
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, openApp, ready, settled, saved } = require('./lib');

// Big enough that the old render path took seconds, small enough to build in
// a test. The cliff is steep: doubling this roughly quintuples the old cost.
const PEOPLE = 400;

// A redraw happens on every pan, zoom, selection and keystroke, so the budget
// is a frame's worth of room, not a page load's.
//
// IT WAS 400 AND IT WAS TOO LOOSE TO MEAN ANYTHING. A redraw of this tree
// measured 450–490 ms against it — over, and only just, which is the least
// useful place for a budget to sit: it flaps with the machine and it catches
// nothing. The cause was not the machine. unionsOf() and parentUnionOf() read
// every union in the tree and filtered it, once per question, and the
// questions are asked once per person — the same quadratic shape as the
// duplicate scan this whole suite was written about. The drawing indexes the
// shape once now and a redraw of this tree is 66–111 ms.
//
// So the number is what a redraw costs with room for a slower machine, rather
// than a ceiling nothing could hit. If this goes red, something is reading
// the whole family per person again.
const RENDER_BUDGET_MS = 250;

// The planted duplicate and everybody it needs around it: the two records of
// one woman, the husband they share, and the son recorded under each. See
// plantedDuplicates.
const PLANTED = 5;

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + d : '')); };
const is  = (a, b, m) => a === b ? ok(m) : bad(m, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const section = t => console.log('\n' + t);

/* A family of PEOPLE people in generations of eight, with a handful of
   deliberate duplicates planted in it — the same name entered twice with a
   title on one of them, which is the commonest way a real family produces
   one. Without those the scan would have nothing to find and a speed test
   would prove nothing. */
function buildOps(n, tag) {
  const NAMES = ['Chenjerai','Rufaro','Tendai','Garikai','Nyarai','Farai','Tapiwa',
                 'Chipo','Munashe','Tariro','Shingai','Rudo','Takudzwa','Anesu'];
  const ops = [];
  const ids = [];
  for (let i = 0; i < n; i++) {
    const ref = '$p' + i;
    ids.push(ref);
    ops.push({ op:'addPerson', ref, name: `${NAMES[i % NAMES.length]}${i} ${tag}`,
               sex: i % 2 ? 'f' : 'm', totem: 'Nzou', born: String(1900 + (i % 90)) });
  }
  /* Couples and their children, so the tree has real shape to walk rather
     than being a list — the union walking is half of what made it slow.

     ONE FAMILY, not four hundred strangers who happen to share a tree. Each
     couple's first name is a child of the couple before, so every union hangs
     off the one above it and the whole four hundred are reachable from the
     first. That is what a family looks like, and since "nobody goes in on
     their own" it is also the only shape the write door will take. */
  const unions = [];
  for (let i = 0; i + 1 < n; i += 2) {
    const uref = '$u' + unions.length;
    ops.push({ op:'addUnion', ref: uref });
    ops.push({ op:'addPartner', unionId: uref, personId: ids[i] });
    ops.push({ op:'addPartner', unionId: uref, personId: ids[i + 1] });
    // Each couple's first name is a child of a couple one generation up, two
    // children to a marriage. Generations of two rather than a single line:
    // eight deep and branching, which is the shape of a family and the shape
    // the drawing is measured against.
    if (unions.length) {
      ops.push({ op:'addChild',
                 unionId: unions[Math.floor((unions.length - 1) / 2)],
                 personId: ids[i] });
    }
    unions.push(uref);
  }
  return ops;
}

/* Two records of one woman: the same name, one of them carrying the title her
 * grandchildren would use, and both married to the same man — who is a son of
 * the family's first couple, because nobody goes in on their own.
 *
 * AND THEY HAVE A CHILD EACH, WHICH IS THE POINT. They used to have none, and
 * that made this pair CONCLUSIVE — the same name, the same year, the same
 * mutupo and nothing at all against. Since the write door started folding
 * conclusive pairs by itself, the app merged the planted duplicate on the way
 * in and this suite went looking for it in a room it was no longer in. So the
 * half of the test that checks the feature still works had been failing, and
 * for the most misleading reason there is: the app doing the job better than
 * the test expected.
 *
 * A son recorded under each copy is how this duplicate actually arises. Two
 * relatives write the same woman down, each knowing one of her children, and
 * neither sees the other's copy. It is also exactly the line between the two
 * behaviours: "different children recorded" counts AGAINST, and anything with
 * something against is never folded automatically, however strong the rest of
 * it looks. The pair stays very likely one person — the two are married to the
 * same man — so the room offers it and whoever knows decides, which is what
 * merging them would fix: her two sons would become brothers.
 *
 * That is now what this suite measures: the pairs the app declines to fold are
 * the pairs a family is asked about. */
function plantedDuplicates(tag) {
  return [
    { op:'addPerson', ref:'$dupA', name:`Ambuya Chiedza ${tag}`, sex:'f', totem:'Shava', born:'1931' },
    { op:'addPerson', ref:'$dupB', name:`Chiedza ${tag}`,        sex:'f', totem:'Shava', born:'1931' },
    { op:'addPerson', ref:'$hus',  name:`Mudhara Zvikomborero ${tag}`, sex:'m', totem:'Nzou', born:'1928' },
    { op:'addChild', unionId:'$u0', personId:'$hus' },
    { op:'addPerson', ref:'$son1', name:`Tafara ${tag}`, sex:'m', totem:'Nzou', born:'1955' },
    { op:'addPerson', ref:'$son2', name:`Nyasha ${tag}`, sex:'m', totem:'Nzou', born:'1958' },
    { op:'addUnion', ref:'$du1' },
    { op:'addPartner', unionId:'$du1', personId:'$hus' },
    { op:'addPartner', unionId:'$du1', personId:'$dupA' },
    { op:'addChild', unionId:'$du1', personId:'$son1' },
    { op:'addUnion', ref:'$du2' },
    { op:'addPartner', unionId:'$du2', personId:'$hus' },
    { op:'addPartner', unionId:'$du2', personId:'$dupB' },
    { op:'addChild', unionId:'$du2', personId:'$son2' }
  ];
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const { ctx, page } = await openApp(browser, { viewport:{ width:1280, height:960 } });
  page.on('pageerror', e => bad('page error', e.message));
  await ready(page);

  const TAG = 'Big' + Date.now().toString(36).slice(-5);

  section(`building a family of ${PEOPLE + PLANTED}`);
  // Its own family, so the numbers mean something and nobody else's tree gets
  // four hundred strangers in it.
  const made = await page.evaluate(async name => {
    const r = await fetch('/api/trees', {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name })
    });
    const d = await r.json();
    return { id: d.id, key: d.key };
  }, TAG + ' family');
  is(/^[0-9a-f-]{36}$/.test(made.id), true, 'a family to fill');

  const ops = buildOps(PEOPLE, TAG).concat(plantedDuplicates(TAG));
  // ONE batch, not several. A $ref is minted inside the batch that declares
  // it — that is what makes a batch all-or-nothing — so a union split from the
  // people it joins would be a union referring to names that no longer exist.
  await page.evaluate(async ([id, all]) => {
    const r = await fetch(`/api/tree/${id}/ops`, {
      method:'POST', headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ ops: all })
    });
    if (!r.ok) throw new Error('ops answered ' + r.status + ' ' + (await r.text()).slice(0, 200));
  }, [made.id, ops]);

  section('the page opens on it');
  await page.goto(BASE + '#/f/' + made.key, { waitUntil:'domcontentloaded' });
  await ready(page);
  await settled(page);
  const count = await page.evaluate(() => people().length);
  is(count, PEOPLE + PLANTED, `${count} people on the page`);

  section('A REDRAW IS QUICK');
  // Several, and the median: the first one after a load pays for layout that
  // has nothing to do with this.
  const times = await page.evaluate(() => {
    const runs = [];
    for (let i = 0; i < 7; i++) {
      const t = performance.now();
      render();
      runs.push(performance.now() - t);
    }
    return runs.sort((a, b) => a - b);
  });
  const median = times[3];
  console.log(`       renders (ms): ${times.map(t => t.toFixed(0)).join(' ')}`);
  is(median < RENDER_BUDGET_MS, true,
     `median redraw ${median.toFixed(0)}ms, under the ${RENDER_BUDGET_MS}ms budget`);

  section('and what the old path would have cost on this same tree');
  // duplicatePairs() is still there — it is the reference the server's blocked
  // scan is tested against. This calls it directly to measure what render()
  // used to do on every frame.
  const oldCost = await page.evaluate(() => {
    const t = performance.now();
    const n = duplicatePairs().length;
    return { ms: performance.now() - t, n };
  });
  console.log(`       the exhaustive scan: ${oldCost.ms.toFixed(0)}ms for ${oldCost.n} pairs`);
  /* AND BY A LONG WAY, which is the half of this that does not depend on how
     fast the machine is. Both numbers come from the same browser on the same
     tree in the same second, so the RATIO is a fact about the code — and the
     thing this suite exists to catch is quadratic work creeping back into a
     redraw, which would show up here as the gap closing long before any
     absolute budget noticed. It is ~280× as this is written. */
  is(oldCost.ms > median * 50, true,
     `it costs ${(oldCost.ms / Math.max(median, 0.01)).toFixed(0)}× a redraw — ` +
     `which is why it is not in one`);

  section('THE FEATURE STILL WORKS — a fast scan that finds nothing is not a fix');
  await page.waitForFunction(() => dupes && dupes.from === 'server', { timeout: 20000 });
  is(await page.evaluate(() => dupes.from), 'server', 'the answer came from the server');
  const likely = await page.evaluate(() => dupes.likely.length);
  is(likely >= 1, true, `${likely} likely duplicate(s) found`);

  /* THE DOOR CARRIES THE MARK. The duplicates used to be a chip of their own
     on the canvas; they are a room behind the hub now, and the count rides on
     the hub's mark with everything else waiting to be looked at. Opening the
     hub is how somebody reaches them, so it is how this reaches them. */
  is(await page.isVisible('#hubMark'), true, 'and the door is marked');
  await page.click('#hub');
  await page.waitForSelector('[data-room="dupes"]', { timeout: 10000 });
  is(/Possible duplicates · \d/.test(
       await page.textContent('[data-room="dupes"]')), true,
     'with the room behind it saying how many');

  section('the planted pair is the one it found');
  await page.click('[data-room="dupes"]');
  await page.waitForSelector('#form .pair', { timeout: 10000 });
  const panel = await page.textContent('#form');
  is(/Chiedza/.test(panel), true, 'the woman entered twice is named');
  is(/Very likely one person/.test(panel), true,
     'and called likely — on the shared husband, not on the name');
  is(/both married to/.test(panel), true, 'with the reason given');

  section('the panel opens from a cache, so it opens at once');
  await page.click('#dNo');
  const openMs = await page.evaluate(async () => {
    const t = performance.now();
    openDuplicates();
    return performance.now() - t;
  });
  console.log(`       opening the panel: ${openMs.toFixed(0)}ms`);
  is(openMs < 500, true, `${openMs.toFixed(0)}ms — it reads, it does not scan`);
  await page.click('#dNo');

  section('an edit makes the answer stale, and it is asked again');
  await page.evaluate(() => { dupes = { pairs:[], likely:[], from:'stale', scanning:false, tooBig:false }; });
  /* GROWN OFF SOMEBODY, not planted on its own. This used to call addPerson()
     and save() — a name joined to nothing, which the write door refuses now,
     so the page rolled it straight back and the edit never reached the server
     at all. The assertion below still passed, because a refresh moves the
     scan's answer to 'server' whether or not anything was written: a test
     proving nothing while reporting a pass. */
  const before = await page.evaluate(() => people().length);
  await page.evaluate(t => {
    const dad = people().find(p => p.name.startsWith('Mudhara Zvikomborero'));
    grow('child', dad.id, 'Someone Else ' + t, 'm', 'Nzou', { born:'1970' });
    save();
  }, TAG);
  await saved(page);
  is(await page.evaluate(() => people().length), before + 1,
     'the edit was actually recorded');
  await page.waitForFunction(() => dupes.from === 'server', { timeout: 20000 });
  is(await page.evaluate(() => dupes.from), 'server', 'the scan ran again after the edit');
  is(await page.evaluate(() => dupes.likely.length) >= 1, true,
     'and still finds the pair');

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
