// TETE, AND THE LINE THAT RUNS DOWN FROM HER.
//
// "Hollie is my brothers daughter, so therefore I am her tete. Thus my son is
//  mwanakomana to her and he calls her amainini."
//
// Sent with a photograph of Hollie's pod reading SEKURU.
//
// EVERY WORD OF THAT WAS ALREADY RIGHT IN THE ENGINE. kinPath found the
// crossing, overlaps() gave Amainini one way and Mwanakomana the other, and
// the two agreed with each other and with the family. The screenshot said
// Sekuru for one reason and one only: nobody had recorded whether Hollie is a
// woman.
//
// The overlap that knows she is Amainini is guarded on her being a she. The
// line underneath it — "descended from your mother's brother, that line stays
// Sekuru" — was guarded on nothing, so it handed out the man's word to
// somebody the app had no sex for at all. Not a fallback: a claim about a
// person, made out of nothing, in the one place a family would never think to
// check.
//
// This project's position has always been that a word nobody said is worse
// than no word. So where the sex decides the word and the sex is not
// recorded, there is no word — and the card says which fact is missing and
// offers the one tap that supplies it.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* The family as it was described. A woman, her brother, his daughter Hollie,
   and the woman's son. */
function family(hollieSex = 'f'){
  const fe = loadFrontend();
  const gf = fe.addPerson('Grandfather Musoni', 'm', 'Mhesvi', '1930', '');
  const her = fe.grow('child', gf, 'Tete herself', 'f', 'Mhesvi', { born:'1965' });
  const bro = fe.grow('sibling', her, 'Her brother', 'm', 'Mhesvi', { born:'1968' });
  const hollie = fe.grow('child', bro, 'Hollie Musoni', hollieSex, 'Mhesvi', { born:'1995' });
  const son = fe.grow('child', her, 'Takunda Musoni', 'm', 'Mhesvi', { born:'2003' });
  return { fe, gf, her, bro, hollie, son };
}
const word = (t, a, b) => {
  t.fe.setMe(a);
  const k = t.fe.kinTerms(a, b);
  return k && k.list.length ? k.list[0].term : null;
};

section('"I AM HER TETE"');
{
  const t = family();
  eq('her brother’s daughter calls her Tete', word(t, t.hollie, t.her), 'Tete');
  eq('and she calls her brother’s daughter Muzukuru',
     word(t, t.her, t.hollie), 'Muzukuru');
}

section('"HE CALLS HER AMAININI"');
/* Her father is Takunda's Sekuru, and a woman of your mother's house is
   Amainini — whatever her age, which is the whole difference between this
   word and the graded one a mother's own sister carries. */
{
  const t = family();
  eq('his mother’s brother’s daughter is Amainini', word(t, t.son, t.hollie), 'Amainini');
}

section('"MY SON IS MWANAKOMANA TO HER"');
/* The reciprocal, and it has to agree with the word above or the app is
   telling the two of them different things about the same link. */
{
  const t = family();
  eq('her Tete’s son is her Mwanakomana', word(t, t.hollie, t.son), 'Mwanakomana');
}

section('and a daughter of that Tete would be Mwanasikana');
{
  const t = family();
  const girl = t.fe.grow('child', t.her, 'A daughter', 'f', 'Mhesvi', { born:'2006' });
  eq('the same word, for a girl', word(t, t.hollie, girl), 'Mwanasikana');
}

section('HER BROTHER’S SON IS STILL SEKURU');
/* The line the family drew: "my brothers sons are sekuru to my children and
   his daughters are mainini to my children." Both halves, or neither. */
{
  const t = family();
  const nephew = t.fe.grow('child', t.bro, 'Her brother’s son', 'm', 'Mhesvi', { born:'1997' });
  eq('a son of that house is Sekuru', word(t, t.son, nephew), 'Sekuru');
  eq('while his sister is Amainini', word(t, t.son, t.hollie), 'Amainini');
}

section('BUT WITH NO SEX RECORDED, THE APP SAYS NOTHING AT ALL');
/* This is the bug that was photographed. It used to say Sekuru here —
   the man's word, for somebody it had no sex for. */
{
  const t = family('');
  eq('no word is invented', word(t, t.son, t.hollie), null);
  const gap = t.fe.whyNotNamed(t.son, t.hollie);
  check('and the one missing fact is named',
        gap && /whether Hollie is a he or a she/.test(gap.text), JSON.stringify(gap));
  check('with the record to put it on',
        gap && gap.fix === t.hollie && gap.need === 'sex', JSON.stringify(gap));
  check('and it says the word follows once it is there',
        /the word follows/.test(gap.text), gap.text);
}

section('and the pod carries no word rather than the wrong one');
{
  const t = family('');
  t.fe.setMe(t.son);
  const html = t.fe.draw();
  const pod = (html.split('data-id').find(x => /Hollie Musoni/.test(x)) || '');
  check('nothing above her name', !/<span class="ttl">/.test(pod), pod.slice(0, 200));
  check('and certainly not Sekuru', !/Sekuru/.test(pod), pod.slice(0, 200));
}

section('and the moment the sex is recorded, the word arrives');
{
  const t = family('');
  eq('nothing to begin with', word(t, t.son, t.hollie), null);
  t.fe.getState().people[t.hollie].sex = 'f';
  eq('and Amainini once she is a she', word(t, t.son, t.hollie), 'Amainini');
}

section('THE SAME GUARD TWO GENERATIONS UP');
/* The other place a crossed line handed out the man's word for an unrecorded
   sex. Ambuya for a woman, Sekuru for a man, and nothing for nobody-said. */
{
  const t = family();
  const old = t.fe.grow('parent', t.gf, 'The elder', '', 'Mhesvi', { born:'1900' });
  t.fe.setMe(t.son);
  const k = t.fe.kinTerms(t.son, old);
  check('no word for somebody with no sex recorded',
        !k.list.length || k.list[0].term === null,
        JSON.stringify(k.list.map(x => x.term)));
  t.fe.getState().people[old].sex = 'f';
  eq('Ambuya once she is a she', word(t, t.son, old), 'Ambuya');
  t.fe.getState().people[old].sex = 'm';
  eq('and Sekuru once he is a he', word(t, t.son, old), 'Sekuru');
}

report();
