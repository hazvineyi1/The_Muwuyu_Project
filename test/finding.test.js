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

section('THE JOIN PANEL ASKS IN THE FAMILY\u2019S OWN WORDS, not in the model\u2019s');
/* "All possible relationships need to be shown to make the link. Allow for
 *  explanation with title and then be intuitive."
 *
 * It offered four: child, mother or father, brother or sister, husband or
 * wife. Those are the four LINKS this model has, and they are the wrong four
 * to ask a family about — a sister's son is not any of them. To record Victor
 * you had to already know that the way in was to find the sister first and
 * add him under her, which is the data model showing through as if it were a
 * question about the family.
 *
 * The words already existed. waysToAdd is this same list, used for adding a
 * NEW person by the word for them; the panel now asks with those instead. */
{
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const dad   = P('Sydney', 'm', 'Mwendamberi', '1940');
  const mum   = fe.grow('partner', dad, 'Evelyn', 'f', 'Moyondizvo', { born:'1954' });
  const other = fe.grow('partner', dad, 'Mai Ida', 'f', 'Shava', { born:'1945' });
  const me    = fe.grow('child', mum, 'Hazvineyi', 'f', 'Mwendamberi', { born:'1979' });
  const half  = fe.grow('child', other, 'Bertha', 'f', 'Mwendamberi', { born:'1975' });
  const full  = fe.grow('child', mum, 'Farirai', 'f', 'Mwendamberi', { born:'2002' });
  fe.setMe(me);
  const victor = P('Victor', 'm', 'Mwendamberi', '2000');   // in the tree, joined to nobody

  const ways = fe.waysToJoin(me, victor);
  const say = w => `${w.term} — ${w.gloss}`;

  check('there are more than four ways offered', ways.filter(w => !w.blocked).length > 4,
        String(ways.filter(w => !w.blocked).length));
  check('each carries its title and what it means',
        ways.every(w => w.term && w.gloss), JSON.stringify(ways.slice(0, 3)));
  check("a sister's child is one of them",
        ways.some(w => w.gloss === "your sister's child" && !w.blocked),
        ways.map(say).join(' | '));

  section('and where a word goes through somebody, every one of them is named');
  /* "Your sister's child" is one offer when you have one sister and a guess
     when you have three. */
  const viaSisters = ways.filter(w => w.gloss === "your sister's child");
  eq('both sisters are offered', viaSisters.length, 2);
  eq('by name', viaSisters.map(w => w.through).sort(), ['Bertha', 'Farirai']);

  section('INCLUDING THE HALF SISTER, which is the case that could not be said at all');
  /* The list read the children of ONE marriage, so a sister by the father's
     other wife was not a sister here — and "Victor is my half sister's son"
     had no way to be said. The word was in the list; the woman it had to go
     through was not. */
  const throughHalf = viaSisters.find(w => w.through === 'Bertha');
  check('she is there', !!throughHalf && !throughHalf.blocked, JSON.stringify(throughHalf));

  fe.linkExisting(throughHalf.kind, throughHalf.via, victor);
  const w = (a, b) => {
    const k = fe.kinTerms(a, b);
    return (k && k.list.length) ? k.list.map(x => x.term).filter(Boolean) : [];
  };
  check('and once he is joined she is told what he is to her, not what she typed',
        w(me, victor).includes('Mwanakomana'), w(me, victor).join(' + ') || 'no word');
}

section('a word for the other sex is not offered at all, rather than refused');
{
  const fe = loadFrontend();
  const a = fe.addPerson('A man', 'm', 'Nzou', '1950', '');
  const she = fe.addPerson('A woman', 'f', 'Shava', '1955', '');
  const ways = fe.waysToJoin(a, she);
  check('no Murume for a woman', !ways.some(w => w.term === 'Murume'),
        ways.map(w => w.term).join(', '));
  check('but Mukadzi is there', ways.some(w => w.term === 'Mukadzi'),
        ways.map(w => w.term).join(', '));
}

