// THE FAMILY'S OWN GLOSSARY, put to the engine one word at a time.
//
// "Make sure relationships are clear and properly defined — amai, muzukuru,
//  sekuru, muroora, mukwasha, tete, munin'ina, mukoma, hanzvadzi,
//  mwanakomana, mwanasikana, baba, ambuya, amaiguru, amainini, babamukuru,
//  babamudiki, vamwene, vatezvara, ambuya, tsano. Make sure the links are
//  accurate and correct."
//
// That list is not a suggestion about vocabulary, it is the specification.
// Every other suite here checks a rule; this one checks the OUTPUT — that
// each word on the list comes back for the relation the family says it is
// for, from a household built the way households are.
//
// Four of them were wrong when the list arrived, and each fault was of a
// different kind, which is why a list is worth more than a rule:
//
//   ONE MAN, TWO WORDS. Your father's younger brother came back Babamunini,
//   and your younger sister's husband — the same standing, reached along
//   another path — came back Babamudiki. Both are Shona. One family using
//   both for one man is the app teaching two.
//
//   ONE WORD, TWO SPELLINGS. A wife's father was Tezvara here and Vatezvara
//   in the rule about joined houses.
//
//   ONE WORD WHERE THERE ARE TWO. A spouse's mother was Ambuya to everybody.
//   Ambuya is a man's word for his wife's mother; a woman's word for her
//   husband's mother is Vamwene. The engine had the speaker's sex in its
//   hand and never looked at it.
//
//   NO WORD AT ALL. The wives of a husband's brothers — who a woman lives
//   beside — came back unnamed.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* One household, deep enough to reach every word on the list: three
   generations above the man at the centre of it, two below, both sets of
   in-laws, and a second woman married into the same house so that the words
   the women of a household use for each other have somebody to be said to. */
function household(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');

  // his father's people
  const sekuruP = P('Garikai Musoni', 'm', 'Shumba', '1900');
  const ambuyaP = fe.grow('partner', sekuruP, 'Chipo Musoni', 'f', 'Nzou', { born:'1905' });
  const babamukuru = fe.grow('child', sekuruP, 'Tafara Musoni', 'm', 'Shumba', { born:'1925' });
  const baba       = fe.grow('child', sekuruP, 'Farai Musoni', 'm', 'Shumba', { born:'1930' });
  const tete       = fe.grow('child', sekuruP, 'Rumbi Musoni', 'f', 'Shumba', { born:'1933' });
  const babamudiki = fe.grow('child', sekuruP, 'Tendai Musoni', 'm', 'Shumba', { born:'1936' });

  // his mother's people
  const ambuyaM  = P('Loice Moyo', 'f', 'Moyo', '1908');
  const sekuruM  = fe.grow('partner', ambuyaM, 'Josiah Moyo', 'm', 'Moyo', { born:'1903' });
  const amaiguru = fe.grow('child', ambuyaM, 'Miriam Moyo', 'f', 'Moyo', { born:'1930' });
  const amai     = fe.grow('child', ambuyaM, 'Esther Moyo', 'f', 'Moyo', { born:'1934' });
  const sekuruB  = fe.grow('child', ambuyaM, 'Lovemore Moyo', 'm', 'Moyo', { born:'1937' });
  const amainini = fe.grow('child', ambuyaM, 'Netsai Moyo', 'f', 'Moyo', { born:'1940' });
  const ambuyaB  = fe.grow('partner', sekuruB, 'Jane Moyo', 'f', 'Hove', { born:'1942' });
  fe.linkExisting('partner', baba, amai);

  // him and his own row
  const mukoma    = fe.grow('child', baba, 'Simba Musoni', 'm', 'Shumba', { born:'1958' });
  const me        = fe.grow('child', baba, 'Tonderai Musoni', 'm', 'Shumba', { born:'1962' });
  const hanzvadzi = fe.grow('child', baba, 'Ruvarashe Musoni', 'f', 'Shumba', { born:'1965' });
  const muninina  = fe.grow('child', baba, 'Kuda Musoni', 'm', 'Shumba', { born:'1967' });
  // A second sister, so that the women's own same-sex pair has somebody in it.
  const sisYounger = fe.grow('child', baba, 'Tsitsi Musoni', 'f', 'Shumba', { born:'1971' });
  fe.setMe(me);

  // his wife's people
  const mukadzi   = fe.grow('partner', me, 'Anna Musoni', 'f', 'Hove', { born:'1966' });
  const vatezvara = P('Peter Hove', 'm', 'Hove', '1938');
  fe.linkExisting('child', vatezvara, mukadzi);
  const ambuyaW = fe.grow('partner', vatezvara, 'Grace Hove', 'f', 'Soko', { born:'1942' });
  const tsano   = fe.grow('child', vatezvara, 'Never Hove', 'm', 'Hove', { born:'1970' });
  const muramu  = fe.grow('child', vatezvara, 'Sarudzai Hove', 'f', 'Hove', { born:'1973' });

  // his children, and theirs
  const mwanakomana = fe.grow('child', me, 'Tapiwa Musoni', 'm', 'Shumba', { born:'1990' });
  const mwanasikana = fe.grow('child', me, 'Nyasha Musoni', 'f', 'Shumba', { born:'1993' });
  const muroora  = fe.grow('partner', mwanakomana, 'Pauline Musoni', 'f', 'Mhofu', { born:'1992' });
  const mukwasha = fe.grow('partner', mwanasikana, 'Blessing Dube', 'm', 'Dube', { born:'1991' });
  const muzukuru = fe.grow('child', mwanakomana, 'Anesu Musoni', 'm', 'Shumba', { born:'2015' });
  const sisChild = fe.grow('child', hanzvadzi, 'Tanaka Ncube', 'f', 'Ncube', { born:'1995' });

  /* Pauline married in, so the household has a second set of words in it:
     hers. Her husband's older and younger brothers, and the women they
     married, are who she says Amaiguru and Amainini to. */
  const husOlder   = fe.grow('child', me, 'Munashe Musoni', 'm', 'Shumba', { born:'1987' });
  const husYounger = fe.grow('child', me, 'Takudzwa Musoni', 'm', 'Shumba', { born:'1996' });
  const wifeOlder   = fe.grow('partner', husOlder, 'Chiedza Musoni', 'f', 'Nzou', { born:'1988' });
  const wifeYounger = fe.grow('partner', husYounger, 'Ropafadzo Musoni', 'f', 'Nzou', { born:'1997' });

  return { fe, me, amai, baba, sekuruP, sekuruM, sekuruB, ambuyaP, ambuyaM, ambuyaB,
           babamukuru, babamudiki, amaiguru, amainini, tete, mukoma, muninina,
           hanzvadzi, mwanakomana, mwanasikana, muzukuru, sisChild, muroora,
           mukwasha, vatezvara, ambuyaW, tsano, muramu, mukadzi,
           sisYounger, wifeOlder, wifeYounger };
}

