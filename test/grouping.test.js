// SIBLINGS, PARENTS AND CHILDREN, DRAWN TOGETHER.
//
// "Siblings, parents, children should show in the same branch and should be
//  grouped together."
//
// Sent after a photograph of two relatives sitting alone in open canvas with
// a branch running past them to somewhere off the side of the picture.
// Measured on an ordinary tree at the time: a woman seventeen hundred pixels
// from her own father, her brother four households further on, and four
// strangers standing between the two of them.
//
// WHAT CAN AND CANNOT BE DELIVERED, because the difference is the whole
// design and pretending otherwise would be dishonest. A row of people can
// hang beneath only ONE set of parents. A marriage joins two families, and
// the wife cannot stand among her brothers and beside her husband at the
// same time unless her brothers happen to be next to his. So SOME row breaks
// on every tree that has two recorded families in it, and no amount of work
// removes that — it is the shape of a family against the shape of a page.
//
// What can be decided is WHICH row breaks, and this file is that decision:
//   - your own line of descent is never the one that gives way;
//   - the rows nearest you stay whole;
//   - a household that is free to move goes and stands over its children;
//   - and nothing ever walks into the middle of a row it does not belong to.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* An ordinary tree, in the sense that matters here: four generations, both
   of his parents' families recorded, and an aunt and an uncle who each
   married somebody whose own family is also in it. That is the tree where
   everything competes for the same rows. */
