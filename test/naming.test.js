// Naming a relationship from the place where the app asked for a name.
//
// THE COMPLAINT, with a photograph of the card attached: "I want to be able
// to name the relationships."
//
// The card for Esther said, in this order:
//
//     TO YOU
//     Not named yet
//     married to your Babamukuru (Ben Musoni)
//     This app has no word for it. If your family uses one, name it below.
//
// and below it was a name field, a birth year and a mutupo. The box that
// takes the word existed, and only ever appeared in the kinship panel — a
// different screen, reached from the toolbar, which nobody reading that
// sentence had any reason to go looking for. The app asked a question in one
// place and would only accept the answer in another.
//
// The word matters more here than the arrangement of two panels. Shona has
// words this app does not: Maiguru for the wife of a father's elder brother
// is one it will never derive, because the term belongs to the family's
// reckoning and not to a rule anybody wrote down. The app is built never to
// guess at those and to take them when a family offers — so the moment of
// offering has to be the moment the family is looking at the gap.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* A woman, her husband Ben, and Ben's sister Esther — who is the one with no
   word.
 *
 * THE FIXTURE MOVED, and why it moved is worth keeping. It used to be a
 * father's elder brother's wife, because she was the clearest example in the
 * tree of somebody the app could describe and not name. She has a word now:
 * a man who stands as a father has a wife who stands as a mother, and she is
 * Amaiguru. So the suite needs a pair that is still genuinely unnamed, and a
 * wife's words for her husband's brothers and sisters are exactly that —
 * this app was told to ask about them rather than answer, and it does.
 *
 * Ben keeps his name and his place as the one WITH a word, so the second
 * half of the file still has its Babamukuru to fold away. */
function theirs(){
  const fe = loadFrontend();
  const gf  = fe.addPerson('Grandfather', 'm', 'Mwendamberi', '1930', '');
  const dad = fe.grow('child', gf, 'Dad', 'm', 'Mwendamberi', { born:'1962' });
  const ben = fe.grow('child', gf, 'Ben Musoni', 'm', 'Mwendamberi', { born:'1958' });
  const me  = fe.grow('child', dad, 'Hazvineyi', 'm', 'Mwendamberi', { born:'1990' });
  // The unnamed pair: a wife and her husband's sister.
  const her = fe.addPerson('Chenai', 'f', 'Nzou', '1990', '');
  const hus = fe.grow('partner', her, 'Tapiwa Moyo', 'm', 'Moyo', { born:'1988' });
  const hisDad = fe.addPerson('Moyo Elder', 'm', 'Moyo', '1955', '');
  fe.linkExisting('child', hisDad, hus);
  const esther = fe.grow('child', hisDad, 'Esther', 'f', 'Moyo', { born:'1992' });
  fe.setMe(me);
  return { fe, gf, dad, ben, me, esther, her, hus, hisDad };
}
const hasBox = html => /<div class="teach"/.test(html);

