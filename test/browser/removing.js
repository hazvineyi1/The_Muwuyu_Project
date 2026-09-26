// Removing somebody for good, in a real browser.
//
// "Deletion of a person should require a passcode. Edits can be made to dates
//  and relationships but deletions can only be done with the passcode."
//
// The gate itself is asserted headlessly in test/passcode.test.js — that is
// where "no code", "wrong code" and "a thousand guesses" are proved to leave
// the person in Postgres. What can only be checked here is the half the
// family actually meets:
//
//   · the ✕ on a pod asks for the passcode instead of removing somebody,
//   · a wrong code takes nobody off the screen, so a mistyped digit does not
//     make a relative vanish and reappear in front of everyone,
//   · the right code removes them and the removal reaches Postgres,
//   · and correcting a year still needs nothing at all, which is the line
//     the whole rule is about.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs and gives it a delete passcode — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser removing

const { chromium } = require('playwright');
const { EXE, openApp, ready, saved, helpBuild } = require('./lib.js');

const CODE = process.env.MW_DELETE_PASSCODE || 'browser-delete-code';

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + d : '')); };
const is  = (a, b, m) => a === b ? ok(m) : bad(m, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const section = t => console.log('\n' + t);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const { ctx, page } = await openApp(browser);
  await ready(page);

  // A family, grown the way the app grows one: everybody off somebody.
  await page.evaluate(() => {
    const gf = addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
    const dad = grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
    grow('child', dad, 'Bertha Musoni', 'f', '', { born:'1969' });
    grow('child', dad, 'Tendai Musoni', 'm', '', { born:'1971' });
    save();
  });
  await saved(page);
  /* Deleting is the building half of the app — see helpBuild. Pressed after
     the family exists, because the toolbar it lives in is not on screen while
     the tree is empty. */
  await helpBuild(page);

  const idOf = name => page.evaluate(
    n => (people().find(p => p.name.indexOf(n) === 0) || {}).id, name);
  const inTree = name => page.evaluate(
    n => people().some(p => p.name.indexOf(n) === 0), name);
  const inPostgres = async name => {
    const id = await page.evaluate(() => treeId);
    return page.evaluate(async ([t, n]) => {
      const r = await fetch(`/api/tree/${t}/tree`, { headers:{ Accept:'application/json' } });
      const d = await r.json();
      return (d.people || []).some(p => (p.name || '').indexOf(n) === 0);
    }, [id, name]);
  };

  is(await inTree('Tendai'), true, 'Tendai is in the tree to begin with');

  section('THE ✕ ASKS FOR THE PASSCODE INSTEAD OF REMOVING ANYBODY');
  const tendai = await idOf('Tendai');
  // The ✕ is only drawn on the pod that is picked — see render().
  await page.evaluate(id => { sel = id; render(); }, tendai);
  await page.click(`.pod[data-id="${tendai}"] .rm[data-rm="${tendai}"]`);
  const asked = await page.waitForSelector('#dpCode', { timeout: 10000 }).catch(() => null);
  is(!!asked, true, 'a passcode is asked for');
  is(await inTree('Tendai'), true, 'and nobody has been taken off the screen yet');

  const words = await page.textContent('#form');
  is(/cannot be put right/i.test(words), true,
     'it says why: the one act that cannot be put right');
  is(/[Ss]et aside/.test(words), true,
     'and points at the reversible door, which needs no passcode');

  section('A WRONG CODE REMOVES NOBODY');
  await page.fill('#dpCode', '0000');
  await page.click('#dpGo');
  await page.waitForFunction(
    () => /not the passcode|Too many/i.test(
      (document.getElementById('dpWhy') || {}).textContent || ''), null, { timeout: 10000 });
  ok('the panel says so, in the panel, without closing');
  is(await inTree('Tendai'), true, 'Tendai is still on the screen');
  is(await page.inputValue('#dpCode'), '', 'and the field is cleared to be typed again');

  section('THE RIGHT ONE REMOVES THEM, AND IT REACHES POSTGRES');
  await page.fill('#dpCode', CODE);
  await page.click('#dpGo');
  await page.waitForFunction(() => !document.getElementById('dpCode'), null, { timeout: 10000 });
  ok('the panel closes');
  await page.waitForFunction(
    n => !people().some(p => p.name.indexOf(n) === 0), 'Tendai', { timeout: 10000 });
  ok('Tendai is off the screen');

  /* The delete is held for a few seconds so it can be undone. Forcing the
     window shut is what a relative does by simply carrying on. */
  await page.evaluate(() => { closeDeleteWindow(); });
  await saved(page);
  is(await inPostgres('Tendai'), false, 'and gone from the tree the server holds');
  is(await inPostgres('Bertha'), true, 'while their sister is untouched');

  section('CORRECTING A YEAR STILL NEEDS NOTHING AT ALL');
  const bertha = await idOf('Bertha');
  await page.evaluate(id => {
    const p = state.people[id];
    p.born = '1968';
    save();
  }, bertha);
  await saved(page);
  is(await page.$('#dpCode'), null, 'no passcode was asked for');
  const year = await page.evaluate(async ([t, id]) => {
    const r = await fetch(`/api/tree/${t}/tree`, { headers:{ Accept:'application/json' } });
    const d = await r.json();
    return ((d.people || []).find(p => p.id === id) || {}).born;
  }, [await page.evaluate(() => treeId), bertha]);
  is(year, '1968', 'and the correction is in Postgres');

  await ctx.close();
  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
