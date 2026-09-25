// Nobody stands on anybody.
//
// "Adding names and they are overlapping and it is not clear the
//  demarcations and understanding of the family structure."
//
// Sent with a photograph of a wide row of brothers and sisters with a pod
// drawn across one of them: a father-in-law from a married-in house, lying
// over his own daughter's name. A pod that is underneath another pod cannot
// be read and cannot be tapped, so this is not a question of tidiness — that
// person is gone from the picture and from the app.
//
// THE FAULT WAS A CONSTANT THAT MEANT SOMETHING ELSE. POD_H is 48, which is
// what the stylesheet gives a pod holding a name and nothing else. A pod in
// a real family carries a kin word above the name, the name over two lines,
// a married name, two dates, a mutupo and a rank, and comes to a hundred and
// thirty. Every clearance worked out from 48 was working with less than half
// the truth — and the worst of them was the lane a married-in family stands
// in, which is half a generation under the household they came to. Half a
// generation is a hundred pixels. The pods are a hundred and thirty.
//
// So it was not a rare collision. It was arithmetic that could not fit, and
// it showed up the moment a family recorded the people their daughters
// married and where those people came from — which is the whole point of
// this app.
//
// AND THE LAST PASS THAT MAKES IT TRUE. The rules that place a tree are many
// — rows by generation, households in birth order, stranded children brought
// back to their parents, married-in houses given a lane, branches slid to
// make room — and each is careful about what it knows. None of them is in a
// position to promise that no name ends up under another name, because that
// is a property of all of them together. So there is a last look before
// anybody is drawn, and it moves branches apart where they still touch.
//
// It was checked the only way that means anything: the lane rule was put
// back to the broken half-generation, and of the hundred and fifty families
// that produced an overlap, the last pass rescued a hundred and forty-nine.
// The one it could not was two pods inside a single branch, which no amount
// of packing can separate — a fault in how that branch is built, and one
// this pass now steps over rather than pushing at forty times.
//
// WHAT IS ASSERTED, and it is one thing: no two pods occupy the same space.
// Not "usually", and not in the shapes somebody thought of — this checks two
// hundred families built at random, because the shapes a family really has
// are not the shapes a test author imagines.
//
// HOW TO RUN IT. Through the runner, which starts the server this suite
// needs — see test/browser/run.js:
//
//   TEST_DATABASE_URL=postgres://... NODE_PATH=$(npm root -g) \
//     npm run test:browser standing
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

/* Read off the layout rather than the page: the layout is where the decision
   is made, and a pod that is off screen is still standing on somebody. */
const standingOn = page => page.evaluate(() => {
  const P = layout.persons, ids = Object.keys(P), out = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++){
    const a = P[ids[i]], b = P[ids[j]];
    if (Math.abs(a.x - b.x) < POD_W - 2 && Math.abs(a.y - b.y) < POD_TALL - 2)
      out.push({ a:(state.people[ids[i]] || {}).name, b:(state.people[ids[j]] || {}).name,
                 dx:Math.round(Math.abs(a.x - b.x)), dy:Math.round(Math.abs(a.y - b.y)) });
  }
  return out;
});

