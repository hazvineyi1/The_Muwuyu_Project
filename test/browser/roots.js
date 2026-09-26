// Rooting, in a real browser.
//
// The frontier logic is asserted headlessly in test/frontier.test.js. What
// cannot be asserted there is the part the family actually touches: that a
// rooted person is offered a way through rather than a dead end, that one tap
// lifts the root and asks for the parent, and that the Roots panel keeps
// declared roots and open ends visibly apart.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser roots
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
// The app opens on a door now; this presses the way through to the tree.
const { throughDoor, helpBuild } = require('./lib');

const BASE = process.env.MW_BASE_URL || 'http://127.0.0.1:3930/';
const EXE  = process.env.MW_CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let pass = 0, fail = 0;
const ok  = (m) => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + d : '')); };
const is  = (a, b, m) => a === b ? ok(m) : bad(m, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  /* ONLY THIS ORIGIN. The page asks Google for its fonts, the sandbox these
     suites run in cannot reach it, and a navigation that waits for that to
     time out costs more than the whole suite — which is what this one was
     doing: thirty seconds at the first goto and nothing after it. Every other
     suite here has had this line for a while. */
  await ctx.route('**', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  // A four-person line: Sekuru -> Baba -> Me, plus Amai married in with no
  // parents of her own. Sekuru is declared the root; Amai is an open end.
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(() => {
    const P = (id, name, sex, born, root) =>
      ({ id, name, sex, born, root: root || false });
    const state = {
      people: {
        p1: P('p1', 'Sekuru Chenjerai', 'm', '1920', true),
        p2: P('p2', 'Baba Tendai', 'm', '1950'),
        p3: P('p3', 'Amai Rudo', 'f', '1955'),
        p4: P('p4', 'Farai', 'm', '1980')
      },
      unions: {
        u1: { id: 'u1', partners: ['p1'], children: ['p2'] },
        u2: { id: 'u2', partners: ['p2', 'p3'], children: ['p4'] }
      },
      rootId: 'p4', seq: 9
    };
    localStorage.setItem('muti-baobab-v1', JSON.stringify(state));
  });
  await page.reload();
  await page.waitForFunction(() => { try { return people().length === 4; } catch (e) { return false; } });
  await throughDoor(page);
  // These drive the building half of the app — see helpBuild.
  await helpBuild(page);

  // ── the frontier split ────────────────────────────────────────────────
  const f = await page.evaluate(() => frontier());
  is(f.roots.map(r => r.name).join(','), 'Sekuru Chenjerai', 'Sekuru is the only declared root');
  is(f.open.map(r => r.name).join(','),  'Amai Rudo',        'Amai is the only open end');
  // "Below" counts descendants, not the household: Amai married in, she did
  // not come down from Sekuru. Baba and Farai are the line.
  is(f.roots[0].below, 2, 'two people below the root');
  is(f.roots[0].depth, 2, 'two generations deep');
  is(await page.evaluate(() => isOpenEnd('p2')), false, 'Baba has parents, so not an open end');
  is(await page.evaluate(() => isOpenEnd('p1')), false, 'a declared root is not an open end');

  // ── the deepen bud ────────────────────────────────────────────────────
  const budsOn = async (id) => {
    await page.evaluate(i => { sel = i; render(); revealBuds(); }, id);
    await page.waitForTimeout(120);
    return page.$$eval('#buds .bud', bs => bs.map(b => b.dataset.bud));
  };
  const rootBuds = await budsOn('p1');
  is(rootBuds.includes('deepen'), true,  'rooted person offers Deepen the root');
  is(rootBuds.includes('parent'), false, 'rooted person does not also offer Parent');
  const openBuds = await budsOn('p3');
  is(openBuds.includes('parent'), true,  'an open end offers Parent');
  is(openBuds.includes('deepen'), false, 'an open end offers no Deepen');
  const midBuds = await budsOn('p2');
  is(midBuds.includes('deepen'), false, 'somebody with parents offers no Deepen');
  is(midBuds.includes('parent'), true,  'and can still take a second parent');

  // ── one tap lifts the root and asks for the parent ────────────────────
  await budsOn('p1');
  await page.click('#buds .bud[data-bud="deepen"]');
  await page.waitForSelector('#form');
  is(await page.evaluate(() => state.people.p1.root), false, 'the tap lifted the root');
  const cap = (await page.textContent('#form .cap') || '').toLowerCase();
  is(/parent|before|father|mother/.test(cap), true, 'the parent form opened: ' + JSON.stringify(cap));
  // save() is debounced, so give it its window rather than racing it.
  const saved = await page.waitForFunction(
    () => JSON.parse(localStorage.getItem('muti-baobab-v1')).people.p1.root === false,
    null, { timeout: 3000 }).then(() => true, () => false);
  is(saved, true, 'the lift was saved');

  // Add the parent and check the tree actually deepened.
  await page.fill('#fName', 'Tateguru Nyika');
  await page.click('#fGo');
  await page.waitForTimeout(200);
  is(await page.evaluate(() => people().length), 5, 'the ancestor was added');
  is(await page.evaluate(() => isOpenEnd('p1')), false, 'p1 now has a parent');
  is(await page.evaluate(() => frontier().open.some(e => e.name === 'Tateguru Nyika')), true,
     'the new ancestor is now the open end');

  // ── where the tree stops, which is now half of where it can grow ──────
  /* THE PANEL THIS USED TO OPEN IS GONE, and gone on purpose. "Where the tree
     stops" listed the rooted lines and the open ends and then put you back on
     the tree to find them; the growth view marks them on the tree and answers
     them where they stand. The facts are the same facts, so they are still
     asserted — against the door they live behind now. */
  await page.evaluate(() => { state.people.p1.root = false; state.people.p3.root = true; render(); });
  await page.click('#hub');
  await page.waitForSelector('[data-room="grow"]', { timeout: 10000 });
  await page.click('[data-room="grow"]');
  await page.waitForSelector('#form', { timeout: 10000 });
  const panel = await page.textContent('#form');
  is(/Where it can grow/.test(panel), true, 'the view is titled');
  is(/As far back as anyone has traced/.test(panel) && /Amai Rudo/.test(panel), true,
     'Amai is listed as far back as anyone has traced');
  is(/The line stops here/.test(panel) && /Tateguru Nyika/.test(panel), true,
     'and Tateguru is where a line stops');
  is(/As far back as anyone has traced · 1/.test(panel), true,
     'with one of them, counted on the heading');

  /* AND ANSWERED WHERE IT STANDS, rather than sending somebody off to find
     the person: a root offers going further back, an open end offers saying
     the line is traced — both without leaving the list. */
  const acts = await page.$$eval('#form .grow1 .mini', bs => bs.map(b => b.textContent.trim()));
  is(acts.includes('Go further back…'), true,
     'a root offers going further back: ' + acts.join(' | '));

  // Showing one travels to that person, which is what tapping a row did.
  await page.click('#form [data-gsee="p3"]');
  await page.waitForTimeout(300);
  is(await page.evaluate(() => sel), 'p3', 'showing one selected the person');

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
