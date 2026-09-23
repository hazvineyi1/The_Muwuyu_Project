// What happens when the connection goes, which on a phone is not an error.
//
// "Identify glitches that may make it hard for users to progress."
//
// Every failure to reach the server used to stall the page: one catch, one
// store = 'stalled', and from that moment nothing is sent and nothing more
// will be until somebody notices the banner and reloads — losing whatever
// they had typed since.
//
// On the phone this app is actually used on, a dropped request is not an
// error condition. It is a lift, a tunnel, a bus, a signal that comes and
// goes all afternoon. Treating one of those like a broken tree turns an
// ordinary two seconds into "nothing will be saved", and a family retypes an
// entry that was never lost.
//
// This suite takes the network away mid-edit and asserts the four things a
// relative needs: the app says so, it keeps their work, it keeps ACCEPTING
// work, and it catches up by itself when the signal returns.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser connection

const { chromium } = require('playwright');
const { BASE, EXE, PASSPHRASE, onlyThisOrigin, ready, saved } = require('./lib.js');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + d : '')); };
const is  = (a, b, m) => a === b ? ok(m) : bad(m, `expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
const check = (c, m, d) => c ? ok(m) : bad(m, d ? String(d) : '');
const section = t => console.log('\n' + t);

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:430, height:860 } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  if (await page.$('input[name="passphrase"]')){
    await page.fill('input[name="passphrase"]', PASSPHRASE);
    await Promise.all([page.waitForNavigation({ waitUntil:'domcontentloaded' }).catch(()=>{}),
                       page.click('button[type="submit"]')]);
  }
  await ready(page);

  await page.evaluate(() => {
    const gf = addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
    const dad = grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
    setMe(grow('child', dad, 'Musekiwa Musoni', 'm', '', { born:'1968' }));
    save();
  });
  await saved(page);
  const tree = await page.evaluate(() => treeId);
  is(await page.evaluate(() => people().length), 3, 'a family to work on');

  section('THE CONNECTION GOES WHILE SOMEBODY IS TYPING');
  await ctx.route('**/api/**', r => r.abort());
  await page.evaluate(() => {
    const p = people().find(x => /Chaitezvi/.test(x.name));
    state.people[p.id].born = '1899';
    save();
  });
  await page.waitForTimeout(3000);

  const held = await page.evaluate(() => ({
    store,
    shown: !document.getElementById('stalled').hidden,
    says: document.getElementById('stalled').textContent.replace(/\s+/g, ' ').trim(),
    unsent: (() => { try { return diffOps(synced, state).length; } catch (e) { return -1; } })()
  }));

  is(held.shown, true, 'the page says something is wrong');
  is(/waiting for the connection/i.test(held.says), true,
     'and calls it what it is — a connection, not a broken tree');
  is(/nothing is lost|needs typing again/i.test(held.says), true,
     'saying the work is safe, which is the sentence that stops somebody retyping it');
  is(held.store, 'shared', 'it has NOT given up on the tree');
  is(held.unsent >= 1, true, `their change is held rather than dropped (${held.unsent})`);

  section('and it keeps taking work while the signal is away');
  /* The old stall refused every later save silently: the name went on the
     screen and nowhere else. */
  await page.evaluate(() => {
    const p = people().find(x => /Sydney/.test(x.name));
    state.people[p.id].born = '1937';
    save();
  });
  await page.waitForTimeout(1200);
  const more = await page.evaluate(() =>
    ({ unsent: diffOps(synced, state).length, store }));
  is(more.unsent >= 2, true, `a second change is held too (${more.unsent})`);
  is(more.store, 'shared', 'and it is still not stalled');

  section('AND IT CATCHES UP BY ITSELF WHEN THE SIGNAL COMES BACK');
  await ctx.unroute('**/api/**');
  /* The backoff would get there on its own; this is the "Try now" button,
     which is the same thing without the wait. */
  await page.evaluate(() => { clearTimeout(holdTimer); holdFor = 1000; flush(); });
  await page.waitForTimeout(3500);

  const back = await page.evaluate(() => ({
    store,
    unsent: (() => { try { return diffOps(synced, state).length; } catch (e) { return -1; } })(),
    shown: !document.getElementById('stalled').hidden
  }));
  is(back.store, 'shared', 'the tree is in hand again');
  is(back.unsent, 0, 'nothing is left waiting');
  is(back.shown, false, 'and the notice takes itself down');

  const landed = await page.evaluate(async t => {
    const r = await fetch(`/api/tree/${t}/tree`, { headers:{ Accept:'application/json' } });
    const d = await r.json();
    const by = n => ((d.people || []).find(p => new RegExp(n).test(p.name)) || {}).born;
    return { gf: by('Chaitezvi'), dad: by('Sydney') };
  }, tree);
  is(landed.gf, '1899', 'the first change reached Postgres');
  is(landed.dad, '1937', 'and so did the one made while the signal was away');

  section('a real refusal still stalls, because that one will not fix itself');
  {
    /* The distinction this rests on. A 500 is the server answering, and
       answering badly; waiting for it to heal would be waiting for ever with
       a page that looks fine. */
    await ctx.route('**/ops', r => r.fulfill({ status:500, body:'no' }));
    await page.evaluate(() => {
      const p = people().find(x => /Musekiwa/.test(x.name));
      state.people[p.id].born = '1969';
      save();
    });
    await page.waitForTimeout(2500);
    const stalled = await page.evaluate(() => ({
      store, says: document.getElementById('stalled').textContent.replace(/\s+/g,' ').trim()
    }));
    is(stalled.store, 'stalled', 'a server that answers badly does stall the page');
    is(/could not be saved/i.test(stalled.says), true, 'and says so plainly');
    await ctx.unroute('**/ops');
  }

  /* ── AND A PAGE OLDER THAN THE APP IT IS TALKING TO ──────────────────
   *
   * "This is still a problem" — sent with a photograph of a fault that had
   * been fixed and deployed twenty minutes earlier. Both were true: the
   * server had the fix and the tab in the photograph did not, because a page
   * is HTML and JavaScript fetched once.
   *
   * Nothing about an old tab looks old. It holds the family's tree, it
   * saves, it polls, it is in every way working — it is running last week's
   * code against this week's server. On a phone that never closes a tab and
   * a family filling in a tree over weeks, that is not a corner case, and
   * "reload the page" is not what anybody thinks to do about a bug. */
  section('A PAGE THAT HAS BEEN OPEN SINCE BEFORE THE APP WAS UPDATED');
  {
    const poll = await page.evaluate(async () => {
      const r = await fetch(`/api/tree/${treeId}/changes?since=0`,
                            { headers:{ Accept:'application/json' } });
      const d = await r.json();
      return { build:d.build || '', mine:BUILD };
    });
    check(!!poll.build, 'the poll every open tab already makes carries the build');
    is(poll.build, poll.mine, 'and on a page just loaded the two agree');

    await page.evaluate(() => { const e = document.getElementById('others');
                                if (e) e.hidden = true; });
    await page.evaluate(() => noticeNewBuild('0000000'));
    await page.waitForTimeout(250);
    const said = await page.evaluate(() => {
      const e = document.getElementById('others');
      return e && !e.hidden ? e.textContent.replace(/\s+/g,' ').trim() : null;
    });
    check(!!said, 'a server running something else is said out loud');
    check(said && /reload/i.test(said), 'with the word somebody needs: ' + JSON.stringify(said));
    check(said && /nothing on screen is lost/i.test(said),
          'and the answer to what that costs, which is the first thing anybody asks');
    check(await page.$('#buildGo') !== null, 'and a button rather than an instruction');

    /* Once. A line repeated every four seconds is a page shouting at
       somebody who is trying to type a name. */
    await page.evaluate(() => { document.getElementById('others').hidden = true;
                                noticeNewBuild('0000000'); });
    await page.waitForTimeout(200);
    is(await page.evaluate(() => !document.getElementById('others').hidden), false,
       'and only once, however many polls go by');

    await page.evaluate(() => { buildSaid = false; noticeNewBuild(BUILD); });
    await page.waitForTimeout(150);
    is(await page.evaluate(() => !document.getElementById('others').hidden), false,
       'while a server running the same build says nothing at all');
  }

  await ctx.close();
  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
