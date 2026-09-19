// Carrying a branch to the other side.
//
// THE ASK, with a screenshot of the join between two households circled: "I
// want to be able to grab a branch such as the one in the box, so I can move
// it to the other side."
//
// The arrows already move somebody one place, which is right for correcting a
// birth order and useless for picking up a whole household and putting it
// past its brothers and sisters.
//
// It is the same edit either way — a branch hangs where its person sits in
// their parents' row, so moving the branch IS moving them along that row —
// and most of what is asserted here is that it stays that and nothing more:
// no parents reassigned, nobody added or lost, and everyone below coming
// along because they were always below.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const names = (fe, ids) => ids.map(i => (fe.getState().people[i] || {}).name || '?');
const row = fe => Object.values(fe.getState().unions)[0].children;

function household(){
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1930', '');
  const kids = ['Eldest', 'Second', 'Third', 'Fourth'].map((n, i) =>
    fe.grow('child', baba, n, 'm', 'Mwendamberi', { born: String(1960 + i * 4) }));
  return { fe, baba, kids };
}

section('A BRANCH CAN BE CARRIED CLEAR ACROSS THE ROW');
{
  const h = household();
  eq('as entered', names(h.fe, row(h.fe)), ['Eldest', 'Second', 'Third', 'Fourth']);
  check('the eldest goes to the far end', h.fe.moveChildTo(h.kids[0], 3));
  eq('and the row closes up behind them',
     names(h.fe, row(h.fe)), ['Second', 'Third', 'Fourth', 'Eldest']);
}

section('and back again, in one act rather than three nudges');
{
  const h = household();
  h.fe.moveChildTo(h.kids[3], 0);
  eq('the youngest leads', names(h.fe, row(h.fe)),
     ['Fourth', 'Eldest', 'Second', 'Third']);
}

section('dropping somebody where they already are changes nothing');
// So a drag that ends where it started is not an edit, and does not fill the
// change log with moves that moved nobody.
{
  const h = household();
  eq('refused as a no-op', h.fe.moveChildTo(h.kids[1], 1), false);
  eq('untouched', names(h.fe, row(h.fe)), ['Eldest', 'Second', 'Third', 'Fourth']);
}

section('a slot past either end lands at that end rather than failing');
{
  const h = household();
  h.fe.moveChildTo(h.kids[0], 99);
  eq('clamped to last', names(h.fe, row(h.fe)).slice(-1), ['Eldest']);
  h.fe.moveChildTo(h.kids[0], -5);
  eq('and to first', names(h.fe, row(h.fe))[0], 'Eldest');
}

section('NOBODY IS ADDED, LOST, OR REPARENTED');
/* The whole risk of a drag: it looks like moving a thing through space, and
   the thing is a record. */
{
  const h = household();
  const before = Object.keys(h.fe.getState().people).length;
  const parentBefore = h.fe.parentUnionOf(h.kids[2]).id;
  h.fe.moveChildTo(h.kids[2], 0);
  eq('the same people', Object.keys(h.fe.getState().people).length, before);
  eq('the same four in the row', row(h.fe).length, 4);
  eq('no duplicates', new Set(row(h.fe)).size, 4);
  eq('and the same parents', h.fe.parentUnionOf(h.kids[2]).id, parentBefore);
}

section('everyone below comes along, because they were always below');
{
  const h = household();
  const grandkid = h.fe.grow('child', h.kids[0], 'Grandchild', 'f', 'Mwendamberi', { born:'1990' });
  h.fe.moveChildTo(h.kids[0], 3);
  eq('still their parent’s child',
     h.fe.parentUnionOf(grandkid).partners.includes(h.kids[0]), true);
  const L = h.fe.layoutOf();
  check('and drawn under them wherever they went',
        Math.abs(L.persons[grandkid].x - L.persons[h.kids[0]].x) < 400,
        JSON.stringify({ parent:L.persons[h.kids[0]].x, child:L.persons[grandkid].x }));
}

