// One word, many people — and where one of their words is several of ours.
//
// WHAT THIS IS FOR. The app has always known that your father's brothers are
// your fathers, that their children are your brothers and sisters and not
// your cousins, and that only the crossed pair — your mother's brother and
// your father's sister — stand apart. Every term on every card is derived
// from it. But it said so one card at a time, which is the western way of
// saying it: this person is your Babamukuru, that one your Babamunini.
// Nobody reading one card at a time ever sees the shape of the thing.
//
// So the same engine is asked the other way round: not "what is this person
// to me" but "who does this word reach". And once the answers are gathered
// by the word, one more question can be asked that has never been asked
// here before — what would a reckoning that only had "cousin" have done with
// these people? The answer is computed from the family's own tree rather
// than asserted about families in general, which is what makes it an
// argument rather than a claim.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* Four young men, and a western tree calls all four of them first cousins:
     Farai   — father's brother's son
     Kuda    — father's younger brother's son
     Nyasha  — father's sister's son
     Tapiwa  — mother's brother's son */
function four(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Sekuru', 'm', 'Mwendamberi', '1925');
  fe.grow('partner', gf, 'Mbuya', 'f', 'Shava', { born:'1930' });
  const ben  = fe.grow('child', gf, 'Ben', 'm', 'Mwendamberi', { born:'1952' });
  const dad  = fe.grow('child', gf, 'Baba', 'm', 'Mwendamberi', { born:'1956' });
  const tete = fe.grow('child', gf, 'Tete', 'f', 'Mwendamberi', { born:'1959' });
  const unc  = fe.grow('child', gf, 'Munini', 'm', 'Mwendamberi', { born:'1962' });

  const mai = fe.grow('partner', dad, 'Mai', 'f', 'Nzou', { born:'1958' });
  const maiDad = P('Sekuru Nzou', 'm', 'Nzou', '1930');
  fe.linkExisting('child', maiDad, mai);
  const samu = P('Samu', 'm', 'Nzou', '1954');
  fe.linkExisting('child', maiDad, samu);
  fe.linkExisting('partner', tete, P('Tete murume', 'm', 'Soko', '1957'));

  const me = fe.grow('child', dad, 'Tanaka', 'm', 'Mwendamberi', { born:'1990' });
  const sis = fe.grow('child', dad, 'Rudo', 'f', 'Mwendamberi', { born:'1993' });
  const farai  = fe.grow('child', ben,  'Farai', 'm', 'Mwendamberi', { born:'1988' });
  const kuda   = fe.grow('child', unc,  'Kuda', 'm', 'Mwendamberi', { born:'1995' });
  const nyasha = fe.grow('child', tete, 'Nyasha', 'f', 'Soko', { born:'1991' });
  const tapiwa = fe.grow('child', samu, 'Tapiwa', 'm', 'Nzou', { born:'1989' });
  fe.setMe(me);
  return { fe, gf, ben, dad, tete, unc, mai, maiDad, samu, me, sis,
           farai, kuda, nyasha, tapiwa };
}
const term = (fe, a, b) => {
  const k = fe.kinTerms(a, b);
  return k && k.list.length ? k.list[0].term : null;
};

