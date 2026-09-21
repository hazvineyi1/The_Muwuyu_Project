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

report();