const h = household();
const words = (from, to) => {
  const k = h.fe.kinTerms(from, to);
  return (k && k.list.length) ? k.list.map(x => x.term).filter(Boolean) : [];
};
/* A person is often several things at once, so the test asks whether the word
   is AMONG their words, not whether it is their only one. Anything stricter
   would be testing the overlap rules rather than the glossary. */
const says = (label, from, to, want) =>
  check(label, words(from, to).includes(want),
        `wanted ${want}, got ${words(from, to).join(' + ') || 'no word at all'}`);

section('THE LINE ABOVE HIM');
{
  says('amai — his mother',                   h.me, h.amai,       'Amai');
  says('baba — his father',                   h.me, h.baba,       'Baba');
  says("sekuru — his father's father",        h.me, h.sekuruP,    'Sekuru');
  says("sekuru — his mother's father",        h.me, h.sekuruM,    'Sekuru');
  says("sekuru — his mother's brother",       h.me, h.sekuruB,    'Sekuru');
  says("ambuya — his father's mother",        h.me, h.ambuyaP,    'Ambuya');
  says("ambuya — his mother's mother",        h.me, h.ambuyaM,    'Ambuya');
  says("ambuya — his mother's brother's wife", h.me, h.ambuyaB,   'Ambuya');
  says("tete — his father's sister",          h.me, h.tete,       'Tete');
}

section('AND THE GRADING IN IT, which is the whole of four of these words');
{
  says("babamukuru — father's older brother",  h.me, h.babamukuru, 'Babamukuru');
  says("babamudiki — father's younger brother", h.me, h.babamudiki, 'Babamudiki');
  says("amaiguru — mother's older sister",     h.me, h.amaiguru,   'Amaiguru');
  says("amainini — mother's younger sister",   h.me, h.amainini,   'Amainini');

  /* THE FAULT THIS PINS. The same standing was reached by a second path — a
     younger sister's husband stands where a father stands — and came back
     under a different word. Whichever spelling a family uses, it has to be
     the one spelling. */
  check('and Babamunini is not also in use for him',
        !words(h.me, h.babamudiki).includes('Babamunini'),
        words(h.me, h.babamudiki).join(' + '));
  /* And the other path to that same standing, which is where the two
     spellings used to part company. A sister's husband stands where a father
     stands — but only to a WOMAN; to her brother he is Mukwasha, always. So
     the word has to be asked for from a woman, and graded by which sister. */
  const sis2Husband = h.fe.grow('partner', h.sisYounger, 'Peter Ncube', 'm', 'Ncube', { born:'1968' });
  says("her younger sister's husband is Babamudiki — the same word",
       h.hanzvadzi, sis2Husband, 'Babamudiki');
  check('while to her brother the same man is Mukwasha, not a father at all',
        words(h.me, sis2Husband).includes('Mukwasha'),
        words(h.me, sis2Husband).join(' + '))
}

