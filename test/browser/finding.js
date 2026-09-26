// Looking somebody up, and what happens when they are not there.
//
// "Find box not functional" — sent with a photograph of the panel holding a
// name, the word no, and a Close button.
//
// The box was working. It had searched the family and answered honestly.
// Then it stopped: a name typed, nobody by it, and nothing to do but close
// the panel and start again somewhere else. That is what "not functional"
// means from the other side of the screen — not that the machinery failed,
// but that using it got somebody nowhere.
//
// And looking somebody up and NOT finding them is not a dead end in this
// app. It is the commonest reason to add them, and it is the exact moment
// the app has just proved they are not a duplicate — which is the thing this
// whole project keeps trying to prevent. So the way on belongs here, and it
// carries the typed name across so that nobody types it twice.
//
// It still goes through a relative, because that rule holds everywhere:
// nobody goes in on their own.
//
// THE OTHER HALF is what the box can see. It searches the tree this page
// holds, which for a whole family is everybody — but a session working on
// one BRANCH holds one side, and "nobody by that name" from a branch does
// not mean what it says. It says which it is now.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser finding
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin, throughDoor } = require('./lib');

let pass = 0, fail = 0;
const ok  = m => { pass++; console.log('  ok   ' + m); };
const bad = (m, d) => { fail++; console.log('  FAIL ' + m + (d ? '  — ' + JSON.stringify(d) : '')); };
const is  = (a, b, m) => JSON.stringify(a) === JSON.stringify(b) ? ok(m) : bad(m, { got:a, want:b });
const check = (c, m, d) => c ? ok(m) : bad(m, d);
const section = t => console.log('\n' + t);

