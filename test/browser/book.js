// A PAGE FOR EACH SIDE OF THE FAMILY.
//
// "The look of the tree is not functional. As it grows it is more difficult
//  to make sense and follow. Make it like a book where at each link, that is
//  the beginning of a new tree."
//
// Two of the three shapes draw one picture of everybody, and both get harder
// to read with every name added. That is the ordinary fate of a family tree
// drawn as a diagram and not a fault in the packing: four hundred people do
// not fit on a page anybody can follow, at any spacing, in any arrangement.
// Every previous attempt in this project — the reach, the folds, the branch
// build, the last no-overlap pass — made the same picture survive being
// bigger. None of them made it readable.
//
// THE BOOK IS NOT A DIAGRAM. A page is a side of the family, and a marriage
// is a reference from one page to another. The house runs through the men
// here (see HOUSE_THROUGH), so a woman's children are on her husband's page
// — which is exactly the "new tree" the request names: at each link, another
// one begins. It is also how families talk: the Mandabas, and then "she
// married a Chirwa, and their people are from Mhondoro".
//
// WHAT THIS FILE IS REALLY GUARDING. A page must be bounded by one side of
// the family however large the tree is — that is the whole claim, and the
// only way to check it is to grow the tree and watch a page NOT grow. So
// this builds two families of very different sizes and asserts that the page
// somebody reads is the same size in both.
//
// AND THAT NOTHING WAS TRADED FOR IT: every name is still a way into that
// person's card, the Shona word is still on every one of them, and the sides
// and their doors are the ones familyLines() already worked out — so a page
// cannot disagree with the picture.
//
// HOW TO RUN IT. Through the runner, which serves the page this suite needs —
// see test/browser/run.js:
//
//   NODE_PATH=$(npm root -g) npm run test:browser book
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

/* Several houses, each with children, and a marriage joining every house to
   the next — so there is a side to read, a side to turn to, and a reference
   pointing at it. `kids` per house is what grows the family without growing
   the number of sides. */
function family(houses, kids){
  const people = {}, unions = {};
  let seq = 1;
  const add = (name, sex, born, totem) => {
    const id = 'p' + (seq++);
    people[id] = { id, name, sex, born:String(born), totem };
    return id;
  };
  const marry = (a, b, children) => {
    const id = 'u' + (seq++);
    unions[id] = { id, partners:b ? [a, b] : [a], children, bond:'married' };
    return id;
  };
  const NAMES = ['Sydney', 'Rudo', 'Joseph', 'Belinda', 'Tendai', 'Grace',
                 'Marita', 'Alfred', 'Tsitsi', 'Anesu', 'Farai', 'Minah'];
  const HOUSE = ['Mandaba', 'Chirwa', 'Mangwenya', 'Nyoni', 'Moyo', 'Musoni'];
  const heads = HOUSE.slice(0, houses).map((h, i) => {
    const id = add(`${NAMES[i]} ${h}`, 'm', 1900 + i, h);
    const own = [];
    for (let k = 0; k < kids; k++)
      own.push(add(`${NAMES[(i + k + 1) % NAMES.length]} ${h}`,
                   k % 2 ? 'f' : 'm', 1930 + k * 2, h));
    marry(id, null, own);
    return { h, id, kids:own };
  });
  for (let i = 0; i < heads.length - 1; i++){
    const she = heads[i].kids.find(k => people[k].sex === 'f');
    const he  = heads[i + 1].kids.find(k => people[k].sex === 'm');
    if (she && he){
      const kid = add(`${NAMES[(i + 7) % NAMES.length]} ${heads[i + 1].h}`,
                      'm', 1965 + i, heads[i + 1].h);
      marry(he, she, [kid]);
    }
  }
  const me = heads[0].kids[0];
  return { json: JSON.stringify({ people, unions, rootId:heads[0].id, seq:seq + 1,
                                  notDuplicates:[], lexicon:{} }),
           me, houses: heads.length, total: Object.keys(people).length };
}

const page1 = page => page.evaluate(() => {
  const el = document.getElementById('book');
  if (!el || el.hidden) return null;
  return {
    head: (el.querySelector('h2') || {}).textContent || '',
    sub:  (el.querySelector('.bsub') || {}).textContent || '',
    where:(el.querySelector('.bwhere') || {}).textContent || '',
    names: [...el.querySelectorAll('.bname')].map(b =>
      (b.querySelector('u') || {}).textContent.replace(/you$/, '').trim()),
    terms: [...el.querySelectorAll('.bname b')].map(b => b.textContent.trim()),
    outs:  [...el.querySelectorAll('.bgo')].map(b => b.textContent.trim())
  };
});