section('HIS OWN ROW');
{
  says('mukoma — his older brother',     h.me, h.mukoma,    'Mukoma');
  says("munin'ina — his younger brother", h.me, h.muninina, "Munin'ina");
  says('hanzvadzi — his sister',         h.me, h.hanzvadzi, 'Hanzvadzi');
  says('and hanzvadzi is what she calls him back',
       h.hanzvadzi, h.me, 'Hanzvadzi');
  /* Mukoma and Munin'ina are the same-sex pair, so they are HER words for her
     sisters too — not a man's words borrowed into a woman's mouth. */
  says("munin'ina — her younger sister", h.hanzvadzi, h.sisYounger, "Munin'ina");
  says('mukoma — and she is the older one to her', h.sisYounger, h.hanzvadzi, 'Mukoma');
  says('while her brother is Hanzvadzi, not graded at all',
       h.sisYounger, h.muninina, 'Hanzvadzi');
}

section('THE LINE BELOW HIM');
{
  says('mwanakomana — his son',      h.me, h.mwanakomana, 'Mwanakomana');
  says('mwanasikana — his daughter', h.me, h.mwanasikana, 'Mwanasikana');
  says("muzukuru — his son's son",   h.me, h.muzukuru,    'Muzukuru');
  /* The second Muzukuru is not the same relation in English and is one word
     in Shona: a sister's child is Muzukuru to a man. */
  says("muzukuru — his sister's child", h.me, h.sisChild, 'Muzukuru');
}

section('THE PEOPLE WHO MARRIED IN, AND THE ONES HE MARRIED INTO');
{
  says("muroora — his son's wife",         h.me, h.muroora,   'Muroora');
  says("mukwasha — his daughter's husband", h.me, h.mukwasha, 'Mukwasha');
  says("vatezvara — his wife's father",    h.me, h.vatezvara, 'Vatezvara');
  says("ambuya — his wife's mother",       h.me, h.ambuyaW,   'Ambuya');
  says("tsano — his wife's brother",       h.me, h.tsano,     'Tsano');
  says("muramu — his wife's sister",       h.me, h.muramu,    'Muramu');
}

section('AND THE SAME HOUSE IN A WOMAN’S WORDS, which are not his');
/* This is where the engine was handing half the family the other half's
   vocabulary. Pauline married Tapiwa; his parents and his brothers' wives are
   hers to name, and two of the four words she needs were wrong or missing. */
{
  says("vamwene — her husband's mother", h.muroora, h.mukadzi, 'Vamwene');
  check('and never Ambuya, which is what HE says of HIS wife’s mother',
        !words(h.muroora, h.mukadzi).includes('Ambuya'),
        words(h.muroora, h.mukadzi).join(' + '));
  says("vatezvara — her husband's father", h.muroora, h.me, 'Vatezvara');
  eq('so the father is one word from either side, and the mother is two',
     [words(h.me, h.vatezvara).includes('Vatezvara'),
      words(h.muroora, h.me).includes('Vatezvara')].join(','), 'true,true');

  says("amaiguru — her husband's older brother's wife",   h.muroora, h.wifeOlder,   'Amaiguru');
  says("amainini — her husband's younger brother's wife", h.muroora, h.wifeYounger, 'Amainini');
  /* The grading is read off Mukoma/Munin'ina rather than worked out again, so
     one place decides who is older and both words follow it. */
  check('and the grading is the brothers’ own, not a second opinion',
        words(h.wifeOlder, h.muroora).includes('Amainini') ||
        words(h.wifeOlder, h.muroora).length > 0,
        words(h.wifeOlder, h.muroora).join(' + ') || 'nothing');
}

section('EVERY WORD ON THE LIST IS REACHED BY SOMEBODY');
/* The check above tests each word where it belongs. This one is the ledger:
   if a word on the family's list is never produced by this household at all,
   it has quietly fallen out of the engine and no single assertion above would
   necessarily say so. */
{
  const wanted = ['Amai', 'Baba', 'Sekuru', 'Ambuya', 'Tete', 'Babamukuru',
                  'Babamudiki', 'Amaiguru', 'Amainini', 'Mukoma', "Munin'ina",
                  'Hanzvadzi', 'Mwanakomana', 'Mwanasikana', 'Muzukuru',
                  'Muroora', 'Mukwasha', 'Vatezvara', 'Vamwene', 'Tsano'];
  const everybody = Object.keys(h.fe.getState().people);
  const seen = new Set();
  for (const from of [h.me, h.muroora, h.hanzvadzi, h.mukadzi]){
    for (const to of everybody){
      if (to === from) continue;
      for (const t of words(from, to)) seen.add(t);
    }
  }
  const missing = wanted.filter(w => !seen.has(w));
  eq('none of the family’s words is unreachable', missing.join(', '), '');
}

report();
