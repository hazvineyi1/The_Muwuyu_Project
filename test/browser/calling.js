// The word under a pod, and answering back to it.
//
// "How was this name generated and it should be editable or removable."
//
// test/calling.test.js holds the rules — where the guess comes from, what
// the three answers mean, and that they survive a trip to the server. This
// is the other half, and it has to be a browser test because what was
// reported was a thing on a screen: a gold pill wearing a word nobody typed,
// with nothing to press.
//
// So: is it a button, does pressing it explain itself, do the three answers
// come out on the tree, and does a word one relative typed still read the
// same after a reload. That last one is the whole difference between a
// caption and a preference.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... APP_PASSPHRASE=whatever \
//     NODE_PATH=$(npm root -g) npm run test:browser calling
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { EXE, openApp, ready, saved } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const { ctx, page } = await openApp(browser, { viewport:{ width:390, height:740 } });
  page.on('pageerror', e => bad('page error', e.message));
  await ready(page);

  /* Two lines and the marriage between them — the only arrangement that puts
     a caption on screen, since a tree of one family has nothing to tell
     apart. Nomhle married in; her mother's people are the Bolatiwa. */
  await page.evaluate(() => {
    const gf  = addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
    const dad = grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
    const mum = grow('partner', dad, 'Nomhle Mliswa', 'f', 'Shumba', { born:'1942' });
    const gm  = grow('parent', mum, 'Tsitsi Bolatiwa', 'f', 'Shumba', { born:'1915' });
    grow('partner', gm, 'Jairos Bolatiwa', 'm', 'Nzou', { born:'1910' });
    const me  = grow('child', dad, 'Musekiwa Musoni', 'm', '', { born:'1968' });
    setMe(me); save();
  });
  await saved(page);
  await page.evaluate(() => { draw(); fit(); });
  await page.waitForTimeout(400);

  /* Every caption on the tree, and whose pod each one is on. */
  const captions = () => page.$$eval('.pod .famname', els => els.map(e => ({
    word: e.textContent.trim(),
    on: e.closest('.pod').querySelector('.nm').textContent.trim()
  })));
  const panelText = () => page.evaluate(() =>
    (document.querySelector('#form') || { textContent:'' }).textContent.replace(/\s+/g, ' ').trim());

  section('THE WORD ON THE POD IS A BUTTON, AND SAYS WHERE IT CAME FROM');
  {
    const caps = await captions();
    check(caps.length > 0, `${caps.length} captions on the tree: ` +
                           caps.map(c => `${c.word} on ${c.on}`).join(', '));
    const role = await page.$eval('.pod .famname', e => ({
      role: e.getAttribute('role'), tab: e.getAttribute('tabindex'),
      cursor: getComputedStyle(e).cursor
    }));
    is(role.role, 'button', 'it is a button');
    is(role.tab, '0', 'and the keyboard can reach it');
    is(role.cursor, 'pointer', 'and it looks like one');
  }

  await page.click('.pod .famname');
  await page.waitForSelector('#hsName', { timeout:5000 });
  {
    const said = await panelText();
    check(/counted/.test(said) && /surname most of/.test(said),
          'the panel says the word was counted, not typed');
    check(/guess/.test(said), 'and calls it a guess');
    check(/Bolatiwa/.test(said), 'naming the word it worked out: ' +
          JSON.stringify(said.slice(0, 120)));
  }

  section('A FAMILY CAN SAY WHAT THEY CALL THEMSELVES');
  {
    await page.fill('#hsName', 'Bolatiwa of Mhondoro');
    await page.click('#hsGo');
    await saved(page);
    await page.waitForTimeout(300);
    const caps = await captions();
    check(caps.some(c => c.word === 'Bolatiwa of Mhondoro'),
          'the word they gave is on the tree: ' + JSON.stringify(caps));
  }

  section('and it is the family’s word, not this browser’s');
  /* The one that matters. A caption kept in localStorage would pass every
     assertion above and be invisible to every other relative. */
  {
    await page.reload({ waitUntil:'domcontentloaded' });
    await ready(page);
    await page.evaluate(() => { draw(); fit(); });
    await page.waitForTimeout(600);
    const caps = await captions();
    check(caps.some(c => c.word === 'Bolatiwa of Mhondoro'),
          'it is still there after a reload: ' + JSON.stringify(caps));
  }

  section('AND CAN ASK FOR NO WORD THERE AT ALL');
  /* Removable, which is the half a NOT NULL column could not hold: '' is an
     answer — "put nothing here" — and it has to survive as one. */
  {
    const before = (await captions()).length;
    await page.click('.pod .famname');
    await page.waitForSelector('#hsNone', { timeout:5000 });
    await page.click('#hsNone');
    await saved(page);
    await page.waitForTimeout(300);
    const caps = await captions();
    check(!caps.some(c => c.word === 'Bolatiwa of Mhondoro'),
          'that caption is gone: ' + JSON.stringify(caps));
    is(caps.length, before - 1, 'and only that one');

    await page.reload({ waitUntil:'domcontentloaded' });
    await ready(page);
    await page.evaluate(() => { draw(); fit(); });
    await page.waitForTimeout(600);
    const after = await captions();
    /* Tsitsi's pod, specifically. Jairos heads a DIFFERENT line that is also
       called Bolatiwa and that nobody has said anything about — it keeps its
       counted word, and it should. "Nothing here" is an answer about one
       side of the family, not a word struck off the tree. */
    check(!after.some(c => /^Tsitsi/.test(c.on)),
          'and her pod does not get the counted word back after a reload: ' +
          JSON.stringify(after));
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
