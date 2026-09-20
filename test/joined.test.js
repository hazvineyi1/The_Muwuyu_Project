// Branches that stay connected.
//
// THE COMPLAINT: "the tree is not joined. One part of the family is on the
// other side instead of continuing to grow on the same side."
//
// Two separate faults underneath it, both caused by the same thing — the
// picture is laid out as a TREE and a family is not one. The moment two
// people who are both already in the tree marry each other, their row has two
// sets of parents wanting to claim it.
//
//   THE LINE WAS NOT DRAWN AT ALL. A row hangs under one parent row, decided
//   by whichever was reached first. That was also, wrongly, the only thing
//   that decided where a LINE was drawn — so the other set of parents got
//   none. A grandfather with one son in the tree sat at the edge of the
//   canvas joined to nothing, looking like a family nobody had finished
//   entering, when the app knew exactly whose father he was.
//
//   AND THEN SENIORITY THREW HIM FURTHER. Top-level families were ordered by
//   their elder's birth year, so a father born in 1900 landed at the far left
//   while his son stood in a household near the right.
//
// Position and connection are now separate: the block tree decides where
// people stand, the marriages decide what is joined to what.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const nm = (fe, id) => (fe.getState().people[id] || {}).name || '?';
const branches = (fe, L) => L.links.filter(l => l.kind === 'branch')
  .map(l => (l.parents || []).map(p => nm(fe, p)).join('&') + '->' + nm(fe, l.child)).sort();
const xOf = (fe, L, id) => L.persons[id].x;

/* Dad's household, his siblings, and an aunt who married a man whose own
 * father is also recorded — the shape that used to tear in half. */
function family(hisFatherBorn){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Grandfather', 'm', 'Mwendamberi', '1930');
  const dad = fe.grow('child', gf, 'Dad', 'm', 'Mwendamberi', { born:'1960' });
  const unc = fe.grow('child', gf, 'Uncle', 'm', 'Mwendamberi', { born:'1963' });
  const aunt = fe.grow('child', gf, 'Aunt', 'f', 'Mwendamberi', { born:'1966' });
  const hisDad = P('His father', 'm', 'Nzou', hisFatherBorn);
  const husb = fe.grow('child', hisDad, 'Aunt husband', 'm', 'Nzou', { born:'1964' });
  fe.linkExisting('partner', aunt, husb);
  return { fe, gf, dad, unc, aunt, hisDad, husb, L: fe.layoutOf() };
}

// ── the line ───────────────────────────────────────────────────────────────
section('EVERY PARENT THE FAMILY HAS RECORDED IS JOINED TO THEIR CHILD');
{
  const f = family('1935');
  const drawn = branches(f.fe, f.L);
  check('the grandfather reaches all three of his children',
        ['Dad', 'Uncle', 'Aunt'].every(n => drawn.includes('Grandfather->' + n)), drawn);
  check("and the husband's father reaches his son — the line that was missing",
        drawn.includes('His father->Aunt husband'), drawn);
}

section('nobody in the tree is left with no line at all');
/* The property the complaint is really about. Anyone whose parents are
   recorded must be reachable in the drawing, whichever household their row
   ended up standing in. */
{
  const f = family('1935');
  const joined = new Set(f.L.links.filter(l => l.kind === 'branch').map(l => l.child));
  for (const id of [f.dad, f.unc, f.aunt, f.husb]){
    check(`${nm(f.fe, id)} is joined to their parents`, joined.has(id));
  }
}

section('and the link is not drawn twice for the household it hangs from');
// The block's own parent link and the second pass must not both emit it.
{
  const f = family('1935');
  const drawn = branches(f.fe, f.L);
  eq('one line per parent-child pair', drawn.length, new Set(drawn).size);
  eq('four children, four lines', drawn.length, 4);
}

section('the reaching line says who the parents are, so a tap can name them');
{
  const f = family('1935');
  const reach = f.L.links.find(l => l.kind === 'branch' && l.child === f.husb);
  eq('it names his father', (reach.parents || []).map(p => nm(f.fe, p)), ['His father']);
  check('and is marked as reaching across rather than hanging below',
        reach.reaches === true, JSON.stringify(reach.reaches));
}

// ── the distance ───────────────────────────────────────────────────────────
section('CONNECTED HOUSEHOLDS ARE NOT SEPARATED BY A STRANGER');
/* Seniority alone put an unrelated elder between two families that reach each
   other, purely because his birth year fell between theirs. The groups are
   settled first; seniority then orders the groups and the people inside them. */
{
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Grandfather', 'm', 'Mwendamberi', '1930');
  const aunt = fe.grow('child', gf, 'Aunt', 'f', 'Mwendamberi', { born:'1966' });
  // 1929 falls between the two connected elders, 1928 and 1930.
  const stranger = P('Unrelated elder', 'm', 'Shava', '1929');
  fe.grow('child', stranger, 'Their child', 'f', 'Shava', { born:'1970' });
  const hisDad = P('His father', 'm', 'Nzou', '1928');
  const husb = fe.grow('child', hisDad, 'Aunt husband', 'm', 'Nzou', { born:'1964' });
  fe.linkExisting('partner', aunt, husb);

  const L = fe.layoutOf();
  const a = xOf(fe, L, hisDad), b = xOf(fe, L, gf), s = xOf(fe, L, stranger);
  check('the two households that reach each other are side by side',
        (s > a && s > b), JSON.stringify({ hisFather:a, grandfather:b, stranger:s }));
  check('and the stranger is outside them, not between',
        !(s > Math.min(a, b) && s < Math.max(a, b)),
        JSON.stringify({ hisFather:a, grandfather:b, stranger:s }));
}

