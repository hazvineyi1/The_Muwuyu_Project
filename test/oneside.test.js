// One family, one side.
//
// THE COMPLAINT, three times over three days, and the last one is the whole
// brief: "one part of the family is on the other side instead of continuing
// to grow on the same side"; "my dads siblings are growing on the other side";
// "make sure all family are aligned and on the same side, not across the
// screen with no reasoning".
//
// The last four words name the fault exactly. The picture WAS reasoned. It
// was reasoned by the order people had been typed in, which is not a reason a
// family can see, and so from the outside it looked like no reason at all.
//
// Three decisions had never been made, and were being made by accident:
//
//   WHICH HOUSE A HOUSEHOLD HANGS FROM. A married couple can have two sets of
//   parents recorded and the drawing can hang them under only one. It used to
//   be whichever the walk reached first. So a man's household could hang
//   under his wife's father, his own father would be left as a family of his
//   own elsewhere on the canvas, and his brothers and sisters would appear to
//   be growing on the other side.
//
//   WHICH WAY THE ROW FACES. The rule was already "the line's own stands
//   nearer the senior end than the one who married in" — but it asked "are
//   this person's parents recorded", which is a different question, and a
//   woman whose father was in the tree could stand on the far side of the
//   husband whose house the row hangs from, with her father's line crossing
//   over him to reach her.
//
//   WHERE THE FAMILY A SPOUSE CAME FROM STANDS. Nowhere: it became a
//   top-level family and was sorted by its elder's birth year to wherever
//   that fell, often the far side of the canvas, with a line to the daughter
//   crossing everything between. Seven pods wide in a tree of eighteen.
//
// All three are now decided, and decided by something a family can name.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const POD_W = 132;
const nm = (fe, id) => (fe.getState().people[id] || {}).name || String(id);
const xOf = (L, id) => L.persons[id].x;
const yOf = (L, id) => L.persons[id].y;

/* The shape that tears: a house with five children, two of whom married
   people whose own fathers are recorded. */
function house(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Sekuru', 'm', 'Mwendamberi', '1925');
  const gm = fe.grow('partner', gf, 'Mbuya', 'f', 'Shava', { born:'1930' });
  const ben  = fe.grow('child', gf, 'Ben', 'm', 'Mwendamberi', { born:'1952' });
  const dad  = fe.grow('child', gf, 'Dad', 'm', 'Mwendamberi', { born:'1956' });
  const tete = fe.grow('child', gf, 'Tete', 'f', 'Mwendamberi', { born:'1959' });
  const unc  = fe.grow('child', gf, 'Uncle', 'm', 'Mwendamberi', { born:'1962' });

  fe.grow('partner', ben, 'Esther', 'f', 'Shava', { born:'1955' });     // married in, no people
  const mai = fe.grow('partner', dad, 'Mai', 'f', 'Nzou', { born:'1958' });
  const maiDad = P('Mai father', 'm', 'Nzou', '1930');
  fe.linkExisting('child', maiDad, mai);                                 // her own father
  const hus = P('Tete husband', 'm', 'Soko', '1957');
  const husDad = P('Tete father-in-law', 'm', 'Soko', '1928');
  fe.linkExisting('child', husDad, hus);
  fe.linkExisting('partner', tete, hus);

  ['A', 'B', 'C'].forEach((n, i) =>
    fe.grow('child', dad, 'Me' + n, 'm', 'Mwendamberi', { born:String(1985 + i*3) }));
  return { fe, gf, gm, ben, dad, tete, unc, mai, maiDad, hus, husDad, L: fe.layoutOf() };
}

section('THE CHILDREN OF ONE HOUSE STAND TOGETHER, WITH NOBODY ELSE AMONG THEM');
/* The complaint itself. Dad's brothers and sisters are four people; nothing
   from another house may stand between the first and the last of them. */
{
  const h = house();
  const kids = [h.ben, h.dad, h.tete, h.unc];
  const y = yOf(h.L, h.ben);
  const lo = Math.min(...kids.map(k => xOf(h.L, k)));
  const hi = Math.max(...kids.map(k => xOf(h.L, k)));
  const between = Object.entries(h.L.persons)
    .filter(([id, q]) => q.y === y && q.x > lo && q.x < hi && !kids.includes(id))
    .map(([id]) => id);
  // Somebody married to one of them stands in the row with them; that is the
  // row working, not the row broken.
  const strangers = between.filter(id => !h.fe.partnersOf(id).some(x => kids.includes(x)));
  eq('nobody from another house is standing in the middle of them',
     strangers.map(id => nm(h.fe, id)), []);
  check('and they are all on the one row',
        kids.every(k => yOf(h.L, k) === y));
}

