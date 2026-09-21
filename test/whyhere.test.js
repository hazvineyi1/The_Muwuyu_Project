// WHY SOMEBODY IS DRAWN WHERE THEY ARE.
//
// "Why are these names all the way here?" — sent with a photograph of two
// pods sitting alone in open canvas, a long branch running past them to
// somewhere off the side of the picture.
//
// It is the fourth time the same question has been asked in different words,
// and every time the answer has been a paragraph from me rather than a line
// from the app. That is the fault. Where a pod lands is the end of a chain of
// real decisions — two families both claiming a household and one of them
// winning; a house standing over the daughter who married out rather than
// hanging from parents nobody recorded; a household on your father's half of
// the line rather than your mother's — and every one of them is a sentence a
// family can read. They were computed and thrown away in the same breath.
//
// WHAT IT IS NOT. Not a warning, and not a complaint about the tree. Almost
// every answer here is "because this is correct, and here is the rule". The
// point is that somebody who cannot see WHY the picture is shaped like this
// has no way to tell a rule from a mistake, and so has to treat all of it as
// a mistake — which is what has been happening.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* A tree with all four cases in it: a root, a household on the line of
   descent with two families claiming it, a household OFF the line where the
   counting rule settles it the other way, a house pushed into the visiting
   lane, and both sides. */
function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf  = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  // his wife, whose own father and sister the tree also holds
  const gm  = fe.grow('partner', gf, 'Baya Musoni', 'f', 'Shava', { born:'1905' });
  const gmDad = P('Shava Elder', 'm', 'Shava', '1875');
  fe.linkExisting('child', gmDad, gm);
  const gmSis = fe.grow('child', gmDad, 'Ruth Shava', 'f', 'Shava', { born:'1910' });

  const aunt = fe.grow('child', gf, 'Tsowhe', 'f', 'Mwendamberi', { born:'1935' });
  const dad  = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });

  /* HIS UNCLE'S HOUSEHOLD, which is NOT on his line of descent — so the
     counting rule still settles it, and settles it the other way: the
     Marumahoko are four deep here and Terence's own father has only the
     three children already recorded. */
  const unc = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });
  const aWife = fe.grow('partner', unc, 'Daisy Marumahoko', 'f', 'Soko', { born:'1948' });
  const herDad = P('Marumahoko Elder', 'm', 'Soko', '1920');
  fe.linkExisting('child', herDad, aWife);
  for (const [n, y] of [['David Marumahoko', '1944'], ['Phineas Marumahoko', '1950'],
                        ['Doreen Marumahoko', '1952']])
    fe.grow('child', herDad, n, 'm', 'Soko', { born:y });

  /* AND A HOUSE WITH NOWHERE OF ITS OWN TO STAND. Tafara's father has only
     Tafara in this tree, so the Musoni side takes their household and he is
     left with nothing beneath him — the case the visiting lane exists for. */
  const aunt2 = fe.grow('child', gf, 'Netsai Musoni', 'f', 'Mwendamberi', { born:'1943' });
  const hisMan = fe.grow('partner', aunt2, 'Tafara Shumba', 'm', 'Shumba', { born:'1941' });
  const hisDad = P('Shumba Elder', 'm', 'Shumba', '1915');
  fe.linkExisting('child', hisDad, hisMan);

  const mum = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const mgf = P('James Mandaba', 'm', 'Moyondizvo', '1925');
  fe.linkExisting('child', mgf, mum);
  const mBro = fe.grow('child', mgf, 'Joseph Mandaba', 'm', 'Moyondizvo', { born:'1956' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, ggf, gf, gm, gmDad, gmSis, aunt, dad, unc, aWife, herDad,
           aunt2, hisMan, hisDad, mum, mgf, mBro };
}
const why = (t, id) => t.fe.whyHere(id);

section('EVERYBODY ON THE SCREEN CAN SAY WHY THEY ARE THERE');
/* The property the complaint is actually about. One pod with no answer is
   the pod somebody will be looking at. */
{
  const t = tree();
  const drawn = Object.keys(t.fe.layoutOf().persons);
  const silent = drawn.filter(id => !why(t, id))
                      .map(id => t.fe.getState().people[id].name);
  check('twenty of them are drawn', drawn.length === 20, String(drawn.length));
  eq('and not one of them is stuck for an answer', silent, []);
}