section('A WORD IS NOT REFUSED JUST BECAUSE THE PERSON IT RUNS THROUGH IS MISSING');
/* "Why is this limiting relationships?"
 *
 * Tete is your FATHER's sister. Half these words run through somebody, and a
 * word whose go-between was not in the tree had nowhere to put anybody — so
 * the row was greyed out with "your father is not recorded yet" under it.
 * That reads as the app deciding the relationship is not allowed, when what
 * is actually true is that the app is one name short of being able to record
 * it.
 *
 * A family saying "Bertha is his Tete" is telling you two things: that she is
 * his father's sister, and therefore that he HAS a father. The second is news
 * to the tree, and asking for it is one field. */
{
  const fe = loadFrontend();
  // A mother recorded, no father — which is most half-filled trees.
  const mum = fe.addPerson('Ruvarashe Moyo', 'f', 'Nzou', '1940', '');
  const me  = fe.grow('child', mum, 'Musekiwa Musoni', 'm', 'Mwendamberi', { born:'1968' });
  fe.setMe(me);
  const her = fe.addPerson('Bertha Enia Musoni', 'f', 'Mwendamberi', '1965', '');

  const ways = fe.waysToJoin(me, her);
  const tete = ways.find(w => w.term === 'Tete');
  check('Tete is offered even with no father recorded', !!tete && !tete.blocked,
        JSON.stringify(tete));
  check('and it says the father is wanted too', !!tete && /father/.test(tete.also || ''),
        JSON.stringify(tete));
  eq('with the shape of the person to ask for', tete.need && tete.need.kind, 'parent');
  eq('and which of the two he is', tete.need && tete.need.sex, 'm');

  /* EVERY word that runs through somebody, not only this one — a son's wife,
     a daughter's child, a sister's child. */
  const needing = ways.filter(w => w.need);
  check('every word with a missing go-between is offered the same way',
        needing.length >= 5 && needing.every(w => !w.blocked && w.need.kind && w.also),
        JSON.stringify(needing.map(w => w.term + ':' + w.also)));

  section('and the two go in together, with the word worked out afterwards');
  {
    const dad = fe.grow(tete.need.kind, me, 'Tapiwa Musoni', tete.need.sex, '', {});
    fe.linkExisting(tete.kind, dad, her);
    const k = fe.kinTerms(me, her);
    const said = (k && k.list.length) ? k.list.map(x => x.term) : [];
    check('she comes back Tete, read off the tree rather than off the button',
          said.includes('Tete'), said.join(' + ') || 'no word');
    check('and the father the family named is a person like any other',
          fe.getState().people[dad].name === 'Tapiwa Musoni', 'no father');
    eq('with nobody left floating', fe.adrift(), []);
  }
}