section('a household hangs from the side the tree actually knows');
/* Tete and her husband each have a father recorded. Hers has four children
   and a wife in the picture; his has one son and nothing else. The household
   belongs under hers — not because she is a woman or he is a man, but because
   that is plainly the family this tree is of. */
{
  const h = house();
  const hangs = h.L.links.find(l => l.kind === 'branch' && !l.reaches &&
                                    (l.child === h.tete || l.child === h.hus));
  eq('it hangs from her father', nm(h.fe, hangs.child), 'Tete');
  check('and her husband is standing beside her, not under his own father',
        yOf(h.L, h.hus) === yOf(h.L, h.tete));
}

section('and the one it hangs from leads the row');
/* Rule one of the row order is that the line's own stands nearer the senior
   end than the one who married in. "Has parents recorded" answered a
   different question, and got this backwards every time a spouse's father
   was in the tree. */
{
  const h = house();
  check('Tete stands before the man who married into her house',
        xOf(h.L, h.tete) < xOf(h.L, h.hus),
        JSON.stringify({ tete:xOf(h.L, h.tete), husband:xOf(h.L, h.hus) }));
  check('and Dad before the woman who married into his',
        xOf(h.L, h.dad) < xOf(h.L, h.mai));
}

section('THE HOUSE A SPOUSE CAME FROM STANDS OVER THEM, NOT ACROSS THE CANVAS');
{
  const h = house();
  const drop = Math.abs(xOf(h.L, h.maiDad) - xOf(h.L, h.mai));
  check('her father is within a pod of standing straight under her',
        drop < POD_W, `${Math.round(drop)}px — ${(drop / POD_W).toFixed(1)} pods`);
  check('and so is his father under him',
        Math.abs(xOf(h.L, h.husDad) - xOf(h.L, h.hus)) < POD_W);
}

section('in a lane of their own, because every free place on a row is between somebody');
/* The first attempt put them in the nearest free place on the row where
   their generation stands. That row is a row of brothers and sisters, and a
   father-in-law dropped into it stood between two of them — the same
   complaint, one generation up. */
{
  const h = house();
  const elders = Object.entries(h.L.persons).filter(([, q]) => q.y === yOf(h.L, h.gf));
  eq('the elders of this house have their row to themselves',
     elders.map(([id]) => nm(h.fe, id)).sort(), ['Mbuya', 'Sekuru']);
  check('the visiting houses are between that row and the household',
        yOf(h.L, h.maiDad) > yOf(h.L, h.dad) && yOf(h.L, h.maiDad) < yOf(h.L, h.gf),
        JSON.stringify({ dad:yOf(h.L, h.dad), maiDad:yOf(h.L, h.maiDad), gf:yOf(h.L, h.gf) }));
  check('and the two of them are not on top of each other',
        Math.abs(xOf(h.L, h.maiDad) - xOf(h.L, h.husDad)) >= POD_W);
}

section('their line is still drawn — nothing is cut, only moved');
{
  const h = house();
  const hers = h.L.links.find(l => l.kind === 'branch' && l.child === h.mai);
  check('the line from her father to her is there', !!hers, 'no line at all');
  check('and it is marked as reaching across rather than hanging below',
        hers.reaches === true, JSON.stringify(hers && hers.reaches));
  check('the panel can still name her father as her father',
        (hers.parents || []).map(p => nm(h.fe, p)).includes('Mai father'),
        JSON.stringify((hers.parents || []).map(p => nm(h.fe, p))));
}

section('WHERE BOTH SIDES ARE KNOWN EQUALLY, THE HOUSE DECIDES');
/* Two families, each traced one generation, each with two children: nothing
   separates them by how much this tree holds. A Shona household belongs to a
   dzinza and the dzinza descends through its men, so it hangs from his
   father. This is the one place the rule shows, and it is the right place:
   where the picture has no other reason, the family's own reckoning is the
   reason. */
{
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const hisDad = P('His father', 'm', 'Nzou', '1930');
  const him = fe.grow('child', hisDad, 'Him', 'm', 'Nzou', { born:'1960' });
  fe.grow('child', hisDad, 'His brother', 'm', 'Nzou', { born:'1964' });
  const herDad = P('Her father', 'm', 'Shava', '1932');
  const her = fe.grow('child', herDad, 'Her', 'f', 'Shava', { born:'1962' });
  fe.grow('child', herDad, 'Her sister', 'f', 'Shava', { born:'1966' });
  fe.linkExisting('partner', him, her);

  const L = fe.layoutOf();
  const hang = L.links.find(l => l.kind === 'branch' && !l.reaches &&
                                 (l.child === him || l.child === her));
  eq('the household is part of his house', nm(fe, hang.child), 'Him');
}

