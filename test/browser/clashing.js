// A clash takes the clash, not the afternoon.
//
// "I am adding a name and it is not showing up."
//
// Sent with a photograph of the bar reading "Two of you edited the same
// person at once, so nothing was overwritten. The tree has been refreshed —
// please make your change again."
//
// Every word of that was true and it hid what had actually happened. A batch
// is everything this page has not sent yet: four names typed into four buds
// and one date corrected on a card travel together, and if the date clashes
// the server refuses all five. Refusing all five is right — a batch that
// half-applies is the worse failure. What was wrong was the page's answer to
// it: re-read the tree, which threw the four names away with the date, and
// say "please make it again" as though one small thing had gone. Four
// relatives, typed in and gone, with no list of what they were.
//
// A name that has never been saved cannot clash with anybody. It has no
// version to be stale and the server has never heard of it. So the tree is
// re-read, those names go straight back on top of it, and only the edit to
// the record somebody else had touched is lost — and that one is named.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... APP_PASSPHRASE=whatever \
//     NODE_PATH=$(npm root -g) npm run test:browser clashing
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, openApp, enter, ready, saved } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const names = page => page.evaluate(() => people().map(p => p.name).sort());
const banner = page => page.evaluate(() => {
  const e = document.getElementById('others');
  return e && !e.hidden ? e.textContent.trim() : null;
});

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const a = await openApp(browser, { viewport:{ width:1280, height:900 } });
  a.page.on('pageerror', e => bad('page error in the first tab', e.message));
  await ready(a.page);

  await a.page.evaluate(() => {
    const gf  = addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
    const dad = grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
    const me  = grow('child', dad, 'Musekiwa Musoni', 'm', '', { born:'1968' });
    setMe(me); save();
  });
  await saved(a.page);

  /* The second relative, in the same family. Two people filling in one tree
     at once is the normal case in this project, not the exotic one. */
  const b = await a.ctx.newPage();
  b.on('pageerror', e => bad('page error in the second tab', e.message));
  await enter(b, BASE);
  await ready(b);
  await b.waitForTimeout(600);

  /* B stops hearing about the tree. A form open is the everyday way this
     happens — the poller stands down while somebody is typing, which is
     right, and it is exactly what leaves B holding an old copy. */
  await b.evaluate(() => { pending = { kind:'card', anchorId:people()[0].id }; });

  await a.page.evaluate(() => {
    const s = people().find(p => /Sydney/.test(p.name));
    state.people[s.id].born = '1937'; save();
  });
  await saved(a.page);

  section('B TYPES THREE NAMES AND CORRECTS A DATE SOMEBODY ELSE HAS MOVED');
  await b.evaluate(() => {
    pending = null;
    const me = people().find(p => /Musekiwa/.test(p.name));
    grow('child',   me.id, 'Tinashe Musoni', 'm', '',     { born:'1996' });
    grow('child',   me.id, 'Anesu Musoni',   'f', '',     { born:'1999' });
    grow('partner', me.id, 'Rudo Nyamayaro', 'f', 'Nzou', { born:'1972' });
    const s = people().find(p => /Sydney/.test(p.name));
    state.people[s.id].totem = 'Shumba';      // the one that will clash
    save();
  });
  await b.waitForTimeout(3000);

  {
    const here = await names(b);
    for (const n of ['Tinashe Musoni', 'Anesu Musoni', 'Rudo Nyamayaro'])
      check(here.includes(n), `${n} is still on B's screen`, here);
    is(await b.evaluate(() => diffOps(synced, state).length), 0,
       'and nothing of B’s is left unsent');
  }

  section('and they reach the family, not just B’s screen');
  {
    await a.page.reload({ waitUntil:'domcontentloaded' });
    await ready(a.page);
    await a.page.waitForTimeout(900);
    const there = await names(a.page);
    for (const n of ['Tinashe Musoni', 'Anesu Musoni', 'Rudo Nyamayaro'])
      check(there.includes(n), `${n} is in the tree the server holds`, there);
  }

  section('while the edit that actually clashed is the one that is dropped');
  /* Not overwritten, not merged, not silently applied. A's change stands and
     B's is refused, which is the whole point of the version check. */
  {
    const sydney = await a.page.evaluate(() => {
      const s = people().find(p => /Sydney/.test(p.name));
      return { born:s.born, totem:s.totem };
    });
    is(sydney.born, '1937', 'the year the first tab set is the year that stands');
    is(sydney.totem, 'Mwendamberi', 'and the totem the second tab typed was not taken');
  }

  section('and B is told which person it was, and what was kept');
  /* "Please make your change again" is the sentence that lost the names. It
     named nobody and counted nothing, so it read as the app shrugging. */
  {
    const said = await banner(b);
    check(!!said, 'something is said where it can be seen');
    check(said && /Sydney Musoni/.test(said), 'naming the person somebody else was editing: ' +
          JSON.stringify(said));
    check(said && /3 names/.test(said), 'and saying the three names were kept');
    check(said && !/make it again|make your change again/.test(said),
          'and not asking for work back that was not lost');
  }

  await a.ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
