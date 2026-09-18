// Joining two people who are already in the tree.
//
// THE ASK: "give me the option to link to whoever is listed in the tree and
// determine the relationship."
//
// The model for this was already here — canLink and linkExisting have existed
// for as long as the form has. What was missing was a door: the list of people
// you could point at only appeared once you had typed three characters that
// happened to resemble somebody's name. So you had to already know the person
// was in the tree, already remember how their name was spelt when it was
// entered, and already guess that typing it would offer them. Somebody who
// merely suspected two branches met had nothing to click, and did the only
// thing left — typed the grandmother in a second time.
//
// So most of this file is about linkCandidates, the browsable offer, and
// about the cache bug that made the joined relationship come back empty.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const nameOf = (fe, id) => (fe.getState().people[id] || {}).name || '?';
const named = (fe, list) => list.map(c => nameOf(fe, c.id));

/* A household with a gap in it: a grandfather, his son, and a woman entered
 * separately by somebody working on another branch. */
function house(){
  const fe = loadFrontend();
  const gran = fe.addPerson('Sydney Musoni', 'm', 'Mwendamberi', '1940', '');
  const son  = fe.grow('child', gran, 'Tonderai Musoni', 'm', 'Mwendamberi', { born:'1970' });
  const lone = fe.addPerson('Bertha Musoni', 'f', 'Mwendamberi', '1975', '');
  const away = fe.addPerson('Nyarai Moyo', 'f', 'Shava', '1972', '');
  fe.layoutOf();
  return { fe, gran, son, lone, away };
}

// ── the door that was missing ──────────────────────────────────────────────
section('THE PEOPLE ALREADY HERE ARE OFFERED BEFORE A LETTER IS TYPED');
{
  const h = house();
  const offered = h.fe.linkCandidates('sibling', h.son);
  check('there is an offer at all', offered.length > 0, JSON.stringify(offered));
  check('and it includes the woman entered on the other branch',
        offered.some(c => c.id === h.lone), named(h.fe, offered));
}

section('the family\'s own name comes first, because that is who is meant');
{
  const h = house();
  const offered = named(h.fe, h.fe.linkCandidates('sibling', h.son));
  eq('Musoni before Moyo', offered[0], 'Bertha Musoni');
}

section('and nobody is offered who would then be refused');
/* A name shown and greyed out is a question the family has to answer twice.
   canLink decides who appears, so the list cannot drift away from what the
   button will actually do. */
{
  const h = house();
  for (const kind of ['parent', 'child', 'partner', 'sibling']){
    const offered = h.fe.linkCandidates(kind, h.son);
    const bad = offered.filter(c => h.fe.canLink(kind, h.son, c.id));
    eq(`every ${kind} offered is one that can be made`, bad.length, 0);
  }
}

section('the anchor is never offered to themselves');
{
  const h = house();
  for (const kind of ['parent', 'child', 'partner', 'sibling']){
    check(`not in the ${kind} list`,
          !h.fe.linkCandidates(kind, h.son).some(c => c.id === h.son));
  }
}

// ── the joining itself ─────────────────────────────────────────────────────
section('JOINING TWO PEOPLE NAMES WHAT THEY BECOME');
{
  const h = house();
  h.fe.linkExisting('sibling', h.son, h.lone);
  eq('his sister is Hanzvadzi',
     h.fe.kinTerms(h.son, h.lone).list.map(t => t.term), ['Hanzvadzi']);
  section('and the grandfather gains a daughter without anybody saying so');
  eq('she is his child now',
     h.fe.kinTerms(h.gran, h.lone).list.map(t => t.term), ['Mwanasikana']);
}

section('nobody is created — that is the whole point');
{
  const h = house();
  const before = Object.keys(h.fe.getState().people).length;
  h.fe.linkExisting('sibling', h.son, h.lone);
  eq('the same people as before', Object.keys(h.fe.getState().people).length, before);
}