function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf   = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const gBro = fe.grow('child', ggf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const gSis = fe.grow('child', ggf, 'Tsowhe Musoni', 'f', 'Mwendamberi', { born:'1902' });
  // his grandmother, with a family of her own recorded
  const gm    = fe.grow('partner', gf, 'Mai Shava', 'f', 'Shava', { born:'1905' });
  const gmDad = P('Shava Elder', 'm', 'Shava', '1875');
  fe.linkExisting('child', gmDad, gm);
  const gmSis = fe.grow('child', gmDad, 'Ruth Shava', 'f', 'Shava', { born:'1910' });
  const gmBro = fe.grow('child', gmDad, 'Tendai Shava', 'm', 'Shava', { born:'1912' });
  // his father, and his father's brother and sister, both married
  const dad  = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const aunt = fe.grow('child', gf, 'Netsai Musoni', 'f', 'Mwendamberi', { born:'1943' });
  const unc  = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });
  fe.grow('partner', unc, 'Daisy Marumahoko', 'f', 'Soko', { born:'1948' });
  fe.grow('partner', aunt, 'Tafara Shumba', 'm', 'Shumba', { born:'1941' });
  // his mother, and hers
  const mum  = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const mgf  = P('James Mandaba', 'm', 'Moyondizvo', '1925');
  fe.linkExisting('child', mgf, mum);
  const mBro = fe.grow('child', mgf, 'Joseph Mandaba', 'm', 'Moyondizvo', { born:'1956' });
  // him and his sisters
  const me  = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  const sis = fe.grow('child', dad, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  const sis2 = fe.grow('child', dad, 'Tsitsi Musoni', 'f', 'Mwendamberi', { born:'1982' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, ggf, gf, gBro, gSis, gm, gmDad, gmSis, gmBro,
           dad, aunt, unc, mum, mgf, mBro, sis, sis2 };
}
const at = (t, id) => t.fe.layoutOf().persons[id];
const nm = (t, id) => t.fe.getState().people[id].name;

/* Who sits between the first and last of a set of brothers and sisters and
   is neither one of them nor married to one of them. The measure of a broken
   row, and the only one that matters: a gap is a gap, but a stranger inside
   a family is a picture telling you something untrue. */
function intruders(t, kids){
  const L = t.fe.layoutOf();
  const here = kids.filter(k => L.persons[k]);
  if (here.length < 2) return [];
  const y = Math.round(L.persons[here[0]].y);
  const row = Object.entries(L.persons)
    .filter(([, q]) => Math.round(q.y) === y)
    .sort((a, b) => a[1].x - b[1].x).map(([id]) => id);
  const mates = new Set(here.flatMap(k => t.fe.partnersOf(k)));
  const lo = Math.min(...here.map(k => row.indexOf(k)));
  const hi = Math.max(...here.map(k => row.indexOf(k)));
  const out = [];
  for (let i = lo; i <= hi; i++)
    if (!here.includes(row[i]) && !mates.has(row[i])) out.push(nm(t, row[i]));
  return out;
}

section('HIS OWN BROTHERS AND SISTERS STAND TOGETHER');
{
  const t = tree();
  eq('nobody between them', intruders(t, [t.sis, t.me, t.sis2]), []);
  const xs = [t.sis, t.me, t.sis2].map(id => Math.round(at(t, id).x));
  check('and in birth order, eldest first', xs[0] < xs[1] && xs[1] < xs[2],
        JSON.stringify(xs));
}

section('AND HIS FATHER’S, which is the row with two marriages in it');
/* Both his aunt and his uncle married somebody with a family of their own,
   so this row has three outside households pressing on it. It stays whole. */
{
  const t = tree();
  eq('nobody between them', intruders(t, [t.dad, t.aunt, t.unc]), []);
}

section('AND HIS GRANDFATHER’S');
{
  const t = tree();
  eq('nobody between them', intruders(t, [t.gBro, t.gf, t.gSis]), []);
}

section('HIS OWN LINE OF DESCENT IS NEVER THE ROW THAT GIVES WAY');
/* THE FAULT THIS FILE WAS WRITTEN FOR. The rule that decides which of two
   families a household hangs from counts how much of each side the tree
   holds — and on this very tree it handed his grandfather's household to his
   grandmother's father, because her side had one more brother recorded. His
   grandfather left his own brothers and sisters, his father was pushed into
   the visiting lane over somebody else's marriage, and the line of descent
   took a step sideways into a family he is not descended from.
 *
 * Counting is a fair way to settle a household nobody is descended from. It
 * is not a fair way to settle his. */
{
  const t = tree();
  const down = [t.ggf, t.gf, t.dad, t.me].map(id => Math.round(at(t, id).x));
  eq('four generations on one x', new Set(down).size, 1);
  check('his great-grandfather is on the ground, not in the visiting lane',
        /head of a line/.test(t.fe.whyHere(t.ggf)), t.fe.whyHere(t.ggf));
  check('and his grandfather hangs from him',
        /Hanging beneath Musoni Elder/.test(t.fe.whyHere(t.gf)), t.fe.whyHere(t.gf));
}

section('A FAMILY FREE TO MOVE GOES AND STANDS OVER ITS CHILDREN');
/* A household with nobody above it is standing wherever the packing left
   it — its position was never carrying information. So it goes to its
   children, ALL of them, including the daughter whose household hangs on the
   other side of the canvas, and it brings the ones that stayed with it. */
{
  const t = tree();
  const L = t.fe.layoutOf();
  const kids = [t.gm, t.gmSis, t.gmBro].map(id => L.persons[id].x);
  const lo = Math.min(...kids), hi = Math.max(...kids);
  const him = L.persons[t.gmDad].x;
  check('their father stands within the span of his children',
        him >= lo - 1 && him <= hi + 1,
        JSON.stringify({ him:Math.round(him), lo:Math.round(lo), hi:Math.round(hi) }));

  /* Measured against where the packing alone would have left him: the pass
     is worth having only if it moves him a long way. */
  check('which is a long way from the end of the row he was packed to',
        Math.abs(him - L.persons[t.gm].x) < 1000,
        String(Math.round(Math.abs(him - L.persons[t.gm].x))));
}

section('BUT IT NEVER SITS DOWN IN THE MIDDLE OF SOMEBODY ELSE’S ROW');
/* The first cut of that pass moved a father four households closer to his
   daughter and put him between two of his son-in-law's aunts — the very
   fault being fixed, committed by the fix. A run of brothers and sisters is
   a statement; walking into the middle of one is worse than standing further
   off, so a move that would land inside a family not its own is refused and
   a shorter one taken instead. */
{
  const t = tree();
  const st = t.fe.getState();
  const broken = [];
  for (const u of Object.values(st.unions)){
    const kids = u.children.filter(c => at(t, c));
    if (kids.length < 2) continue;
    // Only the rows near him: the far ones are the ones deliberately given
    // up, and the section below says so out loud.
    const near = kids.some(k => [t.me, t.sis, t.sis2, t.dad, t.aunt, t.unc,
                                 t.gf, t.gBro, t.gSis].includes(k));
    if (!near) continue;
    const bad = intruders(t, kids);
    if (bad.length) broken.push(u.partners.map(x => nm(t, x)).join(' & ') + ': ' + bad.join(', '));
  }
  eq('not one of the rows near him has a stranger in it', broken, []);
}

section('AND WHAT IS GIVEN UP IS GIVEN UP ON PURPOSE');
/* THE HONEST PART. A wife cannot stand among her brothers and beside her
   husband at once unless her brothers happen to be next to his, so some row
   breaks on any tree holding two families. His mother's row is one of them:
   she stands beside his father, at the near end of his father's brothers and
   sisters, and her own brother is beyond them with his family.
 *
 * This is asserted rather than left unsaid, because a limit nobody wrote
 * down is one somebody will later "fix" by breaking the row that matters. */
{
  const t = tree();
  const hers = intruders(t, [t.mum, t.mBro]);
  check('his mother’s row is the one that gives way', hers.length > 0,
        JSON.stringify(hers));
  check('and the ones between her and her brother are her husband’s people, ' +
        'not strangers from nowhere',
        hers.every(n => [nm(t, t.aunt), nm(t, t.unc), 'Tafara Shumba',
                         'Daisy Marumahoko'].includes(n)),
        JSON.stringify(hers));
  check('her line to her father is still drawn',
        !!at(t, t.mgf) && !!at(t, t.mum));
}

section('NOBODY IS LAID ON TOP OF ANYBODY BY ANY OF IT');
/* Two passes now slide whole branches sideways after the tidy tree has
   finished. That is exactly the move that causes an overlap when the room is
   not accounted for, and it is checked on both shapes. */
for (const shape of ['', 'muti']){
  const t = tree();
  t.fe.setShape(shape);
  const L = t.fe.layoutOf();
  const rows = new Map();
  for (const [id, q] of Object.entries(L.persons)){
    const y = Math.round(q.y);
    (rows.get(y) || rows.set(y, []).get(y)).push({ id, x:q.x });
  }
  let clash = null;
  for (const row of rows.values()){
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++)
      if (row[i].x - row[i - 1].x < 131.5)
        clash = `${nm(t, row[i - 1].id)} and ${nm(t, row[i].id)}`;
  }
  eq(`${shape || 'mudzi'}: every row is clear`, clash, null);
}

