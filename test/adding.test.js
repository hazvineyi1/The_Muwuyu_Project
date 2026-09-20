// Adding somebody by what you call them.
//
// "I want to be able to simply add the right relationship based on what they
// are known [as]."
//
// Until now the only way to add a person was to say what POSITION they held:
// parent, sibling, partner, child. Four words, and not one of them is a word
// this family uses. Nobody says "I will add a sibling of my father"; they say
// "this is my Tete". The app knew every one of those words and would tell you
// one after the fact — it would not take one from you.
//
// So the words become the way in, and the one property that matters is the
// round trip: pick a word, let the app build whatever shape it thinks that
// word means, and ask the engine what the two people are to each other. If
// the answer is not the word you picked, the app has quietly recorded
// something other than what you said.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function person(){
  const fe = loadFrontend();
  const me = fe.addPerson('Tanaka', 'm', 'Mwendamberi', '1990', '');
  fe.setMe(me);
  return { fe, me };
}
const wordFor = (fe, a, b) => {
  const k = fe.kinTerms(a, b);
  return k && k.list.length ? k.list.map(t => t.term) : [];
};

section('EVERY WORD GIVES BACK THE WORD IT WAS PICKED BY');
/* The whole feature in one assertion, over every word offered. It is worth
   this much care because the failure is silent: somebody asks for a Maiguru,
   the app writes down a shape, and the card afterwards says something else
   entirely. Two of them did exactly that while this was being written —
   Maiguru and Mainini, where the engine derives Amaiguru and Amainini. */
{
  const t = person();
  t.fe.grow('parent', t.me, 'Baba', 'm', 'Mwendamberi', { born:'1960' });
  t.fe.grow('parent', t.me, 'Mai', 'f', 'Nzou', { born:'1963' });
  t.fe.grow('child', t.me, 'Son', 'm', 'Mwendamberi', { born:'2015' });
  t.fe.grow('child', t.me, 'Daughter', 'f', 'Mwendamberi', { born:'2018' });
  t.fe.grow('sibling', t.me, 'Sis', 'f', 'Mwendamberi', { born:'1995' });

  const ways = t.fe.waysToAdd(t.me).filter(w => w.ready);
  check('there are plenty of them', ways.length >= 20, String(ways.length));

  const wrong = [];
  for (const w of ways){
    const id = t.fe.grow(w.kind, w.on, `Test ${w.term} ${w.gloss}`, w.preset.sex || '', 'Shava',
      { position:w.preset.position, born:w.preset.position === 'older' ? '1900' : '2030' });
    const got = wordFor(t.fe, t.me, id);
    if (!got.includes(w.term)) wrong.push(`${w.term} (${w.gloss}) came back as ${got.join('/') || 'nothing'}`);
  }
  eq('and not one of them records something else', wrong, []);
}

section('THE PERSON IT HANGS OFF IS OFTEN NOT THE ONE YOU TAPPED');
// Which is the whole reason this exists. Tete is a sister of your father,
// and nobody should have to work that out to write her down.
{
  const t = person();
  const dad = t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  const tete = t.fe.waysToAdd(t.me).find(w => w.term === 'Tete');
  eq('Tete is recorded on your father', tete.on, dad);
  eq('as a sibling of his', tete.kind, 'sibling');
  eq('and the app already knows she is a she', tete.preset.sex, 'f');

  const sekuru = t.fe.waysToAdd(t.me).find(w => w.gloss === "your father's father");
  eq('and a grandfather is a parent of your father', sekuru.on, dad);
  eq('recorded as a parent', sekuru.kind, 'parent');
}

section('THE WORD ANSWERS THE SENIORITY TOO');
/* Babamukuru and Babamunini are the same man one way and not the other, and
   the difference is which of them was born first. Picking the word has
   already said it. */
{
  const t = person();
  t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  const ways = t.fe.waysToAdd(t.me);
  eq('the older brother is older', ways.find(w => w.term === 'Babamukuru').preset.position, 'older');
  eq('and the younger is younger', ways.find(w => w.term === 'Babamunini').preset.position, 'younger');
}

section('IT NEVER INVENTS THE PERSON IN BETWEEN');
/* With no father recorded there is no sister to add a Tete to. A tree that
   quietly created a father nobody had named would be making up a man — so it
   says who is missing instead, which is the truth and is one tap to fix. */
{
  const t = person();
  const ways = t.fe.waysToAdd(t.me);
  const tete = ways.find(w => w.term === 'Tete');
  check('Tete cannot be added yet', !tete.ready);
  eq('and it says exactly who is missing', tete.missing, 'your father');

  const son = ways.find(w => w.gloss === "your son's wife");
  eq('a son is needed before a Muroora', son.missing, 'a son');

  check('but a father can always be added, because he needs nobody',
        ways.find(w => w.term === 'Baba').ready);
  check('and so can a child', ways.find(w => w.term === 'Mwanakomana').ready);
}

