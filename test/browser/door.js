// THE FIRST THING SOMEBODY SEES.
//
// "Stop making users learn the interface before they can learn about their
//  family."
//
// Opening Muti put somebody in front of a diagram with a toolbar under it.
// Everything they had come for — who am I here, what is this person to me,
// where are my mother's people — was behind a control they had to work out
// first, and the app's own answer to "what can I do" was thirteen buttons and
// a picture. A diagram is a fine ANSWER and a poor question.
//
// So the first thing is a question, in the family's own words, offering the
// three things anybody actually arrives wanting. The tree is the third of
// them rather than the frame around the other two.
//
// WHAT IS ASSERTED.
//
//   That it is there, on a tree that has people in it, and that it is not
//   there on an empty one — an empty family already has a first screen, and
//   two first screens is no first screen at all.
//
//   That the Shona on it is the Shona the family gave, exactly. Every Shona
//   line here was written by the family this app is for; nothing on this
//   screen is invented to look Shona, which would be this project doing the
//   opposite of what it is for. Where no word was given the label is in
//   English on purpose, and that is asserted too, so a later hand cannot
//   quietly guess one in.
//
//   That every way out of it goes somewhere. There is no button that only
//   closes it: "what can I do next" has to have an answer on this screen as
//   much as on any other, and the tree is one of the answers, named.
//
//   And that there is a way BACK to it from the tree — including on a phone,
//   which is where this app has put a working control off the side of the
//   screen twice before (see test/browser/reach.js).
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser door
//
// Without a name it runs all of them. Not part of `npm test`: these need
// Chromium.

const { chromium } = require('playwright');
const { BASE, EXE, onlyThisOrigin } = require('./lib');

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
    p3:{ id:'p3', name:'Belinda Chirwa', sex:'f', totem:'Mangwenya',  born:'1958' }
  },
  unions: { u1:{ id:'u1', partners:['p1'], children:['p2'] },
            u2:{ id:'u2', partners:['p2'], children:['p3'] } },
  rootId:'p1', seq:9, notDuplicates:[], lexicon:{}
});

const door = page => page.evaluate(() => {
  const el = document.getElementById('door');
  if (!el || el.hidden) return null;
  return { hi:document.getElementById('doorHi').textContent.trim(),
           sub:document.getElementById('doorSub').textContent.trim(),
           ways:[...el.querySelectorAll('[data-door]')].map(b => ({
             key:b.dataset.door,
             title:b.querySelector('b').textContent.trim(),
             under:b.querySelector('span').textContent.trim(),
             box:(r => ({ w:Math.round(r.width), h:Math.round(r.height),
                          out: r.left < 0 || r.right > innerWidth ||
                               r.top < 0 || r.bottom > innerHeight }))
                (b.getBoundingClientRect())
           })) };
});