section('GRABBING THE WIFE CARRIES THE HOUSEHOLD');
/* The case from the screenshot: a couple, and the pod under the thumb was
   the one who married in. A branch hangs from ONE person — the one whose
   parents are in the tree — so the wife hangs from nobody and dragging her
   could do nothing. But the thing being reached for is the HOUSEHOLD, and
   which of the two pods the thumb landed on is an accident. */
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const sons = ['SonA', 'Thomas', 'SonC'].map((n, i) =>
    fe.grow('child', gf, n, 'm', 'Mwendamberi', { born: String(1955 + i * 5) }));
  const idah = fe.grow('partner', sons[1], 'Idah', 'f', 'Shava', { born:'1962' });

  eq('she has no row of her own', fe.parentUnionOf(idah), null);
  eq('so the drag is handed to her husband', fe.rowAnchor(idah), sons[1]);

  check('and carrying her moves his household', fe.moveChildTo(fe.rowAnchor(idah), 0));
  eq('to the front of the row',
     names(fe, Object.values(fe.getState().unions).find(u => u.children.length === 3).children),
     ['Thomas', 'SonA', 'SonC']);
}

section('somebody who has their own row keeps it, rather than being handed on');
{
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const son = fe.grow('child', gf, 'Son', 'm', 'Mwendamberi', { born:'1960' });
  const herDad = fe.addPerson('Her father', 'm', 'Nzou', '1935', '');
  const wife = fe.grow('child', herDad, 'Wife', 'f', 'Nzou', { born:'1962' });
  fe.linkExisting('partner', son, wife);
  eq('she carries herself', fe.rowAnchor(wife), wife);
  eq('and he carries himself', fe.rowAnchor(son), son);
}

section('a household where nobody has parents carries nothing');
// Not a refusal about the person touched — there is simply no row anywhere in
// the household, and the message says so.
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Mwendamberi', '1940', '');
  const b = fe.grow('partner', a, 'B', 'f', 'Shava', { born:'1942' });
  eq('nobody to hand it to', fe.rowAnchor(b), null);
  eq('nor the other way', fe.rowAnchor(a), null);
}

section('somebody with no row cannot be carried anywhere');
// An only child, or a person whose parents nobody has recorded, has no
// brothers and sisters to move among. Refused rather than silently ignored.
{
  const fe = loadFrontend();
  const lone = fe.addPerson('On their own', 'm', 'Mwendamberi', '1950', '');
  eq('refused', fe.moveChildTo(lone, 0), false);
  eq('and there is no slot to offer', fe.slotAt(lone, 0), null);
}

section('THE SLOT UNDER THE POINTER IS THE ONE THE EYE EXPECTS');
/* What turns a pixel into a position: count the brothers and sisters already
   to the left of where the pointer is. */
{
  const h = household();
  const L = h.fe.layoutOf();
  const xs = h.kids.map(k => L.persons[k].x);
  const dragged = h.kids[0];
  eq('left of everyone', h.fe.slotAt(dragged, xs[1] - 500), 0);
  eq('between the first two others', h.fe.slotAt(dragged, (xs[1] + xs[2]) / 2), 1);
  eq('right of everyone', h.fe.slotAt(dragged, xs[3] + 500), 3);
}

section('and the hand still beats the dates');
// sides.test.js asserts the arrows outrank birth years; carrying is the same
// edit, so it must not be quietly undone by the birth-order rules.
{
  const h = household();
  h.fe.moveChildTo(h.kids[3], 0);
  eq('the row is what the family said', names(h.fe, row(h.fe))[0], 'Fourth');
  const L = h.fe.layoutOf();
  check('and that is how it is drawn',
        L.persons[h.kids[3]].x < L.persons[h.kids[0]].x,
        JSON.stringify({ fourth:L.persons[h.kids[3]].x, eldest:L.persons[h.kids[0]].x }));
}

report();