const build = (page, fn) => page.evaluate(f => {
  state = { people:{}, unions:{}, rootId:null, seq:1, notDuplicates:[], lexicon:{} };
  meId = null; forgetLines();
  // eslint-disable-next-line no-new-func
  (new Function(f))();
  draw();
}, fn.toString().replace(/^[^{]*\{/, '').replace(/\}\s*$/, ''));

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const ctx = await browser.newContext({ viewport:{ width:1600, height:950 } });
  await onlyThisOrigin(ctx);
  const page = await ctx.newPage();
  page.on('pageerror', e => bad('page error', e.message));

  await page.goto(BASE, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => { try { return typeof draw === 'function'; } catch(e){ return false; } });

  section('A POD IS AS TALL AS IT REALLY IS');
  /* The whole fault in one number. Assert the shape of the mistake so that
     putting it back is loud: the minimum is not the height. */
  {
    await build(page, () => {
      const gf = addPerson('Sydney Mandaba', 'm', 'Moyondizvo', '1900', '');
      const k = grow('child', gf, 'Kurauwone Gerald Mandaba', 'm', 'Moyondizvo',
                     { born:'1962', died:'2006' });
      state.people[k].also = 'Baba Kudzai';
      setMe(gf);
    });
    await page.evaluate(() => { fit(); });
    await page.waitForTimeout(400);
    const seen = await page.evaluate(() => {
      const hs = [...document.querySelectorAll('.pod')]
        .map(e => e.getBoundingClientRect().height / pos.k);
      return { tallest:Math.round(Math.max(...hs)), POD_H, POD_TALL };
    });
    check(seen.tallest > seen.POD_H * 1.5,
          `a full pod is ${seen.tallest} tall, and POD_H is ${seen.POD_H} — the minimum, not the height`);
    check(seen.POD_TALL >= seen.tallest,
          `and the clearance the layout uses is at least that (${seen.POD_TALL})`, seen);
  }

  section('A MARRIED-IN HOUSE STANDS CLEAR OF THE ROW IT CAME TO');
  /* The shape in the photograph: one family joined to another at two
     marriages, so the father-in-law is drawn in the lane under a row of
     brothers and sisters. */
  {
    await build(page, () => {
      const gf = addPerson('Sydney Mandaba', 'm', 'Moyondizvo', '1900', '');
      const kids = ['Joseph', 'Mutapa', 'Marita', 'Alfred']
        .map((n, i) => grow('child', gf, n + ' Mandaba', 'm', '', { born:String(1928 + i * 3) }));
      const other = addPerson('Chirwa Mangwenya', 'm', 'Mangwenya', '1905', '');
      const w1 = grow('child', other, 'Rudo Mangwenya', 'f', 'Mangwenya', { born:'1932' });
      const w2 = grow('child', other, 'Tsitsi Mangwenya', 'f', 'Mangwenya', { born:'1936' });
      linkExisting('partner', kids[0], w1);
      linkExisting('partner', kids[2], w2);
      setMe(kids[0]);
    });
    is(await standingOn(page), [], 'nobody is standing on anybody');
  }

  section('AND IN TWO HUNDRED FAMILIES NOBODY IS EITHER');
  /* Built at random, because the shapes a family really has are not the
     shapes a test author thinks of — the one in the photograph was not. */
  {
    const broken = await page.evaluate(() => {
      const FIRST = ['Joseph', 'Mutapa', 'Marita', 'Alfred', 'Timothy', 'Josphat', 'Minah',
                     'Yvonne', 'Elizabeth', 'Tendai', 'Rudo', 'Tsitsi', 'Anesu', 'Farai'];
      const HOUSE = ['Mandaba', 'Mangwenya', 'Munderi', 'Chekera', 'Musoni', 'Moyo', 'Nyoni'];
      const TOTEM = ['Moyondizvo', 'Mangwenya', 'Shumba', 'Nzou', 'Mhesvi', 'Mwendamberi'];
      const out = [];
      for (let seed = 1; seed <= 200; seed++){
        let s = seed * 7919 % 2147483647;
        const rnd = () => (s = s * 16807 % 2147483647) / 2147483647;
        const pick = a => a[Math.floor(rnd() * a.length)];
        state = { people:{}, unions:{}, rootId:null, seq:1, notDuplicates:[], lexicon:{} };
        meId = null; forgetLines();
        const all = [];
        const root = addPerson(pick(FIRST) + ' ' + HOUSE[0], 'm', pick(TOTEM), '1900', '');
        all.push(root);
        let frontier = [root];
        for (let gen = 0; gen < 3 && frontier.length; gen++){
          const next = [];
          for (const who of frontier){
            const n = Math.floor(rnd() * 5);
            for (let i = 0; i < n; i++){
              const k = grow('child', who, pick(FIRST) + ' ' + HOUSE[0],
                             rnd() < 0.5 ? 'f' : 'm', rnd() < 0.5 ? pick(TOTEM) : '',
                             { born:String(1925 + gen * 25 + i * 2) });
              all.push(k); next.push(k);
              if (rnd() < 0.55){
                if (rnd() < 0.45){
                  // married in from a house that is ALSO recorded here
                  const h = pick(HOUSE.slice(1));
                  const dad = addPerson(pick(FIRST) + ' ' + h, 'm', pick(TOTEM), '1900', '');
                  const sp = grow('child', dad, pick(FIRST) + ' ' + h,
                                  rnd() < 0.5 ? 'f' : 'm', pick(TOTEM),
                                  { born:String(1928 + gen * 25) });
                  all.push(dad, sp);
                  linkExisting('partner', k, sp);
                } else {
                  all.push(grow('partner', k, pick(FIRST) + ' ' + pick(HOUSE),
                                rnd() < 0.5 ? 'f' : 'm', '', {}));
                }
              }
              if (rnd() < 0.18)
                all.push(grow('partner', k, pick(FIRST) + ' ' + pick(HOUSE),
                              rnd() < 0.5 ? 'f' : 'm', '', {}));
            }
          }
          frontier = next;
        }
        setMe(all[Math.floor(rnd() * all.length)]);
        draw();
        const P = layout.persons, ids = Object.keys(P);
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++){
          const a = P[ids[i]], b = P[ids[j]];
          if (Math.abs(a.x - b.x) < POD_W - 2 && Math.abs(a.y - b.y) < POD_TALL - 2){
            out.push({ seed, people:ids.length,
                       a:(state.people[ids[i]] || {}).name, b:(state.people[ids[j]] || {}).name,
                       dx:Math.round(Math.abs(a.x - b.x)), dy:Math.round(Math.abs(a.y - b.y)) });
            i = ids.length; break;               // one report per family is enough
          }
        }
      }
      return out;
    });
    /* Reported short. When this breaks it breaks in most families at once —
       putting the old lane back fails a hundred and fifty of these two
       hundred — and two hundred entries on one line is a wall, not a
       report. */
    is(broken.slice(0, 4), [],
       `not one of two hundred random families has a pod on a pod` +
       (broken.length ? ` (${broken.length} do)` : ''));
  }

  await ctx.close();
  console.log(`\n  ${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
