// Correcting a relationship, rather than tearing it out and building it again.
//
// "Relationship edits and fixes need to be enabled to allow the relationship
//  to be corrected."
//
// The card has been sending people here for weeks. The line under the kinship
// word says, in as many words, "worked out from the joins below — if the word
// is wrong, one of them is". And the joins then offered two things, neither of
// which is a correction: HOW two people are joined, which is a different
// question from WHO; and taking the join out altogether, which is not a fix
// but giving up. You lose the marriage, the children of it are left hanging
// off one parent, and you build the whole thing again from nothing.
//
// The commonest wrong join in a family tree is not a join that should not
// exist. It is a join to the wrong person — two Marys, two Josephs, a woman
// recorded against her husband's brother. The marriage is right, the children
// of it are right, and one name on one side of it is wrong.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js, where what that is for each of them is
// written down once:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser correcting
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d).slice(0,400) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, {got:a, want:b});
const section = t => console.log('\n' + t);

/* Mutapa, with the muddle from the screenshot: two named joins and one with
   nobody on the other side and a child in it. And two Marys, which is how the
   wrong one gets recorded in the first place. */
const FAMILY = JSON.stringify({
  people: {
    m:  { id:'m',  name:'Mutapa Mandaba',       sex:'m', born:'1900', root:true },
    j:  { id:'j',  name:'Joseph Mhaka Mandaba', sex:'m', born:'1930' },
    v:  { id:'v',  name:'Mbuya VaMangwenya',    sex:'f', born:'1905' },
    k:  { id:'k',  name:'Agnes Mandaba',        sex:'f', born:'1956' },
    r1: { id:'r1', name:'Mary Chikwanha',       sex:'f', born:'1908' },
    r2: { id:'r2', name:'Mary Moyo',            sex:'f', born:'1910' }
  },
  unions: {
    u1:{ id:'u1', partners:['m','v'],  children:['j'] },
    u2:{ id:'u2', partners:['m','r1'], children:[] },
    u3:{ id:'u3', partners:['m'],      children:['k'] }
  },
  rootId:'m', seq:9, notDuplicates:[], lexicon:{}
});

const open = async (page, id) => {
  await page.evaluate(i => { sel = i; render(); openCard(i); }, id);
  await page.waitForSelector('#cMarriages', { timeout: 10000 });
};
const rows = page => page.$$eval('#cMarriages .join', els => els.map(e => ({
  who: e.querySelector('u').firstChild.textContent.trim(),
  acts: [...e.querySelectorAll('.mini')].map(b => b.textContent.trim())
})));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:940 } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                             localStorage.setItem('muti-baobab-me', 'j'); }, FAMILY);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 6; } catch(e){ return false; } });
  await page.waitForTimeout(500);

  section('EVERY JOIN OFFERS A WAY TO CORRECT WHO IT IS WITH');
  await open(page, 'm');
  const r = await rows(page);
  console.log('       ' + JSON.stringify(r));
  is(r.length, 3, 'three joins on the card');
  is(r[0].acts, ['Somebody else','Not joined at all'], 'a named one offers Somebody else');
  is(r[2].acts, ['Say who','Not joined at all'], 'and the empty one offers Say who');

  section('CORRECTING A WRONG PARTNER KEEPS THE JOIN AND ITS CHILDREN');
  {
    await open(page, 'm');
    await page.click('#cMarriages .join:nth-child(2) [data-rejoin]');
    await page.waitForSelector('#rjQ', { timeout: 10000 });
    const said = await page.evaluate(() => document.querySelector('#form').textContent);
    is(/Recorded as Mary Chikwanha/.test(said), true, 'it says who is recorded now');
    is(/stays in the tree/.test(said), true, 'and that she is not being removed');
    await page.fill('#rjQ', 'Mary');
    await page.waitForTimeout(300);
    const offered = await page.$$eval('#rjList .found', els => els.map(e => ({
      name: e.querySelector('u').firstChild.textContent.trim(),
      off: !!e.querySelector('[data-pick][disabled]'),
      why: (e.querySelector('.leaves') || {}).textContent || ''
    })));
    console.log('       ' + JSON.stringify(offered));
    is(offered.some(o => o.name === 'Mary Moyo' && !o.off), true, 'the other Mary can be picked');
    is(offered.some(o => o.name === 'Mary Chikwanha' && o.off), true,
       'and the one already in it is offered but refused, with the reason');

    await page.click('#rjList .found:has-text("Mary Moyo") [data-pick]');
    await page.waitForTimeout(600);
    const u2 = await page.evaluate(() => {
      const u = state.unions.u2;
      return { partners:u.partners.map(x => state.people[x].name).sort(), children:u.children };
    });
    is(u2.partners, ['Mary Moyo','Mutapa Mandaba'], 'the join now names the right Mary');
    is(await page.evaluate(() => !!state.people.r1), true, 'and the wrong one is still in the tree');
    is(await page.evaluate(() => Object.keys(state.unions).length), 3, 'no new marriage was made');
  }

  section('AND THE EMPTY ONE CAN BE FILLED, WITH ITS CHILD WHERE IT WAS');
  {
    await open(page, 'm');
    await page.click('#cMarriages .join:nth-child(3) [data-rejoin]');
    await page.waitForSelector('#rjQ', { timeout: 10000 });
    const said = await page.evaluate(() => document.querySelector('#form').textContent);
    is(/Nobody is recorded on the other side/.test(said), true, 'it says the other side is empty');
    is(/a child of it is/.test(said), true, 'and that a child hangs from it');
    await page.fill('#rjQ', 'Chikwanha');
    await page.waitForTimeout(300);
    await page.click('#rjList .found [data-pick]');
    await page.waitForTimeout(600);
    const u3 = await page.evaluate(() => {
      const u = state.unions.u3;
      return { partners:u.partners.map(x => state.people[x].name).sort(),
               children:u.children.map(x => state.people[x].name) };
    });
    is(u3.partners, ['Mary Chikwanha','Mutapa Mandaba'], 'the other side is named');
    is(u3.children, ['Agnes Mandaba'], 'and the child never moved');
  }

  section('WHAT CANNOT BE PICKED IS SAID, NOT HIDDEN');
  {
    await open(page, 'm');
    await page.click('#cMarriages .join:nth-child(1) [data-rejoin]');
    await page.waitForSelector('#rjQ', { timeout: 10000 });
    await page.fill('#rjQ', 'Joseph');
    await page.waitForTimeout(300);
    const offered = await page.$$eval('#rjList .found', els => els.map(e => ({
      name: e.querySelector('u').firstChild.textContent.trim(),
      off: !!e.querySelector('[data-pick][disabled]'),
      why: (e.querySelector('.leaves') || {}).textContent || ''
    })));
    console.log('       ' + JSON.stringify(offered));
    is(offered.length > 0, true, 'his own son is in the list rather than missing');
    is(offered[0].off, true, 'and cannot be picked');
    is(/ancestor or a descendant/.test(offered[0].why), true, 'with the reason on the row');
  }

  await browser.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