section('A PLACE THAT IS ALREADY HELD IS SHOWN, NOT HIDDEN');
/* "The relationship for Musekiwa and Bertha is mother and son, but that
 *  option is not available."
 *
 * It was not available because it was already answered: a mother was
 * recorded, so Amai was marked done — and done words were dropped from the
 * join panel entirely, without a word. Every other unavailable row on that
 * panel says why; this one was simply not there.
 *
 * A place already held is not the same as a place that cannot be filled, and
 * the commonest reason to say "she is his mother" of a tree that already
 * names one is that the one it names is wrong. */
{
  const fe = loadFrontend();
  const gran  = fe.addPerson('Gogo Chiedza', 'f', 'Nzou', '1915', '');
  const wrong = fe.grow('child', gran, 'Ruvarashe Moyo', 'f', 'Nzou', { born:'1940' });
  const her   = fe.grow('child', gran, 'Bertha Enia Musoni', 'f', '', { born:'1945' });
  const me    = fe.grow('child', wrong, 'Musekiwa Mupfunde', 'm', '', { born:'1968' });
  const kid2  = fe.grow('child', wrong, 'Tapiwa Mupfunde', 'm', '', { born:'1971' });
  fe.setMe(me);

  const amai = fe.waysToJoin(me, her).find(w => w.term === 'Amai');
  check('the word is there at all', !!amai, 'Amai was dropped from the list');
  check('and it is not refused', !!amai && !amai.blocked, JSON.stringify(amai));
  eq('it names who holds the place', amai.heldBy, 'Ruvarashe Moyo');
  eq('and who would be replaced', amai.replace, wrong);

  section('and a word already answered by this very person says so');
  {
    const already = fe.waysToJoin(me, wrong).find(w => w.term === 'Amai');
    check('it is refused, with the reason', !!already && /already recorded/.test(already.blocked || ''),
          JSON.stringify(already));
  }

  section('the whole household, or the one child — a parent is shared, so it is asked');
  {
    /* Swapping the mother in a household changes her for every child in it.
       The family may mean that, or they may mean this one child. Those are
       different acts on different numbers of people, so the app must not
       pick. Both are exercised here on their own copy of the tree. */
    const one = loadFrontend();
    const g  = one.addPerson('Gogo Chiedza', 'f', 'Nzou', '1915', '');
    const w2 = one.grow('child', g, 'Ruvarashe Moyo', 'f', 'Nzou', { born:'1940' });
    const b2 = one.grow('child', g, 'Bertha Enia Musoni', 'f', '', { born:'1945' });
    const m2 = one.grow('child', w2, 'Musekiwa Mupfunde', 'm', '', { born:'1968' });
    const t2 = one.grow('child', w2, 'Tapiwa Mupfunde', 'm', '', { born:'1971' });
    one.setMe(m2);

    // THIS CHILD ONLY: he leaves that household for one of his own.
    const pu = one.parentUnionOf(m2);
    pu.children = pu.children.filter(x => x !== m2);
    one.addUnion([b2], [m2]);
    eq('his mother is the right one now', one.parentBySex(m2, 'f'), b2);
    eq('and his brother is untouched', one.parentBySex(t2, 'f'), w2);
    eq('with nobody left floating', one.adrift(), []);
  }
  {
    // THE WHOLE HOUSEHOLD: the woman in it is the wrong one.
    const all = loadFrontend();
    const g  = all.addPerson('Gogo Chiedza', 'f', 'Nzou', '1915', '');
    const w3 = all.grow('child', g, 'Ruvarashe Moyo', 'f', 'Nzou', { born:'1940' });
    const b3 = all.grow('child', g, 'Bertha Enia Musoni', 'f', '', { born:'1945' });
    const m3 = all.grow('child', w3, 'Musekiwa Mupfunde', 'm', '', { born:'1968' });
    const t3 = all.grow('child', w3, 'Tapiwa Mupfunde', 'm', '', { born:'1971' });
    all.setMe(m3);

    const pu = all.parentUnionOf(m3);
    pu.partners = pu.partners.filter(x => x !== w3);
    pu.partners.push(b3);
    eq('both children have the right mother', all.parentBySex(m3, 'f'), b3);
    eq('and so does the brother', all.parentBySex(t3, 'f'), b3);
    eq('nobody is floating — the one replaced is still her mother\'s child',
       all.adrift(), []);
  }

  check('and the tree the checks started from is unchanged',
        fe.parentBySex(me, 'f') === wrong && fe.parentBySex(kid2, 'f') === wrong,
        'the first fixture was mutated');
}

section('but what is missing is not always a person, and that still waits');
{
  /* "Mukoma — your older brother or sister" is short of a FACT about the
     anchor rather than short of a person: which of the two words it is
     depends on whether they are a he or a she, and there is nobody to add to
     settle that. So it stays waiting in the add panel, with the reason, and
     no name is asked for — the difference this whole change turns on is
     between a missing person, which can be given, and a missing answer,
     which cannot. */
  const fe = loadFrontend();
  const a = fe.addPerson('No sex recorded', '', 'Nzou', '1950', '');
  const ways = fe.waysToAdd(a);
  const mukoma = ways.find(w => w.term === 'Mukoma');
  check('it is not ready', !!mukoma && !mukoma.ready, JSON.stringify(mukoma));
  check('and what is wanted is an answer, not somebody to add',
        !!mukoma && !mukoma.need && /he or a she/.test(mukoma.missing || ''),
        JSON.stringify(mukoma));

  /* And the other half of the same distinction: a word short of a PERSON
     carries the shape of them, so the panel can ask. */
  const someone = fe.addPerson('A woman', 'f', 'Shava', '1955', '');
  const tete = fe.waysToJoin(a, someone).find(w => w.term === 'Tete');
  check('while a word short of a person carries how to make them',
        !!tete && !tete.blocked && !!tete.need, JSON.stringify(tete));
}

report();