const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Chaitezvi Musoni', sex:'m', totem:'Mwendamberi', born:'1900', root:true },
    p2:{ id:'p2', name:'Sydney Musoni',    sex:'m', totem:'Mwendamberi', born:'1938' },
    p3:{ id:'p3', name:'Musekiwa Musoni',  sex:'m', born:'1968' },
    p4:{ id:'p4', name:'Edward Musoni',    sex:'m', born:'1971' },
    p5:{ id:'p5', name:'Mavis Edwardina Musoni', sex:'f', born:'1974' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1'], children:['p2'] },
    u2:{ id:'u2', partners:['p2'], children:['p3','p4','p5'] }
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
  await page.waitForFunction(() => { try { return people().length === 5; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(400);

  /* Typed a character at a time, the way a person does — the panel rebuilds
     itself on every keystroke, so typing is the thing to test, not the
     function underneath it. */
  const findFor = async (who, text) => {
    await page.evaluate(w => { closeForm(); sel = w; findText = ''; render(); openFind(); }, who);
    await page.waitForSelector('#findQ', { timeout:5000 });
    await page.click('#findQ');
    await page.type('#findQ', text, { delay:25 });
    await page.waitForTimeout(350);
  };
  const hits = () => page.$$eval('#findList .found u',
    els => els.map(e => e.childNodes[0].textContent.trim()));
  const words = () => page.evaluate(() =>
    document.getElementById('form').textContent.replace(/\s+/g, ' ').trim());

  section('SOMEBODY WHO IS THERE IS FOUND');
  {
    await findFor('p3', 'edward');
    is(await page.evaluate(() => document.getElementById('findQ').value), 'edward',
       'every letter typed reaches the box');
    is(await hits(), ['Edward Musoni', 'Mavis Edwardina Musoni'],
       'and the name is found however it sits in a name');
  }

  section('and case is not something a family should have to think about');
  {
    await findFor('p3', 'EDWARD');
    is(await hits(), ['Edward Musoni', 'Mavis Edwardina Musoni'], 'shouted or not');
  }

  section('SOMEBODY WHO IS NOT THERE IS A DOOR, NOT A WALL');
  /* The photograph. A name, the word no, and Close.
   *
     THE NAME HERE IS NOTHING LIKE ANYBODY'S, and that is deliberate. This
     search is fuzzy on purpose — "Edward Chirwa" finds Edward Musoni, which
     is right and is most of its value — so a test for the empty answer has
     to ask for somebody the family really has no trace of. */
  {
    await findFor('p3', 'Tarisai Chikomba');
    is(await hits(), [], 'nobody by that name');
    const said = await words();
    /* IN THE FAMILY'S OWN WORDS, and naming who was looked for — "Nobody by
       that name" is the app talking about its own search. */
    check(/Hatina kuwana Tarisai Chikomba\./.test(said), 'and it says so, by name');
    check(await page.$('#findAdd') !== null, 'and offers the way on');
    check(/Add Tarisai Chikomba as a relative of Musekiwa/.test(said),
          'naming who would be added and who to: ' + JSON.stringify(said.slice(-80)));
  }

  section('and the name travels, so nobody types it twice');
  {
    await page.click('#findAdd');
    await page.waitForTimeout(400);
    check(/Pick the word your family uses/.test(await words()),
          'it goes through a relative, because nobody goes in on their own');
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#form [data-way]')].find(x => !x.disabled);
      if (b) b.click();
    });
    await page.waitForSelector('#fName', { timeout:5000 });
    is(await page.evaluate(() => document.getElementById('fName').value), 'Tarisai Chikomba',
       'and the form opens with the name already in it');
  }

  section('WITH NOBODY PICKED IT SAYS WHAT TO DO INSTEAD');
  /* A name cannot be added to nothing, so there is nothing to offer — but
     "nobody by that name" and a Close button is not an answer either. */
  {
    await page.evaluate(() => { closeForm(); sel = null; findText = ''; render(); openFind(); });
    await page.waitForSelector('#findQ', { timeout:5000 });
    await page.click('#findQ');
    await page.type('#findQ', 'Tarisai Chikomba', { delay:20 });
    await page.waitForTimeout(350);
    check(await page.$('#findAdd') === null, 'no offer to add them to nobody');
    check(/tap whoever .*belongs to on the tree/i.test(await words()),
          'but it says what would make one: ' + JSON.stringify((await words()).slice(-110)));
  }

  section('A RESULT SAYS WHO THEY ARE TO YOU, NOT WHERE THEY SIT');
  /* "If I search for Tendai, the result should immediately tell me something
      useful: Tendai Musoni, Sekuru vako. I shouldn't have to open Tendai,
      inspect parents, move around the tree and work out why Tendai is my
      sekuru."
   *
     The word was already worked out here. It was set as the last clause of
     the small print, after the birth year and the household — "b. 1971 ·
     child of Sydney Musoni · your Hanzvadzi" — which is the database's answer
     with the family's answer tacked on the end. */
  {
    await findFor('p5', 'edward');
    const row = await page.evaluate(() => {
      const f = [...document.querySelectorAll('#findList .found')]
        .find(e => /Edward Musoni/.test(e.textContent));
      if (!f) return null;
      const rel = f.querySelector('u b.rel');
      return { rel: rel ? rel.childNodes[0].textContent.trim() : null,
               whose: rel ? (rel.querySelector('i') || {}).textContent : null,
               acts: [...f.querySelectorAll('.acts button')].map(b => b.textContent.trim()),
               /* Read off the screen: the point is that it is not small print
                  at the end of a line about generations. */
               big: rel ? Math.round(parseFloat(getComputedStyle(rel).fontSize)) : 0,
               small: Math.round(parseFloat(getComputedStyle(f.querySelector('u small')).fontSize)) };
    });
    check(!!row, 'the person is found');
    /* Reckoned from Musekiwa, who is set as you in this suite — his younger
       brother, and younger is what decides between the two words. */
    is(row && row.rel, "Munin'ina", 'and the word is on the result itself');
    is(row && row.whose, 'to you', 'said to be what they are to YOU, not a fact about them');
    check(row && row.big > row.small,
          `and set larger than the record it used to hide in (${row && row.big} vs ${row && row.small})`);
  }

  section('and every result offers the two things to do with a person');
  /* Both were reachable before and neither was offered: the only action on a
     result was "Show", which moved the canvas. The Shona on these is the
     family's own — see test/browser/door.js. */
  {
    /* The two that come first. Join… may follow when somebody is picked on
       the tree — that is maintenance, and it is not what a result is for. */
    const acts = await page.evaluate(() => {
      const f = [...document.querySelectorAll('#findList .found')]
        .find(e => /Edward Musoni/.test(e.textContent));
      return [...f.querySelectorAll('.acts button')].map(b => b.textContent.trim());
    });
    is(acts.slice(0, 2), ['Ona hukama', 'Ona paMuti'],
       'see the relationship, and see where they stand');

    await page.evaluate(() => {
      const f = [...document.querySelectorAll('#findList .found')]
        .find(e => /Edward Musoni/.test(e.textContent));
      f.querySelector('[data-kin]').click();
    });
    await page.waitForTimeout(400);
    const panel = await words();
    check(/What are they to each other\?/.test(panel),
          'and the relationship one opens the whole answer');
    check(/Edward Musoni/.test(panel) && /Musekiwa Musoni/.test(panel),
          'with both people already filled in: ' + JSON.stringify(panel.slice(0, 90)));
  }

  section('and with nobody set as you there is no word and nothing to ask about');
  /* Every term in this app is reckoned from one person. Offering "see the
     relationship" when there is nobody to be related TO would open a panel
     that cannot answer. */
  {
    await page.evaluate(() => { setMe(null); });
    await findFor('p5', 'edward');
    const row = await page.evaluate(() => {
      const f = [...document.querySelectorAll('#findList .found')]
        .find(e => /Edward Musoni/.test(e.textContent));
      return { rel: !!f.querySelector('u b.rel'),
               acts: [...f.querySelectorAll('.acts button')].map(b => b.textContent.trim()) };
    });
    is(row.rel, false, 'no word is claimed');
    check(!row.acts.includes('Ona hukama'),
          'and nothing offers to explain a relationship to nobody', row.acts);
    await page.evaluate(() => { setMe('p3'); });
  }

  section('AND A BRANCH SAYS THAT IT IS ONE');
  /* "Nobody by that name" from a session holding one side of a family is not
     what it appears to be, and somebody who reads it as "not in this family"
     enters a relative who is already recorded on the other side. */
  {
    await page.evaluate(() => { closeForm(); onBranch = { id:'b1', name:'the Harare side' };
                                sel = 'p3'; findText = ''; render(); openFind(); });
    await page.waitForSelector('#findQ', { timeout:5000 });
    await page.click('#findQ');
    await page.type('#findQ', 'Tarisai Chikomba', { delay:20 });
    await page.waitForTimeout(350);
    check(/working on one side of this family/.test(await words()),
          'it says the search only covers this side');
    await page.evaluate(() => { onBranch = null; });
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
