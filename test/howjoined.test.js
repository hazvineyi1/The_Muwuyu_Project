// HOW TWO PEOPLE ARE JOINED, said out loud.
//
// "Given who I am, who is this person to me, what do I call them, what do they
//  call me, HOW ARE WE CONNECTED, and why?"
//
// Four of those five the app already answered. The fifth it has always known
// and has never once said.
//
// The engine walks the tree to choose a word and then throws the walk away.
// kinPath() works out how far up each side goes and which way the fork
// crosses; relationship() turns that into Sekuru; whyNotNamed() reports what
// is missing when it cannot. Not one of them keeps the people in between. So
// the app could say "Tendai is Belinda's Sekuru, because he is her mother's
// brother" and could not say who Belinda's mother is, nor that she and Tendai
// are Sydney's children — which is the part a family checks, argues about,
// and remembers. The word is only the name of the reason.
//
// TWO DIFFERENT THINGS, AND THIS IS THE OTHER ONE. Every other kinship file
// here tests an INTERPRETATION: the term depends on sex, on seniority, on
// which side, and on what a family has taught. This tests the genealogical
// fact underneath — the recorded links, in order, through the people actually
// in the tree. It cannot be wrong about the culture because it does not speak
// about the culture, and when a derived word and a family's own word disagree
// it is what both of them are talking about.
//
// SO THE WORDS IT USES ARE LINK WORDS AND NEVER KIN TERMS. mother, father,
// son, daughter, husband, wife, brother, sister — the vocabulary the `why`
// traces already use. No Shona term is invented here, and no English kinship
// CATEGORY appears anywhere: no cousin, no uncle, no aunt, no nephew, because
// those are readings of a link and not links. That is asserted below, on real
// output, because it is the rule this whole project is built to keep.
//
//   HOW TO RUN IT.  TEST_DATABASE_URL=postgres://... node test/howjoined.test.js
//   Or the whole run: npm test

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* The family from the request itself, which is also the shape the whole of
   Shona kinship turns on — a cross link through a woman's brother.

     Sydney Mandaba
        ├── Rudo Mandaba ═══ Joseph Chirwa
        │        └── Belinda Chirwa
        └── Tendai Mandaba ═══ Grace Nyoni

   Tendai is Belinda's Sekuru. The way there is: her mother Rudo, then Rudo's
   brother Tendai, and the two of them are Sydney's children. */
function family(){
  const fe = loadFrontend();
  const sydney  = fe.addPerson('Sydney Mandaba', 'm', 'Moyondizvo', '1900', '');
  const rudo    = fe.grow('child', sydney, 'Rudo Mandaba', 'f', 'Moyondizvo', { born:'1932' });
  const joseph  = fe.grow('partner', rudo, 'Joseph Chirwa', 'm', 'Mangwenya', { born:'1930' });
  const belinda = fe.grow('child', rudo, 'Belinda Chirwa', 'f', 'Mangwenya', { born:'1958' });
  const tendai  = fe.grow('child', sydney, 'Tendai Mandaba', 'm', 'Moyondizvo', { born:'1936' });
  const grace   = fe.grow('partner', tendai, 'Grace Nyoni', 'f', 'Nzou', { born:'1940' });
  fe.setMe(belinda);
  return { fe, sydney, rudo, joseph, belinda, tendai, grace };
}

/* What a chain says, in the shortest form a test can read: the words along it
   and the names they reach. */
const said = (fe, chain) => chain && chain.slice(1).map(s =>
  s.word + ' ' + (fe.getState().people[s.id].name || '').split(' ')[0]);
const through = chain => chain && chain.slice(1).map(s => s.through || null);