section('FOUR PEOPLE A WESTERN TREE CALLS THE SAME THING, AND THIS ONE DOES NOT');
/* The whole argument in one section. If this ever starts agreeing with the
   western reckoning, something has gone wrong in the engine and not here. */
{
  const f = four();
  for (const who of ['farai', 'kuda', 'nyasha', 'tapiwa']){
    eq(`a western tree calls ${who} a first cousin`,
       f.fe.westernWord(f.me, f[who]), 'first cousin');
  }
  const said = ['farai', 'kuda', 'nyasha', 'tapiwa'].map(w => term(f.fe, f.me, f[w]));
  eq('this one calls them four different things', new Set(said).size, 4);
  check('and the one through his father’s brother is a brother, not a cousin',
        /^(Mukoma|Munin'ina)$/.test(term(f.fe, f.me, f.farai)), String(term(f.fe, f.me, f.farai)));
  check('while the one through his father’s sister is not',
        !/^(Mukoma|Munin'ina)$/.test(term(f.fe, f.me, f.nyasha)),
        String(term(f.fe, f.me, f.nyasha)));
}

section('and the panel says exactly that, computed from this family');
{
  const f = four();
  const splits = f.fe.wordSplits(f.me);
  const cousin = splits.find(s => s.word === 'first cousin');
  check('"first cousin" is one of the words that splits', !!cousin,
        JSON.stringify(splits.map(s => s.word)));
  check('into four', cousin && cousin.terms.length === 4,
        JSON.stringify(cousin && cousin.terms.map(t => t.term)));
  const uncle = splits.find(s => s.word === 'uncle');
  check('and "uncle" splits too', !!uncle && uncle.terms.length >= 2,
        JSON.stringify(uncle && uncle.terms.map(t => t.term)));
  check('the most-split word is listed first',
        splits[0].terms.length >= splits[splits.length - 1].terms.length,
        JSON.stringify(splits.map(s => [s.word, s.terms.length])));
}

section('a word that is not the same word both ways is not counted as a split');
/* wordSplits asks one question — what is each of these people to ONE person
   — so the answers cannot be muddled with the answers to the way back. */
{
  const f = four();
  for (const s of f.fe.wordSplits(f.me)){
    for (const t of s.terms){
      check(`every ${s.word} under ${t.term} really is one`,
            t.ids.every(id => f.fe.westernWord(f.me, id) === s.word), s.word);
    }
  }
}

section('THE WESTERN RECKONING, ON ITS OWN TERMS');
// It is only worth setting beside ours if it is done properly.
{
  const f = four();
  eq('father', f.fe.westernWord(f.me, f.dad), 'father');
  eq('mother', f.fe.westernWord(f.me, f.mai), 'mother');
  eq('sister', f.fe.westernWord(f.me, f.sis), 'sister');
  eq('grandfather', f.fe.westernWord(f.me, f.gf), 'grandfather');
  eq('uncle', f.fe.westernWord(f.me, f.ben), 'uncle');
  eq('aunt', f.fe.westernWord(f.me, f.tete), 'aunt');
  eq('nephew, the other way round', f.fe.westernWord(f.ben, f.me), 'nephew');
  eq('son', f.fe.westernWord(f.dad, f.me), 'son');
  eq('grandson', f.fe.westernWord(f.gf, f.me), 'grandson');
  /* And the one that gives the game away: it has ONE word for his father's
     older brother and his mother's brother, who are Babamukuru and Sekuru —
     a man of his own house and a man of another, who are owed completely
     different things. */
  eq('uncle, for his mother\u2019s brother as well', f.fe.westernWord(f.me, f.samu), 'uncle');
  eq('and for his father\u2019s brother', f.fe.westernWord(f.me, f.ben), 'uncle');
  check('while this tree keeps them apart',
        term(f.fe, f.me, f.samu) !== term(f.fe, f.me, f.ben),
        `${term(f.fe, f.me, f.samu)} / ${term(f.fe, f.me, f.ben)}`);
}

section('great-grandparents and second cousins');
{
  const fe = loadFrontend();
  const P = (n, s, b) => fe.addPerson(n, 'm', 'Nzou', b, '');
  const a = P('A', 'm', '1900');
  const b1 = fe.grow('child', a, 'B1', 'm', 'Nzou', { born:'1925' });
  const b2 = fe.grow('child', a, 'B2', 'm', 'Nzou', { born:'1928' });
  const c1 = fe.grow('child', b1, 'C1', 'm', 'Nzou', { born:'1950' });
  const c2 = fe.grow('child', b2, 'C2', 'm', 'Nzou', { born:'1953' });
  const d1 = fe.grow('child', c1, 'D1', 'm', 'Nzou', { born:'1975' });
  const d2 = fe.grow('child', c2, 'D2', 'm', 'Nzou', { born:'1978' });
  eq('great-grandfather', fe.westernWord(d1, a), 'great-grandfather');
  eq('great-grandson', fe.westernWord(a, d1), 'great-grandson');
  eq('second cousin', fe.westernWord(d1, d2), 'second cousin');
  eq('first cousin once removed', fe.westernWord(d1, c2), 'first cousin once removed');
  eq('great-uncle', fe.westernWord(d1, b2), 'great-uncle');
}

section('half-brothers are named as half-brothers, because that is its word');
{
  const fe = loadFrontend();
  const man = fe.addPerson('Man', 'm', 'Nzou', '1940', '');
  const w1 = fe.grow('partner', man, 'First wife', 'f', 'Shava', { born:'1942' });
  const w2 = fe.grow('partner', man, 'Second wife', 'f', 'Moyo', { born:'1950' });
  const s1 = fe.grow('child', w1, 'Son of the first house', 'm', 'Nzou', { born:'1965' });
  const s2 = fe.grow('child', w2, 'Son of the second house', 'm', 'Nzou', { born:'1972' });
  eq('half-brother', fe.westernWord(s1, s2), 'half-brother');
  check('and here they are simply brothers, by seniority',
        /^(Mukoma|Munin'ina)$/.test(String(term(fe, s1, s2))), String(term(fe, s1, s2)));
}

section('a marriage reaches one step and then stops');
/* There is no western word for your brother-in-law's wife's father either.
   A search that kept stepping through marriages found its way back to where
   it started instead of saying so — two unrelated couples in one tree, round
   and round until the stack gave out. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Nzou', '1950', '');
  const b = fe.grow('partner', a, 'B', 'f', 'Shava', { born:'1952' });
  const c = fe.addPerson('C', 'm', 'Soko', '1951', '');
  fe.grow('partner', c, 'D', 'f', 'Moyo', { born:'1953' });
  eq('his wife', fe.westernWord(a, b), 'wife');
  eq('and a stranger is a stranger, not an endless walk', fe.westernWord(a, c), null);
}

section('sister-in-law is reached, being one step');
{
  const f = four();
  const w = f.fe.westernWord(f.me, f.fe.getState().people[f.mai] ? f.mai : f.mai);
  eq('his mother is his mother, not an in-law', w, 'mother');
  // the husband of a sister
  const her = f.fe.grow('partner', f.sis, 'Her husband', 'm', 'Soko', { born:'1990' });
  eq('his sister’s husband', f.fe.westernWord(f.me, her), 'brother-in-law');
}

section('THE CENSUS GATHERS BY THE WORD, NOT BY THE PERSON');
{
  const f = four();
  const c = f.fe.kinCensus(f.me);
  check('it asked about everybody else in the tree', c.checked >= 15, String(c.checked));
  check('and nothing was cut short', c.capped === false);
  const baba = c.terms.find(t => t.term === 'Baba');
  check('Baba reaches his own father', baba && baba.ids.includes(f.dad),
        JSON.stringify(baba && baba.ids.length));
  const senior = c.terms.find(t => t.term === 'Babamukuru');
  check('and Babamukuru reaches his father’s older brother',
        senior && senior.ids.includes(f.ben));
  eq('every word is one the engine derived, none invented',
     c.terms.filter(t => !t.term).length, 0);
}

section('a word that reaches several rows is not filed under one of them');
/* Sekuru reaches his mother's father, his mother's brother and his mother's
   brother's son: three rows of the drawing, one relation. Filing it under
   whichever row most of them happen to stand in is what a reckoning that
   sorts people by generation does, and it is what loses the meaning. */
{
  const f = four();
  const c = f.fe.kinCensus(f.me);
  const sekuru = c.terms.find(t => t.term === 'Sekuru');
  check('Sekuru reaches more than one row', sekuru && sekuru.rows > 1,
        JSON.stringify(sekuru && sekuru.rows));
  eq('so it is banded across them', sekuru && sekuru.band, 'across');
  const band = c.bands.find(b => b.at === 'across');
  check('and that band comes last, after the rows',
        c.bands[c.bands.length - 1] === band, JSON.stringify(c.bands.map(b => b.at)));
  const own = c.terms.find(t => t.term === 'Hanzvadzi');
  eq('while a word that reaches one row keeps that row', own && own.band, 0);
}

section('the rows are named as places, not as numbers');
{
  const fe = loadFrontend();
  eq('your own', fe.bandLabel(0), 'Standing in your own row');
  eq("your parents'", fe.bandLabel(-1), 'The row your parents stand in');
  eq("your grandparents'", fe.bandLabel(-2), "Your grandparents' row");
  check('and far back is still a sentence', /rows back/.test(fe.bandLabel(-4)),
        fe.bandLabel(-4));
}

section('a word the family taught is counted with the rest, and marked as theirs');
{
  const f = four();
  const shape = f.fe.kinTerms(f.me, f.fe.getState().people[f.mai] ? f.mai : f.mai) &&
                f.fe.kinTerms(f.me, f.mai).list[0].shape;
  f.fe.teachTerm(shape, 'Mhamha', 'what we call her at home');
  const c = f.fe.kinCensus(f.me);
  const taught = c.terms.find(t => t.term === 'Mhamha');
  check('it is in the census', !!taught, JSON.stringify(c.terms.map(t => t.term)));
  check('marked as the family’s own', taught && taught.taught === true);
  check('and the word it replaced is not counted twice',
        !c.terms.some(t => t.term === 'Amai' && t.ids.includes(f.mai)));
}

section('nobody set aside is counted');
// They are out of the picture, and a census of the picture must agree.
{
  const f = four();
  f.fe.setAside(f.farai, 'entered twice');
  const c = f.fe.kinCensus(f.me);
  check('they are in nobody’s word',
        c.terms.every(t => !t.ids.includes(f.farai)),
        JSON.stringify(c.terms.filter(t => t.ids.includes(f.farai)).map(t => t.term)));
}

section('and asking twice gives the same answer');
{
  const f = four();
  const once = JSON.stringify(f.fe.kinCensus(f.me).terms);
  const twice = JSON.stringify(f.fe.kinCensus(f.me).terms);
  eq('identical', once, twice);
}

report();
