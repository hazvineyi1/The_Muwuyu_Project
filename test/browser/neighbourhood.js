// HOW MUCH OF THE TREE, AND WHO DECIDES.
//
// "Don't make users understand the whole tree. For large families, initially
//  show a family neighbourhood around me. Then provide obvious expansion
//  points: + Mother's family, + Father's family, + More generations, + Show
//  whole tree."
//
// The narrowing existed and was a setting three panels deep, defaulting to
// everyone. So a relative opening a family of two hundred was shown two
// hundred names at a size where none of them could be read, and the way to
// see less was behind Look, under a heading about colours and dark mode.
// Nobody finds a setting they do not already know they want.
//
// SO '' MEANS NOBODY HAS SAID, which is a different thing from somebody
// choosing everyone. A family small enough to take in at a glance is still
// shown whole; one that is not opens on the people around you. Choosing is
// still choosing and still sticks.
//
// AND THE WAYS OUT ARE NAMED. "Mother's family" is what a person actually
// wants next, and no distance can offer it, because a distance does not know
// which side of a family it is on: six hops from you reaches some of your
// mother's people and some of your father's, cut off wherever the number ran
// out. That is not a shape anybody's family has. A side is a walk from one
// parent that never goes back through you or through the other parent.
//
// THE THING THIS FILE IS REALLY GUARDING is the promise the rest of this app
// makes about people who are off the screen: the picture is smaller, the
// family is not. A default that takes a hundred and eighty names away without
// saying so, in a project whose family has twice thought its tree had
// vanished, would be the worst change in it.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser neighbourhood
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

/* A family big enough that nobody can take it in — two grandfathers, their
   children, their children's children, and a marriage joining the two sides
   so that "me" has a mother's people and a father's people that are really
   distinct. Built rather than written out: eighty names typed into a test
   file is a wall, and the shape is what matters. */
function familyOf(n){
  const people = {}, unions = {};
  let seq = 1;
  const add = (name, sex, born) => {
    const id = 'p' + (seq++);
    people[id] = { id, name, sex, totem:'Shumba', born:String(born) };
    return id;
  };
  const marry = (a, b, kids) => {
    const id = 'u' + (seq++);
    unions[id] = { id, partners:b ? [a, b] : [a], children:kids };
    return id;
  };

  // Two houses, each with a grandfather and three children.
  const made = [];
  const side = (house, y) => {
    const gf = add(`${house} Elder`, 'm', y); people[gf].totem = house;
    const kids = [];
    for (let i = 0; i < 3; i++){
      const k = add(`${house} Child ${i}`, i % 2 ? 'f' : 'm', y + 30 + i * 2);
      people[k].totem = house;
      kids.push(k);
    }
    marry(gf, null, kids);
    return { gf, kids };
  };
  const mumSide = side('Mangwenya', 1900);
  const dadSide = side('Mandaba', 1902);

  /* Me, of the two of them — and she has to BE a she, or the app has no
     mother to offer a side for and this suite quietly tests half of itself. */
  const mum = mumSide.kids[0], dad = dadSide.kids[0];
  people[mum].sex = 'f';
  people[dad].sex = 'm';
  const me = add('Belinda Mandaba', 'f', 1960);
  marry(dad, mum, [me]);

  /* And then generations DOWN each side, rather than more names beside me.
     Six hops from somebody reaches their grandparents' other grandchildren,
     so a family that is merely wide is a family entirely within reach — and a
     test built that way proves nothing about a narrowing. Depth is what makes
     somebody far. */
  let made_n = Object.keys(people).length;
  const tips = [mumSide.kids[1], mumSide.kids[2], dadSide.kids[1], dadSide.kids[2]];
  let ring = 0;
  while (made_n < n && ring < 300){
    for (let t = 0; t < tips.length && made_n < n; t++){
      const parent = tips[t];
      const house = people[parent].totem === 'Shumba'
        ? (mumSide.kids.includes(parent) ? 'Mangwenya' : 'Mandaba') : people[parent].totem;
      const kid = add(`${house} Down ${ring}-${t}`, ring % 2 ? 'f' : 'm', 1960 + ring * 20);
      people[kid].totem = house;
      marry(parent, null, [kid]);
      tips[t] = kid;                       // the line goes on from the new one
      made_n++;
    }
    ring++;
  }
  return { json: JSON.stringify({ people, unions, rootId:mumSide.gf, seq:seq + 1,
                                  notDuplicates:[], lexicon:{} }),
           me, mum, dad, total: Object.keys(people).length };
}