section('THE CARD THAT ASKED FOR A WORD NOW TAKES ONE');
{
  const t = theirs();
  t.fe.setMe(t.her);
  const card = t.fe.kinOnCard(t.esther);
  check('it still says what she is — your husband\u2019s sister',
        /husband's sister/.test(card), card);
  check('and still says there is no word for it',
        /name it below/.test(card), card);
  check('and below it, at last, is the box', hasBox(card), card);
  check('filed under the shape, not under the two names',
        /data-shape="inlaw:through-my-husband:/.test(card), card);
}

section('the box stands open where there is no word');
/* Not behind a disclosure. The sentence above it has just asked the family a
   question; a family that has to find the box first will not answer it. */
{
  const t = theirs();
  t.fe.setMe(t.her);
  const card = t.fe.kinOnCard(t.esther);
  check('nothing to open first', !/teachfold/.test(card), card);
}

section('A WORD NAMED FROM THE CARD IS A WORD NAMED');
// Not a note about these two people: the same word for every pair standing in
// the same place, which is the whole reason the app files by shape.
{
  const t = theirs();
  t.fe.setMe(t.her);
  const shape = t.fe.kinTerms(t.her, t.esther).base.shape;
  t.fe.teachTerm(shape, 'Vatete', "she is my husband's sister");

  const card = t.fe.kinOnCard(t.esther);
  check('the card now leads with the word', /<b>Vatete<\/b>/.test(card), card);
  check('and says whose word it is',
        /your family's word, from Chenai/.test(card), card);
  check('with the rule they gave for it',
        /my husband's sister/.test(card), card);
  check('and no longer says it has no word', !/name it below/.test(card), card);

  // another sister of his, never mentioned to the app
  const sis2 = t.fe.grow('child', t.hisDad, 'Ruth', 'f', 'Moyo', { born:'1995' });
  eq('and the next woman in the same place carries it',
     t.fe.kinTerms(t.her, sis2).list.map(x => x.term), ['Vatete']);
}

section('a word the app already has is folded away, but is still changeable');
/* The card is mostly about the person. Two text fields under every relative
   would bury it the moment somebody is three things at once — and a family
   that agrees with the app, which is the ordinary case, is being asked
   nothing. So it waits behind one line. */
{
  const t = theirs();
  const card = t.fe.kinOnCard(t.ben);
  check('the word is on the card', /<b>Babamukuru<\/b>/.test(card), card);
  check('the box is folded', /<details class="teachfold">/.test(card), card);
  check('and the one line says what opening it is for',
        /<summary>Is Babamukuru your family's word\?<\/summary>/.test(card), card);
  check('the box behind it is the real one', hasBox(card), card);
  check('with the family able to agree as well as correct',
        /affirmgo/.test(card), card);
}

section('and once a family has settled a word, the fold says so');
{
  const t = theirs();
  const shape = t.fe.kinTerms(t.me, t.ben).base.shape;
  t.fe.affirmTerm(shape, 'Babamukuru', 'that is what we call him');
  const card = t.fe.kinOnCard(t.ben);
  check('the line offers a change rather than a question',
        /<summary>Change Babamukuru<\/summary>/.test(card), card);
  check('it is not asked to agree twice', !/affirmgo/.test(card), card);
  check('and it can be put back to what the app reads',
        /data-forget="/.test(card), card);
}

section('WHEREVER THE APP SAYS "NAME IT BELOW", THERE IS A BELOW');
/* The property the complaint is actually about, asserted over every pair in
   a tree rather than the one in the photograph. A sentence that promises a
   box is a bug unless the box is in the same string. */
{
  const t = theirs();
  const { fe } = t;
  const mai = fe.grow('partner', t.dad, 'Mai', 'f', 'Nzou', { born:'1965' });
  const sis = fe.grow('child', t.dad, 'Sister', 'f', 'Mwendamberi', { born:'1993' });
  const her = fe.grow('partner', sis, 'Her husband', 'm', 'Shava', { born:'1990' });
  const kid = fe.grow('child', her, 'Their child', 'm', 'Shava', { born:'2015' });
  /* Reckoned from the wife who married in, because hers is the vocabulary
     with gaps in it: a wife's words for her husband's people are the ones
     this app was told to ask about rather than answer. */
  fe.setMe(t.her);
  const all = [t.gf, t.dad, t.ben, t.esther, t.hus, t.hisDad, mai, sis, her, kid];

  let promised = 0, broken = [];
  for (const id of all){
    const card = fe.kinOnCard(id);
    if (!/name it below/.test(card)) continue;
    promised++;
    if (!hasBox(card)) broken.push(fe.getState().people[id].name);
  }
  check('several cards ask for a word', promised > 0, String(promised));
  eq('and not one of them asks without taking the answer', broken, []);
}

section('and where a word cannot be filed, none is asked for');
/* Two strangers have no shape for a word to be filed under. Offering a box
   there would take something a family typed and put it nowhere — so the
   sentence drops the promise instead of the box quietly failing to appear. */
{
  const fe = loadFrontend();
  const me = fe.addPerson('Me', 'm', 'Nzou', '1970', '');
  const other = fe.addPerson('A stranger', 'f', 'Shava', '1972', '');
  fe.setMe(me);
  const gap = fe.whyNotNamed(me, other);
  check('nothing is promised', !/name it below/.test(gap.text), gap.text);
  check('and no box is drawn', !hasBox(fe.kinOnCard(other)), fe.kinOnCard(other));
}

section('THE PANEL AND THE CARD OFFER THE SAME BOX, BECAUSE IT IS THE SAME BOX');
/* Two implementations would drift, and the one that drifted would be the
   card — it is the newer of the two and the one nobody would think to look
   at when the panel was changed. */
{
  const t = theirs();
  t.fe.setMe(t.her);
  const fromPanel = t.fe.kinVerdict(t.her, t.esther);
  const fromCard  = t.fe.kinOnCard(t.esther);
  const box = html => (html.match(/<div class="teach"[\s\S]*<\/div>$/) || [''])[0];
  check('the panel has one', hasBox(fromPanel), fromPanel);
  eq('and the card carries the same one, field for field',
     box(fromCard), box(fromPanel));
}

section('a word with a quote in it does not break the box it is written into');
// It is written into an attribute and a summary as well as into text.
{
  const t = theirs();
  const shape = t.fe.kinTerms(t.me, t.esther).base.shape;
  t.fe.teachTerm(shape, 'Mai" <b>guru', 'typed by somebody being difficult');
  const card = t.fe.kinOnCard(t.esther);
  check('no raw quote escapes into the attribute',
        !/data-term="Mai" </.test(card), card);
  check('and no tag is smuggled in', !/<b>guru/.test(card), card);
}

section('naming a relationship is undoable like everything else');
{
  const t = theirs();
  t.fe.setMe(t.her);
  const shape = t.fe.kinTerms(t.her, t.esther).base.shape;
  t.fe.teachTerm(shape, 'Vatete', '');
  check('it took', /Vatete/.test(t.fe.kinOnCard(t.esther)));
  check('undo works', t.fe.undo());
  check('and the card is asking again', /name it below/.test(t.fe.kinOnCard(t.esther)),
        t.fe.kinOnCard(t.esther));
}

report();