section('and once the person in between is there, the word opens up');
{
  const t = person();
  check('no Tete at first', !t.fe.waysToAdd(t.me).find(w => w.term === 'Tete').ready);
  t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  check('and a Tete once there is a father',
        t.fe.waysToAdd(t.me).find(w => w.term === 'Tete').ready);
}

section('a father already recorded is not offered twice');
// Two fathers is not a thing this record can mean.
{
  const t = person();
  t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  const baba = t.fe.waysToAdd(t.me).find(w => w.term === 'Baba');
  check('it says he is already there', baba.done === true);
  check('and offers no way to add another', !baba.ready);
  check('while a mother is still open',
        t.fe.waysToAdd(t.me).find(w => w.term === 'Amai').ready);
}

section('THE SAME-SEX PAIR IS NOT OFFERED TO SOMEBODY WHOSE SEX IS NOT RECORDED');
/* Mukoma and Munin'ina mean an older or younger brother to a man and an
   older or younger sister to a woman. Offering them to a record that does
   not say which would be guessing at the one thing the word turns on. */
{
  const fe = loadFrontend();
  const who = fe.addPerson('Unknown', '', 'Nzou', '1990', '');
  fe.setMe(who);
  const ways = fe.waysToAdd(who);
  const mukoma = ways.find(w => w.term === 'Mukoma');
  check('it is not ready', !mukoma.ready);
  check('and says what it is waiting on', /he or a she/.test(String(mukoma.missing)),
        String(mukoma.missing));
  check("Hanzvadzi is not offered either, for the same reason",
        !ways.some(w => w.term === 'Hanzvadzi'));
  check('but a son is, because a son is a son either way',
        ways.find(w => w.term === 'Mwanakomana').ready);
}

section('and to a woman, Mukoma is an older sister');
{
  const fe = loadFrontend();
  const her = fe.addPerson('Rudo', 'f', 'Nzou', '1990', '');
  fe.setMe(her);
  const ways = fe.waysToAdd(her);
  eq('said in her own terms', ways.find(w => w.term === 'Mukoma').gloss, 'your older sister');
  eq('and she is added as a woman', ways.find(w => w.term === 'Mukoma').preset.sex, 'f');
  eq('while Hanzvadzi is her brother', ways.find(w => w.term === 'Hanzvadzi').gloss, 'your brother');
}

section('BOTH MEANINGS OF A WORD ARE OFFERED, NEVER ONE GUESSED AT');
/* Sekuru is your mother's brother and your mother's father and your father's
   father. Muzukuru is your grandchild and your sister's child. A list that
   picked one would be wrong most of the time it was used. */
{
  const t = person();
  t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  t.fe.grow('parent', t.me, 'Mai', 'f', 'Nzou', { born:'1963' });
  t.fe.grow('child', t.me, 'Son', 'm', 'Mwendamberi', { born:'2015' });
  t.fe.grow('sibling', t.me, 'Sis', 'f', 'Mwendamberi', { born:'1995' });
  const ways = t.fe.waysToAdd(t.me);
  const sekuru = ways.filter(w => w.term === 'Sekuru');
  eq('three ways to be a Sekuru', sekuru.length, 3);
  check('the mother’s brother among them',
        sekuru.some(w => w.gloss === "your mother's brother"));
  const muzukuru = ways.filter(w => w.term === 'Muzukuru' && w.ready);
  check('and a Muzukuru is a grandchild or a sister’s child',
        muzukuru.some(w => /son's child/.test(w.gloss)) &&
        muzukuru.some(w => /sister's child/.test(w.gloss)),
        JSON.stringify(muzukuru.map(w => w.gloss)));
}

section('every word offered is one this app can actually derive');
/* A list that offered a word the engine has never heard of would be writing
   a shape the card could not read back. */
{
  const t = person();
  t.fe.grow('parent', t.me, 'Ben', 'm', 'Mwendamberi', { born:'1960' });
  t.fe.grow('parent', t.me, 'Mai', 'f', 'Nzou', { born:'1963' });
  const bad = t.fe.waysToAdd(t.me)
    .filter(w => w.ready)
    .filter(w => {
      const id = t.fe.grow(w.kind, w.on, 'Probe', w.preset.sex || '', 'Shava',
        { position:w.preset.position, born:w.preset.position === 'older' ? '1900' : '2030' });
      const got = wordFor(t.fe, t.me, id);
      t.fe.setAside(id, 'probe');
      t.fe.deleteForever(id);
      return !got.includes(w.term);
    })
    .map(w => w.term);
  eq('none of them is a word the engine does not know', bad, []);
}

report();