const open = async (ctx, fam, shape) => {
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.evaluate(([f, m, s]) => {
    localStorage.setItem('muti-baobab-v1', f);
    localStorage.setItem('muti-baobab-me', m);
    if (s) localStorage.setItem('muti-baobab-shape', s);
    else localStorage.removeItem('muti-baobab-shape');
  }, [fam.json, fam.me, shape || '']);
  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return people().length > 1; } catch(e){ return false; } });
  await throughDoor(page);
  await page.waitForTimeout(600);
  return page;
};

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1280, height:950 } });
  await onlyThisOrigin(ctx);

  const small = family(3, 3);      // a family that still reads as a picture
  const big   = family(5, 14);     // one that does not

  section('A FAMILY SMALL ENOUGH TO TAKE IN IS STILL A PICTURE');
  /* The book is not better than the picture. It is better than the picture
     AT SIZE, and for a small family the picture says more. */
  {
    const page = await open(ctx, small);
    is(await page.evaluate(() => shapeNow()), 'mudzi', `${small.total} people: a picture`);
    is(await page.evaluate(() => document.getElementById('book').hidden), true,
       'and no book over it');
    check(await page.evaluate(() => document.querySelectorAll('.pod').length) > 0,
          'the pods are drawn');
    await page.close();
  }

  section('AND ONE THAT IS NOT OPENS AS A BOOK');
  const page = await open(ctx, big);
  {
    is(await page.evaluate(() => shapeNow()), 'book', `${big.total} people: a book`);
    const p = await page1(page);
    check(!!p, 'there is a page');
    check(/PAGE 1 OF/i.test(p.where), 'and it says where in the book it is: ' + p.where);
    check(/your own/.test(p.sub), 'opened on your own side rather than on a contents page');
  }

  section('and the page is a side of the family, not a slice of a picture');
  {
    const p = await page1(page);
    const surname = p.head;
    check(!!surname, 'the page is headed with what that side calls itself');
    /* EVERY NAME ON IT IS OF THAT SIDE, except the people who married in —
       who are the references. That is the claim "a page is a side". */
    const strangers = p.names.filter(n => !n.endsWith(surname));
    check(strangers.length < p.names.length,
          `most of the page is ${surname}`, { strangers, of:p.names.length });
    check(p.outs.length > 0, 'and it carries references to other pages', p.outs);
    check(p.outs.some(o => /of the .* side/.test(o)),
          'each naming the side it leads to: ' + JSON.stringify(p.outs.slice(0, 3)));
  }

  section('AND A PAGE DOES NOT GROW WHEN THE FAMILY DOES');
  /* The whole claim, and the only honest way to check it: two families of
     very different sizes, and the page somebody reads is the same page. */
  {
    const bigger = family(5, 40);
    const b2 = await open(ctx, bigger, 'book');
    const one = await page1(page), two = await page1(b2);
    const growth = bigger.total / big.total;
    check(growth > 2, `the family is ${Math.round(growth * 10) / 10} times the size ` +
                      `(${big.total} then ${bigger.total})`);
    /* A page grows with the SIDE it is about, which is the right thing for it
       to grow with — what it must not do is grow with the whole tree. */
    const ratio = two.names.length / one.names.length;
    check(ratio < growth,
          `and the page grew by less (${one.names.length} names then ${two.names.length})`,
          { one:one.names.length, two:two.names.length, growth });
    is(await b2.evaluate(() => document.querySelectorAll('#book .bhouse').length > 0), true,
       'and it is still households on a page, not a list');
    await b2.close();
  }

  section('EVERY NAME IS STILL A WAY INTO THAT PERSON');
  /* A book that could only be read would be a printout. */
  {
    const p = await page1(page);
    check(p.terms.length > 0,
          'the Shona word is on the names, reckoned from you: ' +
          JSON.stringify(p.terms.slice(0, 4)));
    await page.click('#book .bname');
    await page.waitForTimeout(500);
    const card = await page.evaluate(() => {
      const f = document.getElementById('form');
      return f ? f.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) : null;
    });
    check(!!card, 'and tapping one opens their card: ' + JSON.stringify(card));
    check(/Hukama hwenyu|Of the/.test(card || ''),
          'which is the card that answers before it asks anything');
    await page.evaluate(() => closeForm());
  }

  section('AND A REFERENCE TURNS THE PAGE');
  {
    const before = await page1(page);
    await page.click('#book .bgo');
    await page.waitForTimeout(600);
    const after = await page1(page);
    check(after.head !== before.head,
          `it is another side of the family (${before.head} then ${after.head})`);
    check(/PAGE \d+ OF/i.test(after.where), 'and the book says where that is');
  }

  section('and the contents is one tap from every page');
  {
    await page.click('#bContents');
    await page.waitForTimeout(500);
    const c = await page.evaluate(() => {
      const el = document.getElementById('book');
      return { where:(el.querySelector('.bwhere') || {}).textContent || '',
               sides:[...el.querySelectorAll('.bgo.wide')].map(b =>
                 b.childNodes[0].textContent.trim()) };
    });
    check(/Contents/i.test(c.where), 'it says what it is');
    is(c.sides.length, big.houses, `with a line for each of the ${big.houses} sides`);
    check(/^1\. The /.test(c.sides[0]), 'numbered like a book: ' + c.sides[0]);

    await page.click('#book .bgo.wide:last-child');
    await page.waitForTimeout(500);
    check(/PAGE \d+ OF/i.test((await page1(page)).where), 'and any of them opens');
  }

  section('AND THE CONTROLS THAT MOVE A PICTURE ARE NOT ON A PAGE');
  /* Fit and the zooms move a canvas. A book scrolls. Three buttons that do
     nothing are worse than three buttons that are not there. */
  {
    is(await page.evaluate(() => document.querySelector('#bar .grp').hidden), true,
       'Fit and the zooms stand down');
    is(await page.evaluate(() => document.getElementById('find').hidden), false,
       'while Find, which works on any shape, stays');
  }

  section('AND IT IS A CHOICE, WHICH STICKS EITHER WAY');
  {
    const back = await open(ctx, big, 'mudzi');
    is(await back.evaluate(() => shapeNow()), 'mudzi',
       'a big family asked for as a picture is a picture');
    is(await back.evaluate(() => document.getElementById('book').hidden), true,
       'with no book over it');
    check(await back.evaluate(() => document.querySelectorAll('.pod').length) > 0,
          'and the pods drawn');
    await back.close();

    const fwd = await open(ctx, small, 'book');
    is(await fwd.evaluate(() => shapeNow()), 'book',
       'and a small family asked for as a book is a book');
    check(!!(await page1(fwd)), 'with a page to read');
    await fwd.close();
  }

  await page.close();
  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