const barText = page => page.evaluate(() => {
  const e = document.getElementById('litbar');
  return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : '';
});
const shown = page => page.evaluate(() => Object.keys(layout.persons).length);
const all = page => page.evaluate(() => people().length);
const ways = page => page.evaluate(() =>
  [...document.querySelectorAll('#litbar .pill button')].map(b => b.textContent.trim()));

const open = async (ctx, fam, me, wipe) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, m, w]) => {
    if (w) localStorage.removeItem('muti-baobab-reach');
    localStorage.setItem('muti-baobab-v1', f);
    localStorage.setItem('muti-baobab-me', m);
    /* THE PICTURE, ON PURPOSE. A family this size now opens as a BOOK, and
       a book does not narrow — a page for each side reads the same at four
       hundred people, and taking half the relatives off the pages would
       break the very references it is made of. Narrowing is about the
       picture, so this suite asks for the picture. The book's own answer to
       this question is asserted at the foot of the file. */
    localStorage.setItem('muti-baobab-shape', 'mudzi');
  }, [fam, me, wipe !== false]);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length > 1; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(600);
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 } });
  await onlyThisOrigin(ctx);

  const big = familyOf(70);
  const small = familyOf(20);

  section('A FAMILY SMALL ENOUGH TO TAKE IN IS SHOWN WHOLE');
  {
    const page = await open(ctx, small.json, small.me);
    is(await shown(page), await all(page), `all ${await all(page)} of them are on the screen`);
    is(await barText(page), '', 'and nothing is said, because nothing is missing');
    await page.close();
  }

  section('AND ONE THAT IS NOT OPENS ON THE PEOPLE AROUND YOU');
  const page = await open(ctx, big.json, big.me);
  {
    const on = await shown(page), total = await all(page);
    check(total > 40, `the family is ${total}, which is past what anybody reads at once`);
    check(on < total, `${on} of them are on the screen`, { on, total });
    check(on > 0, 'and it is not empty');
  }

  section('and it says so, in the same words a setting somebody chose would');
  /* A family that has twice thought its tree had vanished must never be left
     to find out on their own that a hundred and eighty names are missing. */
  {
    const said = await barText(page);
    check(/Near me/.test(said), 'named: ' + JSON.stringify(said.slice(0, 120)));
    check(new RegExp(`${await shown(page)} of ${await all(page)}`).test(said),
          'counted, both halves');
    check(/standing aside, not removed/.test(said), 'and promised back');
    check(/opens on the people around you/.test(said),
          'and said to be the app’s doing rather than a setting somebody left on');
  }

  section('AND THE WAYS OUT ARE NAMED, NOT ONE DOOR MARKED EVERYONE');
  {
    const out = await ways(page);
    is(out.slice(-2), ['+ More generations', 'Show everyone'],
       'further out, and the whole family');
    check(out.includes("+ Mother's family"), "and your mother's people, by name", out);
    check(out.includes("+ Father's family"), "and your father's", out);
  }

  section('and a side really is a side');
  /* Not a distance. Every one of her people comes on; none of his does, and
     he is exactly as far away in hops as she is. */
  {
    const before = await shown(page);
    await page.click("#litbar .pill button:text-matches('Mother')");
    await page.waitForTimeout(600);
    const after = await shown(page);
    check(after > before, `more of the family is on the screen (${before} then ${after})`);

    const sides = await page.evaluate(() => {
      const on = layout.persons;
      const of = t => people().filter(p => p.totem === t);
      return { mumOn: of('Mangwenya').filter(p => on[p.id]).length,
               mumAll: of('Mangwenya').length,
               dadOn: of('Mandaba').filter(p => on[p.id]).length,
               dadAll: of('Mandaba').length };
    });
    is(sides.mumOn, sides.mumAll, `every one of her people is on (${sides.mumAll})`);
    check(sides.dadOn < sides.dadAll,
          `and his are still standing aside (${sides.dadOn} of ${sides.dadAll})`, sides);
  }

  section('and his side is one more tap, and then the whole family is there');
  {
    await page.click("#litbar .pill button:text-matches('Father')");
    await page.waitForTimeout(600);
    const sides = await page.evaluate(() => {
      const on = layout.persons;
      const of = t => people().filter(p => p.totem === t);
      return { dadOn: of('Mandaba').filter(p => on[p.id]).length, dadAll: of('Mandaba').length };
    });
    is(sides.dadOn, sides.dadAll, `every one of his people is on too (${sides.dadAll})`);
  }

  section('CHOOSING EVERYONE IS AN ANSWER, AND IT STICKS');
  /* The reason '' had to stop meaning two things. Stored as nothing, the
     choice was indistinguishable from never having been asked, so the next
     opening would narrow the family again — and a family who had already
     said "show me all of them" would have to say it every time. */
  {
    /* A fresh page: opening both sides above already put everybody on the
       screen, and there is no "show everyone" on a bar with nothing left to
       show. */
    const fresh = await open(ctx, big.json, big.me);
    check(await shown(fresh) < await all(fresh), 'it opens narrowed again');
    await fresh.click('#reachOff');
    await fresh.waitForTimeout(600);
    is(await shown(fresh), await all(fresh), 'the whole family is back');
    is(await barText(fresh), '', 'and nothing is left to say');
    await fresh.close();

    const again = await open(ctx, big.json, big.me, false);
    is(await shown(again), await all(again), 'and it is still whole on the next opening');
    is(await barText(again), '', 'with nothing said about a reach');
    await again.close();
  }

  section('AND MORE GENERATIONS IS A STEP, NOT A JUMP');
  {
    const step = await open(ctx, big.json, big.me);
    const near = await shown(step);
    await step.click('#reachMore');
    await step.waitForTimeout(600);
    const wide = await shown(step);
    const total = await all(step);
    check(wide > near, `further out than before (${near} then ${wide})`);
    check(wide <= total, 'and never more than the family', { wide, total });
    if (wide < total)
      check(/Wider/.test(await barText(step)), 'said by its own name on the bar');
    await step.close();
  }

  section('AND A BOOK DOES NOT NARROW AT ALL');
  /* The one shape that does not need to. A page is bounded by one side of
     the family however large the tree is, so it reads the same at four
     hundred people as at forty — and the references between pages only work
     if the pages are all there. */
  {
    const bk = await ctx.newPage();
    bk.on('pageerror', e => bad('page error', e.message));
    await bk.goto(BASE, { waitUntil:'domcontentloaded' });
    await bk.evaluate(([f, m]) => {
      localStorage.removeItem('muti-baobab-reach');
      localStorage.setItem('muti-baobab-shape', 'book');
      localStorage.setItem('muti-baobab-v1', f);
      localStorage.setItem('muti-baobab-me', m);
    }, [big.json, big.me]);
    await bk.goto(BASE, { waitUntil:'domcontentloaded' });
    await bk.waitForFunction(() => { try { return people().length > 1; } catch(e){ return false; } });
    await throughDoor(bk);
    await bk.waitForTimeout(600);
    is(await shown(bk), await all(bk), 'everybody is on the pages');
    is(await bk.evaluate(() => reachNow()), 'all', 'whatever the reach was set to');
    is(await barText(bk), '', 'and nothing is said about people standing aside');
    await bk.close();
  }

  await page.close();
  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