section('THE HEAD OF A LINE SAYS SO');
{
  const t = tree();
  check('nobody above them is recorded, so they stand on the ground',
        /head of a line/.test(why(t, t.gmDad)), why(t, t.gmDad));
}

section('AND EVERYBODY ELSE SAYS WHAT THEY HANG FROM');
{
  const t = tree();
  check('naming the household above them',
        /Hanging beneath James Mandaba/.test(why(t, t.mBro)), why(t, t.mBro));
  check('and the person the household hangs through',
        /through Sydney Musoni/.test(why(t, t.mum)), why(t, t.mum));
}

section('YOUR OWN LINE OF DESCENT HANGS FROM YOUR OWN FAMILY');
/* "Siblings, parents, children should show in the same branch and should be
   grouped together."
 *
 * The counting rule below was written to stop a man's sisters growing on the
 * other side of the canvas, and on a real tree it went on to hand HIS OWN
 * GRANDFATHER'S household to the grandfather's wife's father — because her
 * side happened to have one more brother recorded. His grandfather then left
 * his own brothers and sisters, his father was pushed into the visiting lane
 * over somebody else's marriage, and the line of descent this whole shape
 * exists to keep straight took a step sideways into a family he is not
 * descended from.
 *
 * Counting is a fair way to settle a household nobody is descended from. It
 * is not a fair way to settle yours. */
{
  const t = tree();
  const said = why(t, t.gf);
  check('his grandfather hangs beneath his own father',
        /Hanging beneath Musoni Elder/.test(said), said);
  check('and the wife\u2019s father is named as the claim that lost',
        /Shava Elder has a claim on this household too/.test(said), said);
  check('settled by the house rather than by what is recorded',
        /a house descends through its men/.test(said), said);
  check('his father hangs from his grandfather in turn',
        /Hanging beneath Chaitezvi Musoni/.test(why(t, t.dad)), why(t, t.dad));

  /* AND THE PICTURE ACTUALLY SHOWS IT: four generations on one x, which is
     what the line being straight means, and what it could not be while a
     household of it was hanging off an in-law. */
  const L = t.fe.layoutOf();
  const down = [t.ggf, t.gf, t.dad, t.me].map(id => Math.round(L.persons[id].x));
  eq('and all four of them stand on one line', new Set(down).size, 1);
}