(async () => {

section('THE WAY THERE IS THE PEOPLE IN BETWEEN');
{
  const t = family();
  const chain = t.fe.linkChain(t.belinda, t.tendai);
  check('there is a chain at all', !!chain);
  eq('and it goes through her mother and reaches her mother’s brother',
     said(t.fe, chain), ['mother Rudo', 'brother Tendai']);
  eq('starting at the person it was asked from', chain[0].id, t.belinda);

  /* AND IT AGREES WITH THE WORD, which is the whole claim: the chain is what
     the term was read off. If these two ever part company one of them is
     lying to the family. */
  t.fe.setMe(t.belinda);
  const r = t.fe.relationship(t.belinda, t.tendai);
  eq('and the word the engine derives from the same shape', r && r.term, 'Sekuru');
}

section('A BROTHER IS ONE STEP, AND THE TREE IS WALKED IN TWO');
/* The walk only knows parent, child and partner links, so a brother is up to
   a parent and down again. That is the truth and it is not how anybody says
   it — "her mother, her mother's father, his son" is a correct sentence that
   no family has ever spoken. The pair is folded into one step.
 *
   AND THE PERSON IT WAS FOLDED THROUGH IS KEPT, because "where do the two
   lines meet" is the question an elder is actually asked, and dropping Sydney
   to make the sentence shorter would drop the answer to it. */
{
  const t = family();
  const chain = t.fe.linkChain(t.belinda, t.tendai);
  eq('two links, not three', chain.length - 1, 2);
  eq('and the shared parent is kept on the step that folded',
     through(chain), [null, t.sydney]);
  eq('which is Sydney', (t.fe.getState().people[chain[2].through].name || ''), 'Sydney Mandaba');
}

section('IT IS THE SAME CHAIN BOTH WAYS ROUND, AND THE WORDS ARE NOT');
/* Shona terms are not reciprocal — Sekuru one way, Muzukuru the other — and
   this is the thing underneath that is. A family shown two different paths
   for one connection would reasonably conclude the app had two answers. */
{
  const t = family();
  const there = t.fe.linkChain(t.belinda, t.tendai);
  const back  = t.fe.linkChain(t.tendai, t.belinda);
  eq('the same people, in the other order',
     back.map(s => s.id), there.map(s => s.id).reverse());
  /* And the LINK WORD follows the person it reaches, not the person it was
     asked from: coming the other way the same sibling step is a sister,
     because Rudo is one. */
  eq('with the links named from the other end',
     said(t.fe, back), ['sister Rudo', 'daughter Belinda']);
  t.fe.setMe(t.tendai);
  eq('while the word turns over', (t.fe.relationship(t.tendai, t.belinda) || {}).term, 'Muzukuru');
}

section('A LINK THAT IS ONE LINK IS NOT SHOWN AT ALL');
/* "Amai — Belinda's mother" is the word and the chain in one breath, and a
   panel that prints the trace underneath the term has said it twice. The
   block earns its place only where it names a PATH. */
{
  const t = family();
  eq('mother and daughter have a chain of one', t.fe.linkChain(t.belinda, t.rudo).length - 1, 1);
  eq('and nothing is drawn for it', t.fe.chainInk(t.belinda, t.rudo), '');
  check('while two links are drawn', t.fe.chainInk(t.belinda, t.tendai).length > 0);
}

section('MARRIED IN, AND THE CHAIN CROSSES THE MARRIAGE');
/* The one case a blood-only walk cannot answer, and the commonest question in
   a tree that records who the daughters married: what is this stranger to me.
   Grace is nobody's relative by blood and is plainly somebody's relative. */
{
  const t = family();
  const chain = t.fe.linkChain(t.belinda, t.grace);
  eq('her mother, her mother’s brother, and the woman he married',
     said(t.fe, chain), ['mother Rudo', 'brother Tendai', 'wife Grace']);
}

section('AND BLOOD IS WALKED BEFORE MARRIAGE');
/* Belinda's father Joseph is one step away by blood and one step away through
   her mother's marriage. Both are true; only one of them is how anybody would
   say it, and a chain that reaches a father by way of his wife is the app
   showing off its graph instead of answering. */
{
  const t = family();
  const chain = t.fe.linkChain(t.belinda, t.joseph);
  eq('her father is her father', said(t.fe, chain), ['father Joseph']);
}

section('NOBODY IS WALKED THROUGH WHO HAS BEEN SET ASIDE');
/* present() is the seam this whole app uses, and a path is exactly the kind
   of question that breaks if one place forgets: a record somebody set aside
   as a duplicate would go on joining two halves of a family that the tree no
   longer says are joined. */
{
  const t = family();
  t.fe.getState().people[t.rudo].aside = { by:'', at:'', why:'duplicate' };
  const chain = t.fe.linkChain(t.belinda, t.tendai);
  check('the way through her is gone with her', !chain);
  eq('and so is the block that would have shown it',
     t.fe.chainInk(t.belinda, t.tendai), '');
}

section('AND WHERE THE TREE RECORDS NO WAY, IT SAYS SO BY SAYING NOTHING');
{
  const t = family();
  const stranger = t.fe.addPerson('Tarisai Chikomba', 'f', 'Shumba', '1960', '');
  check('a name joined to nobody has no chain', !t.fe.linkChain(t.belinda, stranger));
  check('nor does somebody to themselves', !t.fe.linkChain(t.belinda, t.belinda));
  check('nor does nobody', !t.fe.linkChain(null, t.belinda));
}

section('WHAT IT PUTS ON THE SCREEN');
{
  const t = family();
  const ink = t.fe.chainInk(t.belinda, t.tendai);
  check('the people in between are named', /Rudo/.test(ink) && /Tendai/.test(ink));
  /* Belinda is holding the phone here, so her own mother is "your mother" —
     the section below is where somebody else's is named. */
  check('and whose what each of them is', /your mother/.test(ink) &&
        /Rudo’s brother/.test(ink), ink);
  check('and where the two lines meet', /both Sydney’s children/.test(ink), ink);
  check('and how many links that is', /2 recorded links/.test(ink), ink);
  check('and that this is the record and not the meaning',
        /not what the word means/.test(ink), ink);
  check('and it offers to show the way on the tree itself',
        /data-chain="/.test(ink), ink);
}

section('and it is written from wherever it is being read');
/* Every term in this app is reckoned from one person, and a path that says
   "Belinda's mother" to Belinda is a sentence about somebody else. */
{
  const t = family();
  t.fe.setMe(t.belinda);
  const mine = t.fe.chainInk(t.belinda, t.tendai);
  check('your own mother is yours', /your mother/.test(mine), mine);
  t.fe.setMe(t.sydney);
  const theirs = t.fe.chainInk(t.belinda, t.tendai);
  check('and somebody else’s is theirs, by name',
        /Belinda’s mother/.test(theirs), theirs);
}

section('AND NOT ONE ENGLISH KINSHIP WORD ANYWHERE IN IT');
/* The rule this project is built on. English has cousin, uncle, aunt, nephew
   and niece; Shona has none of those CATEGORIES, and an app that reaches for
   one to describe a link has quietly imposed a different system on a family
   in the middle of explaining their own. Checked on real output over every
   pair in the tree, not on the one sentence a test author looked at. */
{
  const t = family();
  const BANNED = /\b(cousin|uncle|aunt|aunty|auntie|nephew|niece|in-law|grand(son|daughter|child|father|mother|parent)s?)\b/i;
  const ids = t.fe.people().map(p => p.id);
  const bad = [];
  for (const a of ids) for (const b of ids){
    if (a === b) continue;
    const ink = t.fe.chainInk(a, b);
    if (BANNED.test(ink)) bad.push([a, b, ink.match(BANNED)[0]]);
  }
  eq('no pair in the tree is described with one', bad.map(x => x[2]), []);
}

section('AND A CHAIN IS NEVER LONGER THAN THE TREE');
/* A walk with a bad stopping rule is a page that hangs, and it would hang on
   the largest tree rather than the one being tested. */
{
  const fe = loadFrontend();
  let last = fe.addPerson('Head of the line', 'm', 'Shumba', '1800', '');
  const first = last;
  for (let i = 0; i < 60; i++)
    last = fe.grow('child', last, `Person ${i}`, i % 2 ? 'f' : 'm', 'Shumba', { born:String(1820 + i * 3) });
  const chain = fe.linkChain(first, last);
  eq('sixty generations down is sixty links', chain.length - 1, 60);
  check('and every step of it is a child', chain.slice(1).every(s => s.kind === 'down'));
}

report();
})();
