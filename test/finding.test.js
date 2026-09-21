// Finding somebody by name, and joining them on from there.
//
// "I need to be able to search for a name and also establish
//  relationship/link."
//
// Searching existed in two places and neither of them was a search. The
// server has had prefix-and-fuzzy matching from the start, used for spotting
// duplicates; the add form matches what you type against three candidates, to
// stop a grandmother being entered twice. Neither answers "where is Tapiwa"
// on a tree of four hundred people, and the old answer to that was to drag
// the canvas about until they appeared.
//
// And joining two people has always needed you to be standing on one of them
// first. That is fine when both are on the screen and absurd when neither is:
// a family who knows perfectly well that Rosa is Tapiwa's sister had to find
// Rosa on a canvas before they were allowed to say so.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const chai = P('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900');
  const thomas = fe.grow('child', chai, 'Thomas Musoni', 'm', 'Mwendamberi', { born:'1927' });
  const tapiwa = fe.grow('child', thomas, 'Tapiwa Musoni', 'm', 'Mwendamberi', { born:'1960' });
  const me = fe.grow('child', thomas, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  const rosa = P('Rosa Chombo', 'f', 'Soko', '1962');
  const away = P('Takunda Dooley', 'm', 'Soko', '2003');
  const taqiyy = P('Taqiyy Dooley', 'm', 'Soko', '1975');
  fe.linkExisting('child', taqiyy, away);
  return { fe, chai, thomas, tapiwa, me, rosa, away, taqiyy };
}
const names = (fe, hits) => hits.map(h => (fe.getState().people[h.id] || {}).name);

section('A NAME IS FOUND BY ANY PART OF IT');
{
  const t = tree();
  eq('by how it starts', names(t.fe, t.fe.searchPeople('Tap')), ['Tapiwa Musoni']);
  eq('by a word inside it', names(t.fe, t.fe.searchPeople('Chombo')), ['Rosa Chombo']);
  check('by a surname, which finds the whole house',
        names(t.fe, t.fe.searchPeople('Musoni')).length === 4,
        JSON.stringify(names(t.fe, t.fe.searchPeople('Musoni'))));
}

section('AND A NAME TYPED THE WAY IT SOUNDS STILL FINDS IT');
/* A family does not remember how a cousin's name was spelt when somebody else
   entered it two years ago. That is the whole reason this cannot be a plain
   substring match. */
{
  const t = tree();
  check('Chaitezvi, misspelt', names(t.fe, t.fe.searchPeople('Chaitesvi')).includes('Chaitezvi Musoni'),
        JSON.stringify(names(t.fe, t.fe.searchPeople('Chaitesvi'))));
}

section('THE NAME YOU TYPED CORRECTLY COMES FIRST');
/* The fuzzy score exists for a misspelling and must never outrank a name
   typed right — otherwise searching for somebody by their actual name hands
   you their cousins. */
{
  const t = tree();
  eq('exactly who was asked for', names(t.fe, t.fe.searchPeople('Rosa'))[0], 'Rosa Chombo');
  eq('and again', names(t.fe, t.fe.searchPeople('Tapiwa'))[0], 'Tapiwa Musoni');
}

section('ONE LETTER IS NOT A SEARCH');
{
  const t = tree();
  eq('nothing on one letter', t.fe.searchPeople('M').length, 0);
  eq('nor on nothing at all', t.fe.searchPeople('   ').length, 0);
  check('but two letters is enough', t.fe.searchPeople('Ro').length > 0);
}

section('SOMEBODY SET ASIDE IS STILL FOUND, which is when people look hardest');
/* "Where did Aunt Rosa go" is exactly the question a search has to answer,
   and a search that only finds what is already on the screen answers the
   easy half of it. */
{
  const t = tree();
  t.fe.setAside(t.rosa, 'entered twice');
  eq('she is off the tree', !!t.fe.layoutOf().persons[t.rosa], false);
  check('and still findable', names(t.fe, t.fe.searchPeople('Rosa')).includes('Rosa Chombo'));
}

section('AND TWO PEOPLE CAN BE JOINED WITHOUT EITHER BEING ON THE SCREEN');
/* The second half of the ask. Nothing new is decided about linking here —
   it is the same canLink and the same linkExisting the add form uses, which
   is the point: one rule about what may be joined to what, wherever the
   joining is done from. */
{
  const t = tree();
  eq('nothing stops it', t.fe.canLink('sibling', t.tapiwa, t.rosa), null);
  t.fe.linkExisting('sibling', t.tapiwa, t.rosa);
  eq('and the word is read off the tree afterwards, not off the button',
     (t.fe.kinTerms(t.tapiwa, t.rosa).list[0] || {}).term, 'Hanzvadzi');
}

section('including the offer to MOVE, which the same rule already knows about');
{
  const t = tree();
  eq('somebody under another household is a move, not a refusal',
     t.fe.canLink('child', t.tapiwa, t.away), 'move');
  t.fe.linkExisting('child', t.tapiwa, t.away);
  eq('and taking it leaves one set of parents',
     Object.values(t.fe.getState().unions).filter(u => u.children.includes(t.away)).length, 1);
  check('his old father is still in the tree', !!t.fe.getState().people[t.taqiyy]);
}

section('AND THE CARD IS A WAY IN TO IT, because that is where a wrong word is seen');
/* "Allow for editing to link or correct relationship and description."
 *
 * The card could already be told a different WORD — that box has been under
 * the To you line for weeks. What it could not be told is that the word is
 * right and the TREE is wrong: that this is not your Ambuya at all, because
 * somebody in between is joined to the wrong person or to nobody. Teaching a
 * word there files a correction under a shape that should never have been
 * reached, which makes the mistake harder to find afterwards rather than
 * easier.
 *
 * So Find can be anchored on the person whose card you are reading, rather
 * than on whoever happens to be picked on the tree. */
{
  const t = tree();
  // Rosa is in the tree and joined to nobody, so nothing about her is right yet.
  eq('she is nobody to anybody', (t.fe.kinTerms(t.me, t.rosa).list || []).length, 0);

  /* What the card's button does: the same canLink and linkExisting, anchored
     on the person being read about. */
  eq('and she can be joined to somebody from there',
     t.fe.canLink('parent', t.thomas, t.rosa), null);
  t.fe.linkExisting('parent', t.thomas, t.rosa);

  eq('after which the word is worked out, not typed in',
     (t.fe.kinTerms(t.me, t.rosa).list[0] || {}).term, 'Ambuya');
  /* AND THE SENTENCE UNDER IT FOLLOWS THE LINKS TOO. The description is
     never stored — correcting the join corrects what is said about it, which
     is the whole reason it is worth correcting the join. */
  eq('and so is the sentence under it',
     (t.fe.kinTerms(t.me, t.rosa).list[0] || {}).why, 'your grandparent');
  /* It was "no traced link yet" a moment ago. Correcting the join corrected
     what is said about it, which is the whole reason the join is the thing
     worth correcting. */
  const before = tree();
  check('where it had been the app saying it could not tell',
        /no traced link/.test((before.fe.relationship(before.me, before.rosa) || {}).why || ''),
        JSON.stringify(before.fe.relationship(before.me, before.rosa)));
}

report();
