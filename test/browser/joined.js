// HOW TWO PEOPLE ARE JOINED, on the screen and on the tree.
//
// The engine side of this is test/howjoined.test.js, which proves the chain is
// the right chain. This is the other half, and it is the half that has been
// wrong before in this project: a thing that works and is drawn past the edge
// of a phone (see test/browser/reach.js), or a button that is rendered and
// wired to nothing.
//
// THREE THINGS ARE ASSERTED.
//
//   The chain is on the screen. It is a row of the people in between and it
//   WRAPS rather than scrolls, because a row that scrolls sideways hides the
//   far end of the answer behind a gesture nobody knows is there. Checked at
//   320px, which is where every layout fault in this app has shown up first.
//
//   The arrow is between steps and never before the first one. It is drawn in
//   CSS inside the step it points at, so a wrapped row cannot open with an
//   arrow pointing at the panel's edge.
//
//   And "Show it on the tree" does what it says: the people along the way are
//   lit, everybody else is set back, and the chip left behind counts LINKS
//   rather than people — six people are five links, and a "6" beside two
//   names is a number nobody asked for.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser joined
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

/* The family from the request: Belinda, her mother Rudo, Rudo's brother
   Tendai, and the man Tendai married to. Belinda is holding the phone. */
const FAMILY = JSON.stringify({
  people: {
    p1:{ id:'p1', name:'Sydney Mandaba',  sex:'m', totem:'Moyondizvo', born:'1900', root:true },
    p2:{ id:'p2', name:'Rudo Mandaba',    sex:'f', totem:'Moyondizvo', born:'1932' },
    p3:{ id:'p3', name:'Joseph Chirwa',   sex:'m', totem:'Mangwenya',  born:'1930' },
    p4:{ id:'p4', name:'Belinda Chirwa',  sex:'f', totem:'Mangwenya',  born:'1958' },
    p5:{ id:'p5', name:'Tendai Mandaba',  sex:'m', totem:'Moyondizvo', born:'1936' },
    p6:{ id:'p6', name:'Grace Nyoni',     sex:'f', totem:'Nzou',       born:'1940' }
  },
  unions: {
    u1:{ id:'u1', partners:['p1'],        children:['p2','p5'] },
    u2:{ id:'u2', partners:['p2','p3'],   children:['p4'] },
    u3:{ id:'u3', partners:['p5','p6'],   children:[] }
  },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

const words = page => page.evaluate(() =>
  document.getElementById('form').textContent.replace(/\s+/g, ' ').trim());

/* The chain as the screen has it: the steps in order, and whether any of them
   is drawn outside the panel it belongs to. */
const chainOnScreen = page => page.evaluate(() => {
  const row = document.querySelector('#form .chainrow');
  if (!row) return null;
  const box = document.getElementById('form').getBoundingClientRect();
  const steps = [...row.querySelectorAll('.step')].map(e => {
    const r = e.getBoundingClientRect();
    return { name:(e.querySelector('b') || {}).textContent,
             word:(e.querySelector('em') || {}).textContent || null,
             out: r.left < box.left - 1 || r.right > box.right + 1 ||
                  r.left < 0 || r.right > innerWidth,
             arrow: getComputedStyle(e, '::before').content };
  });
  /* Counted by where each step STARTS, not by its top edge: the steps are
     centred down the row and are not the same height, so their tops differ
     inside a single line. A step that begins no further right than the one
     before it has wrapped onto a new one. */
  let rows = steps.length ? 1 : 0, at = -Infinity;
  for (const e of row.querySelectorAll('.step')){
    const l = e.getBoundingClientRect().left;
    if (l <= at) rows++;
    at = l;
  }
  return { steps, rows, scrolls: row.scrollWidth > row.clientWidth + 1 };
});

const openFor = async (page, a, b) => {
  await page.evaluate(([x, y]) => { closeForm(); kinA = x; kinB = y; openKinship(); }, [a, b]);
  await page.waitForSelector('#form', { timeout:5000 });
  await page.waitForTimeout(250);
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });

  for (const [W, H] of [[1280, 900], [320, 700]]){
    section(`${W}×${H}`);
    const ctx = await browser.newContext({ viewport:{ width:W, height:H } });
    await onlyThisOrigin(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => bad(`page error at ${W}px`, e.message));

    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                               localStorage.setItem('muti-baobab-me', 'p4'); }, FAMILY);
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => { try { return people().length === 6; } catch(e){ return false; } });
    await throughDoor(page);
    await page.waitForTimeout(400);

    /* Person: Tendai. Seen by: Belinda. So the panel's first card answers
       what Tendai is to Belinda, and the chain belongs under that one. */
    await openFor(page, 'p5', 'p4');
    const said = await words(page);
    check(/Sekuru/.test(said), 'the word is there');
    check(/How they are joined/.test(said), 'and so is the way there');

    const c = await chainOnScreen(page);
    check(!!c, 'the chain is drawn', said.slice(0, 120));
    is(c && c.steps.map(s => s.name), ['Belinda', 'Rudo', 'Tendai'],
       'naming the people in between, in order');
    is(c && c.steps.map(s => s.word),
       [null, 'your mother', 'Rudo’s brother'],
       'each under the link that reaches them');
    is(c && c.steps.filter(s => s.out).map(s => s.name), [],
       'and not one of them is drawn outside the panel');
    check(c && !c.scrolls, 'the row wraps rather than scrolling sideways');

    section(`and the arrow is between the steps, not before the first (${W}px)`);
    /* A wrapped row that opens with an arrow pointing at the panel edge looks
       like a missing name. */
    check(c && /none/.test(c.steps[0].arrow),
          'nothing is drawn before the first name', c && c.steps[0].arrow);
    check(c && c.steps.slice(1).every(s => /→/.test(s.arrow)),
          'and every step after it carries one', c && c.steps.map(s => s.arrow));

    section(`and on a narrow screen it is more than one row (${W}px)`);
    check(W > 700 ? c.rows === 1 : c.rows >= 1,
          W > 700 ? 'one row where there is room' : `${c && c.rows} row(s), and all of it on screen`);

    await ctx.close();
  }

  section('SHOW IT ON THE TREE');
  {
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
    await onlyThisOrigin(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => bad('page error', e.message));
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                               localStorage.setItem('muti-baobab-me', 'p4'); }, FAMILY);
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => { try { return people().length === 6; } catch(e){ return false; } });
    await throughDoor(page);
    await page.waitForTimeout(400);

    await openFor(page, 'p5', 'p4');
    check(await page.$('#form [data-chain]') !== null, 'the offer is a real button');
    await page.click('#form [data-chain]');
    await page.waitForTimeout(400);

    /* WHO IS LIT: the three along the way, and Sydney, because the step from
       Rudo to Tendai is two recorded links folded into one and he is where
       they meet. Showing the sentence without him would light a jump. */
    const drawn = await page.evaluate(() => {
      const of = c => [...document.querySelectorAll('.pod.' + c)]
        .map(e => (state.people[e.dataset.id] || {}).name.split(' ')[0]).sort();
      return { lit:of('lit'), dim:of('dim'),
               hushed: document.getElementById('gtree').classList.contains('hushed'),
               chip: (document.getElementById('litbar') || {}).textContent || '' };
    });
    is(drawn.lit, ['Belinda', 'Rudo', 'Sydney', 'Tendai'],
       'the way there is lit, and so is where the two lines meet');
    is(drawn.dim, ['Grace', 'Joseph'], 'and everybody else is set back, not hidden');
    check(drawn.hushed, 'with the wood going back with them');

    section('and the chip says what it is counting');
    /* Four people, three links. "4" beside two names is a number nobody
       asked for. */
    check(/Belinda to Tendai/.test(drawn.chip),
          'it names the two people it is a way between: ' + JSON.stringify(drawn.chip.trim()));
    check(/2 links/.test(drawn.chip), 'and counts links, not people', drawn.chip.trim());

    section('and it lets go the way every other lighting does');
    await page.click('#litOff');
    await page.waitForTimeout(300);
    is(await page.evaluate(() =>
         [...document.querySelectorAll('.pod.dim, .pod.lit')].length), 0,
       'the whole family is back');

    await ctx.close();
  }

  section('A LINK THAT IS ONE LINK IS NOT SHOWN AT ALL');
  /* "Amai — Belinda's mother" is the word and the chain in one breath. */
  {
    const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
    await onlyThisOrigin(ctx);
    const page = await ctx.newPage();
    page.on('pageerror', e => bad('page error', e.message));
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.evaluate(f => { localStorage.setItem('muti-baobab-v1', f);
                               localStorage.setItem('muti-baobab-me', 'p4'); }, FAMILY);
    await page.goto(BASE, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => { try { return people().length === 6; } catch(e){ return false; } });
    await throughDoor(page);
    await page.waitForTimeout(400);

    await openFor(page, 'p2', 'p4');
    const said = await words(page);
    check(/Amai/.test(said), 'her mother is Amai');
    check(!/How they are joined/.test(said),
          'and the panel does not explain it twice', said.slice(0, 160));

    section('AND IT IS SAID ONCE, NOT ONCE PER DIRECTION');
    /* The panel shows both ways round, because Shona terms are not
       reciprocal. The chain is the same both ways round, so a second copy of
       it under "and the other way round" would make that card read as a
       second answer. */
    await openFor(page, 'p5', 'p4');
    const twice = await page.evaluate(() =>
      document.querySelectorAll('#form .chain').length);
    is(twice, 1, 'one chain on a panel that holds two verdicts');

    await ctx.close();
  }

  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