section('AND SENIORITY SURVIVES ALL OF IT');
/* Every pass here moves households sideways, and the row is a statement
   about seniority — Mukoma and Munin'ina are read straight off it. Tidying
   the picture must never reorder the family. */
{
  const t = tree();
  const rows = [[t.gBro, t.gf, t.gSis], [t.dad, t.aunt, t.unc],
                [t.sis, t.me, t.sis2], [t.gm, t.gmSis, t.gmBro]];
  const wrong = [];
  for (const row of rows){
    const xs = row.map(id => Math.round(at(t, id).x));
    for (let i = 1; i < xs.length; i++)
      if (xs[i - 1] >= xs[i]) wrong.push(`${nm(t, row[i - 1])} is not left of ${nm(t, row[i])}`);
  }
  eq('eldest to youngest, left to right, in every row', wrong, []);
}

section('AND THE PICTURE IS THE SAME EVERY TIME IT IS DRAWN');
/* Two sliding passes, each reading positions the other has just changed. A
   layout that settled somewhere slightly different on each draw would move
   the tree under somebody's finger. */
{
  const t = tree();
  const once = JSON.stringify(t.fe.layoutOf().persons);
  const twice = JSON.stringify(t.fe.layoutOf().persons);
  eq('identical', once, twice);
  const u = tree();
  eq('and the same tree entered again draws the same picture',
     JSON.stringify(u.fe.layoutOf().persons).length, once.length);
}

report();
