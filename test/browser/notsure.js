// MARKING A DOUBT, AND WHAT IT DOES TO WHAT THE APP SAYS.
//
// The engine side is test/unsure.test.js, which proves a doubt travels into
// the word and survives Postgres. This is the half a family actually touches:
// a button on a card, a box for the reason, a mark on the pod, and the line
// under the Shona term.
//
// THE THING THIS HAS TO GET RIGHT is that marking a doubt costs nothing. A
// family who say "we are not sure" and lose the person, or the word, or their
// place in the tree, will stop saying it — and then the app is back to
// recording guesses as facts, which is what migration 019 exists to end. So
// this file checks that everybody stays, the word stays, and the only thing
// that changes is what is claimed.
//
// AND THAT IT CAN BE TAKEN BACK OFF. A doubt that cannot be lifted is a doubt
// nobody will record, because an elder settles these and the record has to be
// able to follow.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser notsure
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin, throughDoor, openRecord } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Sydney Mandaba', sex:'m', totem:'Moyondizvo', born:'1900', root:true },
    p2:{ id:'p2', name:'Rudo Mandaba',   sex:'f', totem:'Moyondizvo', born:'1932' },
    p3:{ id:'p3', name:'Belinda Chirwa', sex:'f', totem:'Mangwenya',  born:'1958' },
    p4:{ id:'p4', name:'Tendai Mandaba', sex:'m', totem:'Moyondizvo', born:'1936' }
  },
  unions: { u1:{ id:'u1', partners:['p1'], children:['p2','p4'] },
            u2:{ id:'u2', partners:['p2'], children:['p3'] } },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

const words = page => page.evaluate(() => {
  const f = document.getElementById('form');
  return f ? f.textContent.replace(/\s+/g, ' ').trim() : '';
});
const card = async (page, id) => {
  await page.evaluate(i => { closeForm(); sel = i; render(); openCard(i); }, id);
  await page.waitForSelector('#form', { timeout:5000 });
  await page.waitForTimeout(250);
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:950 } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  /* A dialog here would be a failure, not a step: this used to ask for the
     reason in a browser prompt, which a family app should not do and a
     headless browser dismisses to null. */
  page.on('dialog', d => { bad('a dialog was opened', d.message()); d.dismiss(); });

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                             localStorage.setItem('muti-baobab-me', 'p3'); }, FAMILY);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length === 4; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(400);

  section('A PERSON THE FAMILY ARE NOT SURE OF');
  {
    await card(page, 'p2');
    await openRecord(page);
    check(await page.$('#cUnsure') !== null, 'the card offers to say so');
    is(await page.evaluate(() => (state.people.p2.unsure ?? null)), null,
       'and nothing is claimed about it to begin with');

    await page.click('#cUnsure');
    await page.waitForTimeout(500);
    await openRecord(page);
    is(await page.evaluate(() => state.people.p2.unsure), '',
       'one press marks it, with no reason yet — which is itself an answer');
    check(await page.$('#cUnsureWhy') !== null,
          'and the box for the reason opens where the doubt is');
  }

  section('and the reason is saved with everything else on the card');
  {
    await page.fill('#cUnsureWhy', 'Ambuya says 1932, her sister says 1935');
    await page.click('#cSave');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => state.people.p2.unsure),
       'Ambuya says 1932, her sister says 1935',
       'typed in one box and kept by the one Save on the card');
  }

  section('and the pod says it, quietly');
  /* Not a warning. A family saying they are not sure is doing the app a
     favour; an alarm on their grandmother's name is not the thanks for it. */
  {
    const pod = await page.evaluate(() => {
      const e = document.querySelector('.pod[data-id="p2"]');
      return { marked: e.classList.contains('notsure'),
               edge: getComputedStyle(e).borderTopStyle,
               there: !!e };
    });
    check(pod.there && pod.marked, 'the pod carries the mark');
    is(pod.edge, 'dashed', 'as a dashed edge and nothing louder');
  }

  section('AND THE WORD SAYS IT TOO, WHEREVER THE WORD IS SHOWN');
  /* The whole point. Tendai is Belinda's Sekuru BECAUSE Rudo is her mother
     and Sydney's daughter; doubt Rudo and Sekuru is as sure as that. */
  {
    await card(page, 'p4');
    const said = await words(page);
    check(/Sekuru/.test(said), 'the word is still said');
    check(/Hazvina kusimbiswa/.test(said),
          'and so is the doubt, in the family’s own words');
    check(/Rudo/.test(said), 'naming who is not confirmed');
    check(/her sister says 1935/.test(said), 'and what is in doubt about them');
    check(/as sure as the family is/.test(said),
          'and what that means for the word above it');
  }

  section('and nothing has been taken away to say it');
  {
    is(await page.evaluate(() => people().length), 4, 'everybody is still in the tree');
    is(await page.evaluate(() => (relationship(meId, 'p4') || {}).term), 'Sekuru',
       'and the word is the same word');
    is(await page.evaluate(() => !!document.querySelector('.pod[data-id="p2"]')), true,
       'and the person is still drawn');
  }

  section('A JOIN THE FAMILY ARE NOT SURE OF IS THE ONE THAT REACHES FURTHEST');
  /* A person can be doubted about a year. A union is the link itself. */
  {
    await page.evaluate(() => { state.people.p2.unsure = null; render(); save(); });
    await page.waitForTimeout(400);
    await card(page, 'p2');
    await openRecord(page);
    const before = await words(page);
    check(!/Hazvina kusimbiswa/.test(before), 'with the person confirmed again, nothing is said');

    await page.click('#cMarriages [data-unsure]');
    await page.waitForTimeout(500);
    await openRecord(page);
    is(await page.evaluate(() => state.unions.u2.unsure), '', 'the join is marked');
    await page.fill('#cMarriages [data-unsurefor]',
                    'nobody living remembers whether they married');
    await page.click('#cSave');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => state.unions.u2.unsure),
       'nobody living remembers whether they married', 'and its reason is kept');
  }

  section('and it follows into every word read through it');
  /* Tendai, not Belinda: a card of your own has no relationship on it, so
     there is no word for a doubt to qualify. The way to Tendai runs Belinda →
     Rudo → Tendai, and the first of those two links is the one just marked. */
  {
    await card(page, 'p4');
    const said = await words(page);
    check(/Hazvina kusimbiswa/.test(said), 'the doubt is carried: ' + said.slice(0, 90));
    check(/being joined/.test(said), 'and said as a join rather than as a person',
          said.slice(0, 200));
    check(/nobody living remembers/.test(said), 'with the reason the family gave');
  }

  section('AND A FAMILY WHO HAVE SINCE ASKED AN ELDER CAN TAKE IT OFF');
  /* A doubt that cannot be lifted is a doubt nobody will record. */
  {
    await card(page, 'p2');
    await openRecord(page);
    await page.click('#cMarriages [data-unsure]');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => (state.unions.u2.unsure ?? null)), null,
       'pressing the pressed one confirms it');
    await card(page, 'p4');
    check(!/Hazvina kusimbiswa/.test(await words(page)),
          'and the word stands on its own again');
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