section('NOBODY IN THE PICTURE IS STANDING ON ANYBODY');
/* The plainest thing a family would notice, and it was never asserted. It
   only became possible to break when houses were placed outside the tidy
   pass, so it is asserted over generated families rather than over one. */
{
  // A deterministic family builder — the same eight trees every run.
  const build = seed => {
    let n = seed;
    const rnd = () => (n = (n * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    const fe = loadFrontend();
    const T = ['Mwendamberi', 'Shava', 'Nzou', 'Soko', 'Moyo'];
    const root = fe.addPerson('Root', 'm', T[0], '1910', '');
    fe.grow('partner', root, 'Root wife', 'f', T[1], { born:'1914' });
    let pool = [root], year = 1910;
    for (let gen = 0; gen < 3; gen++){
      const next = [];
      for (const p of pool){
        for (let i = 0, kids = 1 + Math.floor(rnd() * 4); i < kids; i++){
          const sex = rnd() < .5 ? 'm' : 'f';
          const k = fe.grow('child', p, `g${gen}p${next.length}`, sex, T[gen % T.length],
                            { born:String(year + 26 + i*3) });
          if (rnd() < .75){
            const sp = fe.grow('partner', k, `sp${gen}${next.length}`, sex === 'm' ? 'f' : 'm',
                               T[(gen+2) % T.length], { born:String(year + 28 + i*3) });
            if (rnd() < .5){
              const d = fe.addPerson(`in${gen}${next.length}`, 'm', T[(gen+2) % T.length],
                                     String(year - 2), '');
              fe.linkExisting('child', d, sp);
            }
          }
          next.push(k);
        }
      }
      pool = next; year += 26;
    }
    return fe;
  };

  let overlaps = [], split = [], biggest = 0;
  for (const seed of [1, 2, 3, 7, 11, 19, 23, 42]){
    const fe = build(seed), L = fe.layoutOf(), S = fe.getState();
    biggest = Math.max(biggest, Object.keys(L.persons).length);

    const rows = {};
    for (const [id, q] of Object.entries(L.persons)) (rows[q.y] = rows[q.y] || []).push([q.x, id]);
    for (const y of Object.keys(rows)){
      const r = rows[y].sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < r.length; i++){
        if (r[i][0] - r[i-1][0] < POD_W - 0.5)
          overlaps.push(`seed ${seed}: ${nm(fe, r[i-1][1])} / ${nm(fe, r[i][1])}`);
      }
    }

    for (const u of Object.values(S.unions)){
      const kids = u.children.filter(c => L.persons[c]);
      if (kids.length < 2) continue;
      const y = L.persons[kids[0]].y;
      if (!kids.every(c => L.persons[c].y === y)) continue;
      const xs = kids.map(c => L.persons[c].x);
      const lo = Math.min(...xs), hi = Math.max(...xs);
      const strangers = Object.entries(L.persons)
        .filter(([id, q]) => q.y === y && q.x > lo && q.x < hi && !kids.includes(id))
        .filter(([id]) => !fe.partnersOf(id).some(x => kids.includes(x)));
      if (strangers.length) split.push(`seed ${seed}: ${strangers.map(([id]) => nm(fe, id)).join(',')}`);
    }
  }
  check('the trees are big enough for this to mean something', biggest > 80, String(biggest));
  eq('no two pods overlap, in any of them', overlaps, []);
  eq('and no row of brothers and sisters is broken by an outsider', split, []);
}

section('and the same family draws the same way twice');
// Everything above is a rule about where somebody stands. A rule that gives
// two answers is not one.
{
  const h = house();
  eq('identical', JSON.stringify(h.fe.layoutOf().persons),
                  JSON.stringify(h.fe.layoutOf().persons));
}

// ── strung out by one brother's household ─────────────────────────────────
//
// THE COMPLAINT, third time in different words, with a photograph and an
// arrow drawn on it: "this is the siblings. They are on the other side. Look
// at the arrow and put the siblings in line with the Chaitezvi-Mavhu family."
// Chaitezvi and Mavhu sat alone in the middle of the canvas; their children
// were at both far edges of it, joined to them by lines a thousand pixels
// long.
//
// IT WAS NOT A BUG, which is why the last two passes left it alone. The
// picture is a tidy tree: every child of a marriage is given room for
// everything hanging below it before the next child is placed. So one
// brother with four wives and eleven children takes a thousand pixels of the
// row, and a brother and sister with nobody below them at all are pushed out
// past the far end of his family to make room for it. Every line in that
// picture is correct and the picture is still wrong: it is showing the size
// of one man's household as though it were distance between his family.

function strungOut(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const chai = P('Chaitezvi', 'm', 'Mwendamberi', '1900');
  fe.grow('partner', chai, 'Mavhu', 'f', 'Shava', { born:'1905' });
  const baya = fe.grow('child', chai, 'Baya', 'm', 'Mwendamberi', { born:'1925' });
  fe.grow('partner', baya, 'Maitiewa', 'f', 'Nzou', { born:'1928' });
  const ben  = fe.grow('child', chai, 'Ben', 'm', 'Mwendamberi', { born:'1932' });
  const thom = fe.grow('child', chai, 'Thomas', 'm', 'Mwendamberi', { born:'1937' });
  fe.grow('partner', thom, 'Idah', 'f', 'Soko', { born:'1940' });
  ['Esther', 'Roslyn', 'Emma', 'Evelyn'].forEach((w, i) => {
    const wife = fe.grow('partner', ben, w, 'f', ['Shava', 'Nzou', 'Soko', 'Moyo'][i],
                         { born:String(1935 + i*4) });
    for (let j = 0; j < 3; j++)
      fe.grow('child', wife, `${w}'s ${j + 1}`, j % 2 ? 'f' : 'm', 'Mwendamberi',
              { born:String(1960 + i*3 + j) });
  });
  return { fe, chai, baya, ben, thom, L: fe.layoutOf() };
}

section('A BROTHER WITH NOBODY BELOW HIM IS NOT PUSHED PAST HIS BROTHER’S FAMILY');
{
  const t = strungOut();
  const gap = Math.abs(xOf(t.L, t.baya) - xOf(t.L, t.thom)) / POD_W;
  check('the eldest and the youngest are within a few pods of each other',
        gap < 12, `${gap.toFixed(1)} pods apart`);
  const from = Math.abs(xOf(t.L, t.baya) - xOf(t.L, t.chai)) / POD_W;
  check('and the eldest stands near his own parents',
        from < 6, `${from.toFixed(1)} pods from his father`);
}

section('but he keeps his place among his brothers and sisters');
/* The row is a statement about seniority — Mukoma and Munin’ina are read
   off it — so tidying the picture must never reorder it. The eldest does not
   end up standing to the right of the younger brother whose family pushed
   him out. */
{
  const t = strungOut();
  check('eldest, then the brother with the household, then the youngest',
        xOf(t.L, t.baya) < xOf(t.L, t.ben) && xOf(t.L, t.ben) < xOf(t.L, t.thom),
        JSON.stringify({ baya:Math.round(xOf(t.L, t.baya)), ben:Math.round(xOf(t.L, t.ben)),
                         thomas:Math.round(xOf(t.L, t.thom)) }));
  check('and all three are on the one row',
        yOf(t.L, t.baya) === yOf(t.L, t.ben) && yOf(t.L, t.ben) === yOf(t.L, t.thom));
}

section('the brother with the household does not move, because he cannot');
/* He is standing over his own wives and children. Anybody with a family
   below them has a reason for where they are; the ones who get pushed out
   are exactly the ones whose position was never carrying any information. */
{
  const t = strungOut();
  const kids = Object.keys(t.fe.getState().people)
    .filter(id => /'s \d$/.test(t.fe.getState().people[id].name));
  const lo = Math.min(...kids.map(k => xOf(t.L, k)));
  const hi = Math.max(...kids.map(k => xOf(t.L, k)));
  const ben = xOf(t.L, t.ben);
  check('he is still over his eleven children',
        ben > lo - POD_W * 2 && ben < hi + POD_W * 2,
        JSON.stringify({ ben:Math.round(ben), from:Math.round(lo), to:Math.round(hi) }));
}

section('and a family that is already gathered round its parents is left alone');
/* A rescue, not a rearrangement. A picture that shuffled itself every time
   somebody was added would be worse than the one it fixed. */
{
  const fe = loadFrontend();
  const dad = fe.addPerson('Dad', 'm', 'Nzou', '1940', '');
  ['A', 'B', 'C', 'D'].forEach((n, i) =>
    fe.grow('child', dad, n, 'm', 'Nzou', { born:String(1965 + i*3) }));
  const before = JSON.stringify(fe.layoutOf().persons);
  eq('nothing moved', JSON.stringify(fe.layoutOf().persons), before);
  const L = fe.layoutOf();
  const xs = ['A', 'B', 'C', 'D'].map(n =>
    L.persons[Object.keys(fe.getState().people).find(k => fe.getState().people[k].name === n)].x);
  check('and they are still in birth order, evenly spaced',
        xs.every((x, i) => i === 0 || x > xs[i-1]), JSON.stringify(xs.map(Math.round)));
}

section('AND A BRANCH WITH PEOPLE UNDER IT COMES TOO, ALL OF IT AT ONCE');
/* The shape in the photograph: it was not the childless ones who had been
   pushed out, it was an eldest son with a son of his own. A branch is one
   thing and moves as one thing — the household, everybody below it, and the
   shape they make together, shifted by the same amount, with nothing inside
   it changed at all. It goes as far in as there is room for on every row it
   occupies, which is sometimes none. */
{
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const chai = P('Chaitezvi', 'm', 'Mwendamberi', '1900');
  fe.grow('partner', chai, 'Mavhu', 'f', 'Shava', { born:'1905' });
  const baya = fe.grow('child', chai, 'Baya', 'm', 'Mwendamberi', { born:'1925' });
  fe.grow('partner', baya, 'Maitiewa', 'f', 'Nzou', { born:'1928' });
  const tsowhe = fe.grow('child', baya, 'Tsowhe', 'm', 'Mwendamberi', { born:'1955' });
  const thom = fe.grow('child', chai, 'Thomas', 'm', 'Mwendamberi', { born:'1932' });
  fe.grow('partner', thom, 'Idah', 'f', 'Soko', { born:'1935' });
  const ben = fe.grow('child', thom, 'Ben', 'm', 'Mwendamberi', { born:'1958' });
  const mavis = fe.grow('child', chai, 'Mavis', 'f', 'Mwendamberi', { born:'1941' });
  ['Esther', 'Roslyn', 'Emma', 'Evelyn'].forEach((w, i) => {
    const wife = fe.grow('partner', ben, w, 'f', ['Shava', 'Nzou', 'Soko', 'Moyo'][i],
                         { born:String(1960 + i*4) });
    for (let j = 0; j < 3; j++)
      fe.grow('child', wife, `${w} ${j + 1}`, j % 2 ? 'f' : 'm', 'Mwendamberi',
              { born:String(1985 + i*3 + j) });
  });

  const L = fe.layoutOf();
  /* Five pods wide is what these three ARE — two couples and a woman on her
     own — so the closest they can ever stand is about four and a half pods
     between the first and the last. Eight is shoulder to shoulder. Before
     this they were the width of the canvas apart. */
  const span = Math.abs(xOf(L, baya) - xOf(L, mavis)) / POD_W;
  check('the eldest and the youngest of the three are shoulder to shoulder',
        span < 8, `${span.toFixed(1)} pods`);
  check('all three stand over their own parents',
        [baya, thom, mavis].every(k =>
          Math.abs(xOf(L, k) - xOf(L, chai)) < POD_W * 5),
        JSON.stringify([baya, thom, mavis].map(k =>
          Math.round((xOf(L, k) - xOf(L, chai)) / POD_W * 10) / 10)));
  check('in birth order, eldest first',
        xOf(L, baya) < xOf(L, thom) && xOf(L, thom) < xOf(L, mavis));
  check("and the eldest's own son came with him",
        Math.abs(xOf(L, tsowhe) - xOf(L, baya)) < POD_W * 4,
        `${Math.round(Math.abs(xOf(L, tsowhe) - xOf(L, baya)) / POD_W * 10) / 10} pods`);

  // the thing a slide must never do
  const rows = {};
  for (const [id, q] of Object.entries(L.persons)) (rows[q.y] = rows[q.y] || []).push(q.x);
  let overlaps = 0;
  for (const y of Object.keys(rows)){
    const r = rows[y].sort((a, b) => a - b);
    for (let i = 1; i < r.length; i++) if (r[i] - r[i-1] < POD_W - 0.5) overlaps++;
  }
  eq('and nobody is standing on anybody', overlaps, 0);
  eq('drawn twice, the same', JSON.stringify(fe.layoutOf().persons),
                              JSON.stringify(fe.layoutOf().persons));
}

report();
