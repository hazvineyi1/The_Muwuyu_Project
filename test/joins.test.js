// A family that hangs on one person.
//
// "The red line is a different family joined by one person. I want to be able
// to block out / close one family as I work on the other one, especially when
// joined by one person like via marriage."
//
// There was a red line down that screenshot with Mandaba on one side and
// Musoni on the other, and the only thing holding the two together was Evelyn
// Mandaba, who married Sydney. Take Evelyn out and the picture falls into two
// families that have never met.
//
// NOBODY MARKS THOSE PEOPLE BY HAND. A person whose removal splits the tree
// is a cut vertex, and every one of them can be found in a single pass over
// the same person-and-marriage graph the app already walks. The hard part is
// not finding them — it is deciding which ones are worth offering, because
// your own father is one too.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* The shape from the screenshot: a Musoni line four generations deep, and a
   Mandaba family hanging entirely on Evelyn's marriage to Sydney. */
function twoFamilies(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const chai = P('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900');
  const mavhu = fe.grow('partner', chai, 'Mavhu Musoni', 'f', 'Shava', { born:'1905' });
  const thomas = fe.grow('child', chai, 'Thomas Musoni', 'm', 'Mwendamberi', { born:'1927' });
  const baya = fe.grow('child', chai, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1925' });
  const sydney = fe.grow('child', thomas, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const me = fe.grow('child', sydney, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);

  const evelyn = fe.grow('partner', sydney, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1934' });
  const james = P('James Mandaba', 'm', 'Moyondizvo', '1900');
  fe.linkExisting('child', james, evelyn);
  const janet = fe.grow('partner', james, 'Janet Mandaba', 'f', 'Shava', { born:'1905' });
  const sibs = ['Joseph Mandaba', 'Minah Mandaba', 'Tendai Mandaba'].map((n, i) =>
    fe.grow('child', james, n, i ? 'f' : 'm', 'Moyondizvo', { born:String(1930 + i*3) }));
  return { fe, chai, mavhu, thomas, baya, sydney, me, evelyn, james, janet, sibs };
}
const nameOf = (fe, id) => (fe.getState().people[id] || {}).name;
const drawn = fe => new Set(Object.keys(fe.layoutOf().persons));

section('THE APP FINDS THE SEAM BY ITSELF');
{
  const t = twoFamilies();
  const cuts = [...t.fe.cutPeople()].map(id => nameOf(t.fe, id));
  check('Evelyn is a person the tree would split at', cuts.includes('Evelyn Mandaba'),
        JSON.stringify(cuts));
  check('and so, truthfully, is the father the line runs through',
        cuts.includes('Sydney Musoni'), JSON.stringify(cuts));
  check('somebody with nobody behind them is not',
        !cuts.includes('Hazvineyi Musoni'), JSON.stringify(cuts));
}

section('BUT ONLY THE ONES THAT READ AS ANOTHER FAMILY ARE OFFERED');
/* Your father is a seam: take him out and his parents are cut off from you.
   Structurally he is identical to the woman who married in — both joined to
   one side by a marriage and to the other by their own parents — so the shape
   cannot separate them. The name can, and the name is how the family said it. */
{
  const t = twoFamilies();
  const offered = t.fe.joinsIn();
  eq('one offer', offered.length, 1);
  eq('and it is Evelyn', nameOf(t.fe, offered[0].id), 'Evelyn Mandaba');
  eq('with her people behind her', offered[0].n, 5);
  eq('named the way anybody would name them', offered[0].name, 'Mandaba');
  check('your own father is not offered',
        !offered.some(j => nameOf(t.fe, j.id) === 'Sydney Musoni'));
}

section('the name comes from the name she carries');
// A woman keeps her father's name when she marries, so Evelyn Mandaba
// standing in a row of Musoni is holding the answer in her own name.
{
  const t = twoFamilies();
  eq('hers', t.fe.houseNameFor([t.james, t.janet, ...t.sibs], t.evelyn), 'Mandaba');
  const nameless = t.fe.houseNameFor([t.james], t.fe.addPerson('Solo', 'f', 'Nzou', '1950', ''));
  check('and where there is no shared name, it is said as whose people they are',
        /people$/.test(nameless) || nameless === 'Mandaba', nameless);
}

section('a nest of seams keeps the innermost one');
/* Ben is a seam too — take him out and his wife AND her whole family go — but
   his fold is only his wife's fold with his wife added to it, and hiding the
   woman who married into your own household along with her people is not what
   anybody meant. */
{
  const t = twoFamilies();
  const ben = t.fe.grow('child', t.thomas, 'Ben Musoni', 'm', 'Mwendamberi', { born:'1932' });
  const idah = t.fe.grow('partner', ben, 'Idah Chikweya', 'f', 'Soko', { born:'1936' });
  const her = t.fe.addPerson('Tarisai Chikweya', 'm', 'Soko', '1908', '');
  t.fe.linkExisting('child', her, idah);
  t.fe.grow('child', her, 'Farai Chikweya', 'm', 'Soko', { born:'1940' });

  const offered = t.fe.joinsIn().map(j => nameOf(t.fe, j.id));
  check('the wife is offered', offered.includes('Idah Chikweya'), JSON.stringify(offered));
  check('and her husband is not', !offered.includes('Ben Musoni'), JSON.stringify(offered));
}

section('FOLDING TAKES THE FAMILY OUT OF THE PICTURE AND NOTHING ELSE');
{
  const t = twoFamilies();
  /* Twelve: the six Musoni, Evelyn, and the five Mandaba behind her. */
  eq('everybody to begin with', drawn(t.fe).size, 12);
  t.fe.toggleFold(t.evelyn);
  const on = drawn(t.fe);
  eq('seven once the Mandaba are folded', on.size, 7);
  check('her father has stepped out', !on.has(t.james));
  check('and her brothers and sister with him',
        t.sibs.every(id => !on.has(id)));
  check('but Evelyn herself stays, because she married into this household',
        on.has(t.evelyn));
  eq('and the tree still holds all twelve', Object.keys(t.fe.getState().people).length, 12);
}

section('the words are still true across the fold');
// The assertion this design exists to satisfy, the same one Start build has.
{
  const t = twoFamilies();
  const before = t.fe.kinTerms(t.me, t.james).list.map(x => x.term);
  t.fe.toggleFold(t.evelyn);
  t.fe.layoutOf();
  eq('unchanged', t.fe.kinTerms(t.me, t.james).list.map(x => x.term), before);
  check('and it is a real word', before.length > 0, JSON.stringify(before));
}

section('and nothing is written down');
{
  const t = twoFamilies();
  const synced = JSON.parse(JSON.stringify(t.fe.getState()));
  for (const p of Object.values(synced.people)) p.v = 1;
  t.fe.toggleFold(t.evelyn);
  t.fe.layoutOf();
  eq('a fold is a view, not an edit', t.fe.diffOps(synced, t.fe.getState()).length, 0);
}

section('A CHIP STANDS WHERE THEY WERE, SO THE JOIN IS STILL VISIBLY A JOIN');
{
  const t = twoFamilies();
  t.fe.toggleFold(t.evelyn);
  const L = t.fe.layoutOf();
  eq('one chip', L.knots.length, 1);
  eq('carrying their name', L.knots[0].name, 'Mandaba');
  eq('and how many are behind it', L.knots[0].n, 5);
  check('it stands under her, on the side her people came from',
        L.knots[0].y > L.persons[t.evelyn].y, JSON.stringify({
          evelyn:L.persons[t.evelyn].y, chip:L.knots[0].y }));
  check('and within a pod of standing straight below her',
        Math.abs(L.knots[0].x - L.persons[t.evelyn].x) < 132,
        String(Math.round(L.knots[0].x - L.persons[t.evelyn].x)));
}

section('opening them again puts the picture back exactly');
{
  const t = twoFamilies();
  const before = JSON.stringify(t.fe.layoutOf().persons);
  t.fe.toggleFold(t.evelyn);
  eq('folded', drawn(t.fe).size, 7);
  t.fe.unfoldAll();
  eq('and back as it was', JSON.stringify(t.fe.layoutOf().persons), before);
}

section('a fold whose join has been set aside folds nothing');
// Otherwise a family stays hidden with no handle left to bring them back.
{
  const t = twoFamilies();
  t.fe.toggleFold(t.evelyn);
  eq('folded', drawn(t.fe).size, 7);
  t.fe.setAside(t.evelyn, 'entered twice');
  const on = drawn(t.fe);
  check('her people are drawn again', on.has(t.james), JSON.stringify([...on].length));
  check('and she is the one who is gone', !on.has(t.evelyn));
}

section('and a tree too small to have two families in it offers nothing');
{
  const fe = loadFrontend();
  const a = fe.addPerson('A', 'm', 'Nzou', '1950', '');
  fe.grow('partner', a, 'B', 'f', 'Shava', { born:'1952' });
  fe.setMe(a);
  eq('nothing to fold', fe.joinsIn().length, 0);
}

section('the folded picture is drawn as carefully as the whole one');
{
  const t = twoFamilies();
  t.fe.toggleFold(t.evelyn);
  const L = t.fe.layoutOf();
  const rows = {};
  for (const [id, q] of Object.entries(L.persons)) (rows[q.y] = rows[q.y] || []).push(q.x);
  let overlaps = 0;
  for (const y of Object.keys(rows)){
    const r = rows[y].sort((a, b) => a - b);
    for (let i = 1; i < r.length; i++) if (r[i] - r[i-1] < 131.5) overlaps++;
  }
  eq('nobody stands on anybody', overlaps, 0);
  eq('and it draws the same twice', JSON.stringify(t.fe.layoutOf().persons),
                                    JSON.stringify(t.fe.layoutOf().persons));
}

// ── the signal that decides what is offered ───────────────────────────────
//
// TWO WRONG ANSWERS BEFORE THIS ONE, and they failed the same way.
//
// The first asked whether the SURNAME behind a seam differed from the
// reader's. Half the women in a real tree are entered under the name they
// married into — Idah Musoni, Bertha Enia Musoni — so by that test their own
// people are Musoni too, and a whole family standing behind one marriage was
// never noticed.
//
// The second asked the MUTUPO, on the reasoning that a woman keeps hers for
// life. The family who use this app put that right: "the mutupo is not easy
// to predict. It does not necessarily change for the woman when she gets
// married, it depends on that family." This project's own mutupoNotes had
// already said as much — a totem that does not follow the father's line is
// perfectly ordinary, and is a question rather than a finding. Deciding
// anything on it made a finding of it.
//
// So nothing is asked of the records at all. The GRAPH already knows: a seam
// standing on your own house line — you, your father, his father — is not a
// door out of the house, it is the house. Every other seam is somebody
// through whom another family arrived. Nothing anybody typed can make that
// wrong.

section('A WIFE ENTERED UNDER HER MARRIED NAME IS STILL FOUND');
{
  const t = twoFamilies();
  const idah = t.fe.grow('partner', t.thomas, 'Idah Musoni', 'f', 'Soko', { born:'1930' });
  const hers = t.fe.addPerson('Tarisai Musoni', 'm', 'Soko', '1905', '');
  t.fe.linkExisting('child', hers, idah);
  t.fe.grow('child', hers, 'Farai Musoni', 'm', 'Soko', { born:'1935' });
  t.fe.grow('child', hers, 'Chipo Musoni', 'f', 'Soko', { born:'1938' });

  const offered = t.fe.joinsIn();
  const hers2 = offered.find(j => nameOf(t.fe, j.id) === 'Idah Musoni');
  check('she carries a ring even though her surname is yours', !!hers2,
        JSON.stringify(offered.map(j => nameOf(t.fe, j.id))));
  eq('with her three people behind her', hers2.n, 3);
  /* The mutupo is still a fine LABEL — it is a report of what somebody wrote
     down. It is only as a TEST of who is whose that it cannot be trusted. */
  eq('and they are labelled by the mutupo, not by your own surname', hers2.name, 'Soko');
}

section('however the wife\u2019s own mutupo happens to have been written down');
/* The case that killed the mutupo rule. Some families record a woman under
   the totem she married into; some do not. The fold must not depend on which
   kind of family this is, because the app cannot know and the record does not
   say. */
{
  const each = totem => {
    const t = twoFamilies();
    for (const id of [t.evelyn, t.james, ...t.sibs]) t.fe.getState().people[id].totem = totem;
    return t.fe.joinsIn().map(j => [nameOf(t.fe, j.id), j.n]);
  };
  eq('recorded under her own house', each('Moyondizvo'), [['Evelyn Mandaba', 5]]);
  eq('recorded under her husband\u2019s, exactly the same answer',
     each('Mwendamberi'), [['Evelyn Mandaba', 5]]);
  eq('and with no totem recorded at all, still the same',
     each(''), [['Evelyn Mandaba', 5]]);
}

section('the crowd behind a seam never decides anything either');
/* An earlier attempt measured the far side. The far side of your own father
   holds his parents AND whoever his brothers married — count those and a
   houseful of in-laws outvotes your own grandfather, and the app offers to
   fold your father's line away. It did exactly that. */
{
  const t = twoFamilies();
  const idah = t.fe.grow('partner', t.thomas, 'Idah Musoni', 'f', 'Soko', { born:'1930' });
  const hers = t.fe.addPerson('Tarisai Musoni', 'm', 'Soko', '1905', '');
  t.fe.linkExisting('child', hers, idah);
  ['Farai', 'Chipo', 'Rudo', 'Tendai'].forEach((n, i) =>
    t.fe.grow('child', hers, `${n} Musoni`, i % 2 ? 'f' : 'm', 'Soko', { born:String(1935 + i*3) }));

  const offered = t.fe.joinsIn().map(j => nameOf(t.fe, j.id));
  check('your father is still not offered', !offered.includes('Sydney Musoni'), JSON.stringify(offered));
  check('nor your grandfather', !offered.includes('Thomas Musoni'), JSON.stringify(offered));
  check('and both wives are', offered.includes('Evelyn Mandaba') && offered.includes('Idah Musoni'),
        JSON.stringify(offered));
}

section('a man of your own house is never a door out of it');
/* However deep the line, whoever his brothers married, and whatever anybody
   wrote in his totem field. This is the assertion the structural rule buys:
   it cannot be broken by a record. */
{
  const t = twoFamilies();
  // give the whole line a totem nobody would expect, to prove it is not read
  for (const id of [t.sydney, t.thomas, t.chai]) t.fe.getState().people[id].totem = 'Nzou';
  const line = new Set([t.sydney, t.thomas, t.chai]);
  const offered = t.fe.joinsIn();
  check('nobody on your father\u2019s line is offered',
        offered.every(j => !line.has(j.id)),
        JSON.stringify(offered.map(j => nameOf(t.fe, j.id))));
  check('and your mother still is',
        offered.some(j => j.id === t.evelyn),
        JSON.stringify(offered.map(j => nameOf(t.fe, j.id))));
}

section('and a brother is not offered either, his wife is');
// He is not on your house line, but the nest rule puts the ring where the
// other family actually joined: on the person who married in.
{
  const t = twoFamilies();
  const ben = t.fe.grow('child', t.thomas, 'Ben Musoni', 'm', 'Mwendamberi', { born:'1932' });
  const idah = t.fe.grow('partner', ben, 'Idah Musoni', 'f', 'Soko', { born:'1936' });
  const hers = t.fe.addPerson('Tarisai Musoni', 'm', 'Soko', '1908', '');
  t.fe.linkExisting('child', hers, idah);
  t.fe.grow('child', hers, 'Farai Musoni', 'm', 'Soko', { born:'1940' });
  const offered = t.fe.joinsIn().map(j => nameOf(t.fe, j.id));
  check('the wife carries it', offered.includes('Idah Musoni'), JSON.stringify(offered));
  check('not her husband', !offered.includes('Ben Musoni'), JSON.stringify(offered));
}

section('a family that has entered no mitupo at all loses nothing');
// Nothing in the decision reads a totem, so there is nothing to lose.
{
  const fe = loadFrontend();
  const P = (n, s, b) => fe.addPerson(n, 'm', '', b, '');
  const gf = fe.addPerson('Chaitezvi Musoni', 'm', '', '1900', '');
  const son = fe.grow('child', gf, 'Sydney Musoni', 'm', '', { born:'1940' });
  const me = fe.grow('child', son, 'Hazvineyi Musoni', 'm', '', { born:'1979' });
  fe.setMe(me);
  const wife = fe.grow('partner', son, 'Evelyn Mandaba', 'f', '', { born:'1944' });
  const her = fe.addPerson('James Mandaba', 'm', '', '1910', '');
  fe.linkExisting('child', her, wife);
  fe.grow('child', her, 'Joseph Mandaba', 'm', '', { born:'1946' });

  const offered = fe.joinsIn();
  eq('one ring', offered.length, 1);
  eq('on the wife', (fe.getState().people[offered[0].id] || {}).name, 'Evelyn Mandaba');
  eq('and labelled by the only thing there is to label them by', offered[0].name, 'Mandaba');
}

report();