section('a father far older than the rest stands over his own son, not at the edge');
/* This used to assert that the two elders were neighbours on the top row,
   which was the best that could be done while every family had to be a
   top-level family sorted by seniority. It is no longer the best: a house
   that gave a child to another house and kept none of its own now stands in
   the lane directly over that child, so the line is a short drop rather than
   a reach across whatever happens to lie between two birth years. The
   property the old assertion was protecting — he is kept with the family he
   reaches — is the one asserted here, and harder. */
{
  const f = family('1900');
  const him = f.L.persons[f.hisDad], son = f.L.persons[f.husb];
  check('he is not standing among the elders of the other house',
        him.y !== f.L.persons[f.gf].y, JSON.stringify({ him:him.y, gf:f.L.persons[f.gf].y }));
  check('he is between his son and that row',
        him.y > son.y && him.y < f.L.persons[f.gf].y,
        JSON.stringify({ son:son.y, him:him.y, elders:f.L.persons[f.gf].y }));
  check('and he is within a pod of standing straight under him',
        Math.abs(him.x - son.x) < 162, String(Math.round(Math.abs(him.x - son.x))));
}

section('and a visiting house never breaks a row of brothers and sisters');
/* The first attempt at this put him in the nearest free place on the elders'
   row. Every free place on a row of siblings is between two of them. */
{
  const f = family('1900');
  const row = Object.entries(f.L.persons).filter(([, q]) => q.y === f.L.persons[f.gf].y);
  eq('the elders row holds only the elders of that house',
     row.map(([id]) => nm(f.fe, id)).sort(), ['Grandfather']);
}

// ── the things that must not have changed ──────────────────────────────────
section('a family with nothing to do with another is still ordered by seniority');
{
  const fe = loadFrontend();
  const a = fe.addPerson('Elder born 1920', 'm', 'Shava', '1920', '');
  const b = fe.addPerson('Elder born 1950', 'm', 'Nzou', '1950', '');
  const L = fe.layoutOf();
  check('older first', L.persons[a].x < L.persons[b].x,
        JSON.stringify({ a:L.persons[a].x, b:L.persons[b].x }));
}

// ── the line that crossed the whole canvas ─────────────────────────────────
section('A MARRIAGE IS NEVER DRAWN AS A LINE ACROSS THE WHOLE ROW');
/* A row is everybody joined by marriage, laid out left to right, and the
   marriages are horizontal bonds between them. A plain walk reads fine for a
   chain — A married X, X married B — and falls apart on the shape families
   actually have. A man with three wives is a star: the walk went down his
   first wife, followed HER earlier marriage and that husband's other wife to
   the end of the row, then came back for the second and third wives. So a
   marriage one step wide was drawn spanning six people and half the screen,
   and the couple looked like they were on opposite sides of the tree. */
function remarried(){
  const fe = loadFrontend();
  const P = (n, s, b) => fe.addPerson(n, s, 'Mwendamberi', b, '');
  const man = P('Man', 'm', '1940');
  const w1 = P('First wife', 'f', '1942');
  const w2 = P('Second wife', 'f', '1950');
  const w3 = P('Third wife', 'f', '1955');
  fe.addUnion([man, w1], []); fe.addUnion([man, w2], []); fe.addUnion([man, w3], []);
  const ex = P('Her earlier husband', 'm', '1938'); fe.addUnion([w1, ex], []);
  const exw = P('His other wife', 'f', '1944'); fe.addUnion([ex, exw], []);
  return { fe, L: fe.layoutOf() };
}
const bondSpans = L => L.links.filter(l => l.kind === 'bond')
  .map(l => Math.round((l.x2 - l.x1) / 162));
{
  const r = remarried();
  const worst = Math.max(...bondSpans(r.L));
  check('no marriage reaches past more than one person', worst <= 2, 'worst span ' + worst);
}

section('and that is the best a single row can do, not merely better');
/* Two is the floor, not a threshold somebody tuned. A row is one line of
   people: a man with three wives can stand beside two of them and no
   arrangement puts him beside the third. */
{
  const r = remarried();
  const spans = bondSpans(r.L).sort();
  eq('every marriage but one is side by side',
     spans.filter(n => n === 1).length, spans.length - 1);
}

section('it holds when several households have remarried');
// The shape that made the line cross the whole canvas in a real tree.
{
  const fe = loadFrontend();
  const P = n => fe.addPerson(n, 'f', 'Mwendamberi', '1950', '');
  const hub1 = fe.addPerson('Hub one', 'm', 'Mwendamberi', '1950', '');
  const wives = ['a', 'b', 'c'].map(k => { const w = P('one ' + k); fe.addUnion([hub1, w], []); return w; });
  const hub2 = fe.addPerson('Hub two', 'm', 'Mwendamberi', '1950', '');
  fe.addUnion([wives[0], hub2], []);
  ['d', 'e'].forEach(k => fe.addUnion([hub2, P('two ' + k)], []));

  const worst = Math.max(...bondSpans(fe.layoutOf()));
  check('still no long reach with seven people and two hubs',
        worst <= 2, 'worst span ' + worst);
}

section('and drawing the same tree twice still moves nobody');
{
  const f = family('1935');
  eq('identical', JSON.stringify(f.fe.layoutOf().persons),
                  JSON.stringify(f.fe.layoutOf().persons));
}

report();