// ── THE BUG THIS FOUND ─────────────────────────────────────────────────────
section('ASKING WHETHER A LINK IS ALLOWED DOES NOT POISON THE ANSWER');
/* The real one, and it was live in the page. Rendering the list of people you
   could join calls canLink for each of them; canLink walks both ancestries to
   check for a loop, which fills the ancestry memo. Then linkExisting changes
   the very lines that memo was computed from — and the cache was only cleared
   by render(). So kinship read between the two came back as the tree was
   BEFORE the join: no relationship at all, between two people who had just
   been made brother and sister.

   The fix clears the memo in snapshot(), which every editing function calls
   and nothing else does. This asserts the order that used to break. */
{
  const h = house();
  h.fe.canLink('sibling', h.son, h.lone);          // warm the memo, as the list does
  h.fe.linkExisting('sibling', h.son, h.lone);
  eq('still Hanzvadzi, not silence',
     h.fe.kinTerms(h.son, h.lone).list.map(t => t.term), ['Hanzvadzi']);
}

section('and the same holds for a parent joined on');
{
  const h = house();
  const orphan = h.fe.addPerson('Chipo Musoni', 'f', 'Mwendamberi', '2000', '');
  h.fe.canLink('parent', orphan, h.son);
  h.fe.linkExisting('parent', orphan, h.son);
  eq('her father is Baba',
     h.fe.kinTerms(orphan, h.son).list.map(t => t.term), ['Baba']);
}

// ── the refusals, which are the reason the function exists ─────────────────
section('A LOOP IS REFUSED');
{
  const h = house();
  check('a son cannot be his father\'s father',
        !!h.fe.canLink('parent', h.gran, h.son), h.fe.canLink('parent', h.gran, h.son));
}

section('a second set of parents is refused, not quietly swapped');
/* One person, one set of parents — a PRIMARY KEY in the database and the
   invariant the whole child model rests on. Moving somebody between two sets
   is a real thing a family needs, and it is setParentage, where it is a
   deliberate act with its own question. It must not happen as a side effect
   of drawing a line. */
{
  const h = house();
  const other = h.fe.addPerson('Farai Moyo', 'm', 'Shava', '1945', '');
  const why = h.fe.canLink('child', other, h.son);
  check('refused', !!why, why);
  check('and says where to do it properly', /already has parents/.test(why || ''), why);
  eq('his parents are untouched',
     h.fe.parentUnionOf(h.son).partners, [h.gran]);
}

section('the same marriage cannot be made twice');
{
  const h = house();
  const w = h.fe.grow('partner', h.son, 'Rudo Nyoni', 'f', 'Nzou', { born:'1972' });
  check('refused, and says so plainly',
        /already married/.test(h.fe.canLink('partner', h.son, w) || ''),
        h.fe.canLink('partner', h.son, w));
}

section('but a SECOND marriage is allowed, and is its own union');
/* Not a refusal, and it would be wrong to make it one. A man with two wives
   and a widow who remarries are both ordinary here, and the union model
   exists precisely so they are representable without a special case. What
   must not happen is a third name inside the first marriage. */
{
  const h = house();
  const first = h.fe.grow('partner', h.son, 'Rudo Nyoni', 'f', 'Nzou', { born:'1972' });
  eq('a second is not refused', h.fe.canLink('partner', h.son, h.away), null);
  h.fe.linkExisting('partner', h.son, h.away);

  const his = h.fe.unionsOf(h.son);
  eq('he is in two marriages', his.length, 2);
  check('and neither holds three people',
        his.every(u => u.partners.length === 2),
        JSON.stringify(his.map(u => u.partners.length)));
  check('both wives are his partners',
        h.fe.partnersOf(h.son).includes(first) &&
        h.fe.partnersOf(h.son).includes(h.away));
}

section('and every bud has a word for what it is asking');
// The browsable offer names the relation in the family's own terms rather
// than echoing the internal key.
{
  const fe = loadFrontend();
  for (const k of ['parent', 'sibling', 'partner', 'child']){
    check(`${k} reads as words`, /^[a-z ]+$/.test(fe.KIND_AS[k] || ''), fe.KIND_AS[k]);
  }
}

report();