const open = async (ctx, family, me, size) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  if (size) await page.setViewportSize(size);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, m]) => {
    localStorage.setItem('muti-baobab-v1', f);
    if (m) localStorage.setItem('muti-baobab-me', m); else localStorage.removeItem('muti-baobab-me');
  }, [family, me || '']);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(700);
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await onlyThisOrigin(ctx);

  section('SOMEBODY THE APP DOES NOT KNOW IS ASKED WHO THEY ARE');
  {
    const page = await open(ctx, FAMILY, null);
    const d = await door(page);
    check(!!d, 'the door is the first thing');
    is(d && d.hi,  'Muti weMhuri',                        'named the way the family names it');
    is(d && d.sub, 'Ziva vanhu vako. Ziva hukama hwenyu.', 'and says what it is for, in Shona');
    is(d && d.ways.map(w => w.title),
       ['Ndiri ani?', 'Ndiri kutsvaga ani?', 'Ona Muti'],
       'three ways through, and all three are the family’s own words');
    is(d && d.ways.map(w => w.under),
       ['Find yourself in the family.',
        'Find someone in the family.',
        'Explore the whole family.'],
       'each with a plain sentence under it, because an icon explains nothing');
    await page.close();
  }

  section('and somebody it does know is greeted and asked what they want');
  {
    const page = await open(ctx, FAMILY, 'p3');
    const d = await door(page);
    is(d && d.hi,  'Mauya, Belinda.',          'by name');
    is(d && d.sub, 'What would you like to know?', 'and asked, not instructed');
    is(d && d.ways.map(w => w.key), ['find', 'kin', 'mine', 'build', 'tree'],
       'with the things a relative comes back for');
    /* AND THE OTHER JOB, NAMED. Adding a person, correcting a year, teaching
       the family's own word is a different visit from "what is this person to
       me", and until it had a name it was simply what the app looked like. */
    check(d && /Help build our Muti|Carry on building/.test(d.ways[3].title),
          'including helping to build it, which is the other half of the app',
          d && d.ways[3].title);
    check(d && /what they are to Belinda/.test(d.ways[1].under),
          'and the relationship one is written about her: ' +
          JSON.stringify(d && d.ways[1].under));
    await page.close();
  }

  section('THE SHONA HERE IS THE SHONA THE FAMILY GAVE, AND NOTHING ELSE');
  /* An app that invents Shona to look Shona is doing the opposite of what
     this project is for. The lines below were written by the family; where no
     word was given the label is in English deliberately, and a wrong word in
     a greeting is worse than a right one in the other language. */
  {
    const page = await open(ctx, FAMILY, null);
    const first = await door(page);
    await page.close();
    const page2 = await open(ctx, FAMILY, 'p3');
    const back = await door(page2);
    await page2.close();

    const GIVEN = ['Muti weMhuri', 'Ziva vanhu vako. Ziva hukama hwenyu.',
                   'Ndiri ani?', 'Ndiri kutsvaga ani?', 'Ona Muti', 'Mauya'];
    const shona = [first.hi, first.sub, back.hi]
      .concat(first.ways.map(w => w.title));
    const unknown = shona.filter(t => !GIVEN.some(g => t.startsWith(g)));
    is(unknown, [], 'not one line of Shona that was not given');
    /* AND THE ENGLISH IS ENGLISH. A "Mhuri yangu" nobody asked for would slip
       in here unnoticed otherwise. */
    is(back.ways.map(w => w.title),
       ['Find someone', 'How are we related?', 'My family',
        'Help build our Muti', 'Explore the tree'],
       'and the labels with no given word are in plain English, on purpose');
  }

  section('EVERY WAY THROUGH IT GOES SOMEWHERE');
  {
    const page = await open(ctx, FAMILY, 'p3');
    const went = async key => {
      await page.click(`[data-door="${key}"]`);
      await page.waitForTimeout(500);
      const out = await page.evaluate(() => ({
        door: !document.getElementById('door').hidden,
        panel: (document.getElementById('form') || {}).textContent
               ? document.getElementById('form').textContent.replace(/\s+/g, ' ').trim().slice(0, 60)
               : null,
        // The two sides of the kinship panel, when that is what opened.
        sides: ['kinA', 'kinB'].map(k => (document.getElementById(k) || {}).value)
      }));
      await page.evaluate(() => { closeForm(); openDoor(); });
      await page.waitForTimeout(250);
      return out;
    };
    for (const [key, want] of [['find', /Tsvaga munhu wemhuri/i],
                               /* And it arrives asking, not answering: one side is
                                  already you, the other is the question. */
                               ['kin',  /What are they to each other\?Person/i],
                               ['mine', /Belinda/]]){
      const r = await went(key);
      check(!r.door, `${key} closes the door`);
      check(r.panel && want.test(r.panel), `${key} opens something: ` + JSON.stringify(r.panel));
    }
    /* AND THE RELATIONSHIP ONE ARRIVES ASKING, NOT ANSWERING. One side is
       already you; the other is the whole question, and it is left empty with
       the cursor in it. Filling it with you too answered "the same person",
       and filling it with the root answered about a stranger. */
    {
      await page.click('[data-door="kin"]');
      await page.waitForTimeout(500);
      is(await page.evaluate(() => ['kinA', 'kinB'].map(k => document.getElementById(k).value)),
         ['', 'Belinda Chirwa'],
         'seen by you, and the person still to be named');
      is(await page.evaluate(() =>
           document.activeElement && document.activeElement.id), 'kinA',
         'with the cursor in the side that is the question');
      await page.evaluate(() => { closeForm(); openDoor(); });
      await page.waitForTimeout(250);
    }

    /* The tree is a way through, not a way out: it is named, and it leaves
       the app on the thing it names. */
    await page.click('[data-door="tree"]');
    await page.waitForTimeout(500);
    is(await page.evaluate(() => document.getElementById('door').hidden), true,
       'and the tree one leaves the tree');
    is(await page.evaluate(() => (document.getElementById('form') || {}).id || null), null,
       'with nothing on top of it');
    check(await page.evaluate(() => document.querySelectorAll('.pod').length) === 3,
          'and the family is there to look at');
    await page.close();
  }

  section('AND THERE IS A WAY BACK TO IT, ON EVERY SCREEN THERE IS');
  /* Twice in this app a working control has been drawn off the side of a
     phone. The way home is not allowed to be the third. */
  {
    for (const [W, H] of [[1280, 900], [414, 896], [360, 740], [320, 700]]){
      const page = await open(ctx, FAMILY, 'p3', { width:W, height:H });
      await page.click('[data-door="tree"]');
      await page.waitForTimeout(400);
      const b = await page.evaluate(() => {
        const e = document.getElementById('brand');
        const r = e.getBoundingClientRect();
        return { shown: !!(r.width && r.height), text:e.textContent.trim(),
                 out: r.left < 0 || r.right > innerWidth || r.top < 0,
                 cut: e.scrollWidth > e.clientWidth + 1 };
      });
      check(b.shown && !b.out, `${W}px: the way home is on the screen`, b);
      check(!b.cut, `${W}px: and not cut off mid-word ("${b.text}")`);
      await page.click('#brand');
      await page.waitForTimeout(400);
      check(!!(await door(page)), `${W}px: and it opens the door`);
      await page.close();
    }
  }

  section('AN EMPTY FAMILY IS NOT ASKED ANY OF THIS');
  /* It already has a first screen — the one that asks for the single name
     that has to go in on its own — and two first screens is no first screen. */
  {
    const page = await open(ctx, JSON.stringify(
      { people:{}, unions:{}, rootId:null, seq:1, notDuplicates:[], lexicon:{} }), null);
    is(await door(page), null, 'no door over an empty tree');
    is(await page.evaluate(() => document.getElementById('seed').hidden), false,
       'the one name goes in, as it always did');
    await page.close();
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