section('WHERE TWO FAMILIES BOTH CLAIM A HOUSEHOLD, IT SAYS WHICH LOST AND WHY');
/* THE ONE THAT ACTUALLY ANSWERS THE QUESTION. A row of people can only hang
   beneath one set of parents; the other family's line then stretches right
   across the canvas to reach it, and that long line is what looks broken.
   It is not broken — it was decided, and this is the decision. */
{
  const t = tree();
  const said = why(t, t.unc);
  check('the family that lost the claim is named',
        /Marumahoko Elder has a claim on this household too/.test(said), said);
  check('through whom', /through Daisy Marumahoko/.test(said), said);
  check('with the reason it went the other way — which side the tree holds more of',
        /the tree holds more of Chaitezvi Musoni and Baya Musoni's side/.test(said), said);
  check('and the promise that their line is still drawn',
        /The line to them is still drawn/.test(said), said);
  check('and why it is long, which is the thing being looked at',
        /long because they stand elsewhere/.test(said), said);
}

section('and where the tree knows both sides equally, it says the house rule instead');
/* Two families with the same depth recorded is the case the house rule was
   written for, and it has to give its own reason rather than claim a
   knowledge it does not have. */
{
  const fe = loadFrontend();
  const hisDad = fe.addPerson('His father', 'm', 'Shumba', '1900', '');
  const herDad = fe.addPerson('Her father', 'm', 'Nzou', '1902', '');
  const him = fe.grow('child', hisDad, 'The husband', 'm', 'Shumba', { born:'1930' });
  const her = fe.grow('partner', him, 'The wife', 'f', 'Nzou', { born:'1932' });
  fe.linkExisting('child', herDad, her);
  const kid = fe.grow('child', him, 'Their child', 'm', 'Shumba', { born:'1960' });
  fe.setMe(kid);
  fe.setShape('');
  const said = fe.whyHere(him);
  check('it hangs on the husband’s side', /Hanging beneath His father/.test(said), said);
  check('and says so as a rule about houses, not about what is recorded',
        /a house descends through its men/.test(said), said);
  check('rather than claiming one side is better known',
        !/holds more of/.test(said), said);
}

section('A HOUSE IN THE VISITING LANE SAYS WHAT IT IS STANDING OVER');
/* The shape that looks most like a mistake: a pod half a row above where it
   ought to be, joined to one household and nothing else. */
{
  const t = tree();
  const said = why(t, t.hisDad);
  check('it is standing over a household rather than hanging from one',
        /Standing over Tafara Shumba's household/.test(said), said);
  check('because nobody above it is recorded',
        /nobody above this one is recorded/.test(said), said);
}

section('AND WHICH HALF OF THE PICTURE THEY ARE ON');
/* "All the way HERE" is as much about the side as the row. */
{
  const t = tree();
  check('the line itself says it runs to you',
        /runs straight down the middle to you/.test(why(t, t.me)), why(t, t.me));
  check('a wife on the line says whose line it is',
        /runs through Sydney Musoni/.test(why(t, t.mum)), why(t, t.mum));
  check('his father’s people are told they are his father’s people',
        /with your father’s people/.test(why(t, t.aunt)), why(t, t.aunt));
  check('and his mother’s, hers',
        /with your mother’s people/.test(why(t, t.mBro)), why(t, t.mBro));
}

section('a marriage says why the two of them are side by side');
{
  const t = tree();
  check('because a marriage stands together',
        /Beside Evelyn Mandaba, because a marriage stands together/.test(why(t, t.dad)),
        why(t, t.dad));
}

section('SOMEBODY OFF THE SCREEN IS TOLD WHY THEY ARE OFF IT');
/* The worst possible answer to "where did they go" is no answer. A person
   behind a fold, outside the reach, or off the branch being built is not
   missing — and the sentence has to say the record is untouched, because
   that is the thing a family actually fears. */
{
  const t = tree();
  const line = t.fe.foldableLines().find(l => l.name === 'Mandaba');
  t.fe.setLineFolded(line.id, true);
  const said = why(t, t.mgf);
  check('it says a fold or a reach is holding them',
        /fold/.test(said) && /reach/.test(said), said);
  check('and that nothing has happened to the record',
        /still in the tree/.test(said), said);
  t.fe.setLineFolded(line.id, false);
}

section('and somebody set aside is not given a position they do not have');
{
  const t = tree();
  t.fe.setAside(t.gmSis, 'entered twice');
  eq('nothing is said about where they stand', why(t, t.gmSis), '');
}

section('THE CARD CARRIES IT, FOLDED');
/* Almost every answer is "because this is correct, and here is the rule", so
   a card that opened with a paragraph of layout reasoning would be answering
   a question most people are not asking. One line, and the reason behind it. */
{
  const t = tree();
  const card = t.fe.whyOnCard(t.gf);
  check('one line, by name', /<summary>Why is Chaitezvi drawn here\?<\/summary>/.test(card), card);
  check('with the answer behind it', /Shava Elder/.test(card), card);
  check('and it is folded', /<details class="whyfold">/.test(card), card);
}

section('and a name with a quotation mark in it does not break the card');
{
  const t = tree();
  t.fe.getState().people[t.gmDad].name = 'Shava" <b>Elder';
  const card = t.fe.whyOnCard(t.gf);
  check('no tag is smuggled through', !/<b>Elder/.test(card), card);
  check('and the sentence still arrives', /Shava/.test(card), card);
}

section('IT DESCRIBES THE PICTURE THAT IS ON THE SCREEN, not a different one');
/* Reckoned from the drawn layout, so a reader who has changed the shape gets
   the answer for the shape they are looking at. */
{
  const t = tree();
  const straight = why(t, t.me);
  t.fe.setShape('muti');
  const packed = why(t, t.me);
  check('Mudzi says the line runs to you', /straight down the middle/.test(straight), straight);
  check('and both shapes still answer', !!packed, packed);
}

section('AND A TREE OF ONE PERSON IS NOT OWED A PARAGRAPH');
{
  const fe = loadFrontend();
  const only = fe.addPerson('The only person here', 'f', 'Nzou', '1950', '');
  fe.setMe(only);
  fe.setShape('');
  const said = fe.whyHere(only);
  check('it still answers', !!said, said);
  check('and the answer is that there is nobody above them',
        /head of a line/.test(said), said);
}

report();
