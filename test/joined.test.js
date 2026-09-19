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

section('a father far older than the rest is still kept with the family he reaches');
{
  const f = family('1900');
  const order = Object.entries(f.L.persons)
    .filter(([, q]) => q.y === 0).sort((x, y) => x[1].x - y[1].x)
    .map(([id]) => nm(f.fe, id));
  eq('the two elders are neighbours on the top row', order, ['His father', 'Grandfather']);
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

section('and drawing the same tree twice still moves nobody');
{
  const f = family('1935');
  eq('identical', JSON.stringify(f.fe.layoutOf().persons),
                  JSON.stringify(f.fe.layoutOf().persons));
}

report();
