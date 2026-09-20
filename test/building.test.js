// Working on one branch.
//
// "Give the option of saying start build and close build, so I can get a
// limited view of the branch I am growing... This does not break the build,
// it just makes it easier to build and grow."
//
// The important half of that sentence is the last one, and nearly everything
// asserted here is about it. Nothing is hidden from the app, only from the
// picture: every record, every marriage, and every word the engine can derive
// is still there and still true while a build is open. What narrows is the
// drawing, so that one branch can be worked on at the size of a thumb instead
// of the size of a grain of rice.
//
// WHY IT IS ONLY THE DRAWING. present() is the gate the whole app reads
// through, kinship included. Filter there and Babamukuru quietly becomes
// something else, because half the people the word depends on have gone. So
// the scope lives inside computeLayout and nowhere else — and the test that
// matters most is the one that asks a kinship question ACROSS the boundary
// while the build is open.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* A grandfather with two children. Ben's side is the branch; Tete's side is
   the rest of the family, and the two are joined at the top. */
function family(){
  const fe = loadFrontend();
  const gf = fe.addPerson('Sekuru', 'm', 'Nzou', '1900', '');
  const gm = fe.grow('partner', gf, 'Mbuya', 'f', 'Shava', { born:'1905' });
  const ben = fe.grow('child', gf, 'Ben', 'm', 'Nzou', { born:'1930' });
  const tete = fe.grow('child', gf, 'Tete', 'f', 'Nzou', { born:'1934' });
  const idah = fe.grow('partner', ben, 'Idah', 'f', 'Soko', { born:'1933' });
  const farai = fe.grow('child', ben, 'Farai', 'm', 'Nzou', { born:'1960' });
  const rudo = fe.grow('child', ben, 'Rudo', 'f', 'Nzou', { born:'1963' });
  const cousin = fe.grow('child', tete, 'Cousin', 'm', 'Moyo', { born:'1961' });
  const tanaka = fe.grow('child', farai, 'Tanaka', 'm', 'Nzou', { born:'1988' });
  return { fe, gf, gm, ben, tete, idah, farai, rudo, cousin, tanaka };
}
const drawn = fe => new Set(Object.keys(fe.layoutOf().persons));
const nameOf = (fe, id) => (fe.getState().people[id] || {}).name;

section('A BRANCH IS THE PERSON, EVERYBODY BELOW THEM, AND WHO MARRIED IN');
{
  const f = family();
  const b = f.fe.branchFrom(f.ben);
  for (const who of ['ben', 'farai', 'rudo', 'tanaka']){
    check(`${nameOf(f.fe, f[who])} is on it`, b.has(f[who]));
  }
  check('and so is the woman who married into it', b.has(f.idah));
  check('his sister is not', !b.has(f.tete));
  check('nor her child', !b.has(f.cousin));
}

section('and it says what it hangs from');
/* Without the parents a branch looks like a family that fell out of the sky,
   and "isolated" stops meaning "isolated for now" and starts meaning "cut
   off". They come alone — their other children stay outside. */
{
  const f = family();
  const b = f.fe.branchFrom(f.ben);
  check('his father comes', b.has(f.gf));
  check('and his mother', b.has(f.gm));
  check('but not their other daughter', !b.has(f.tete));
}

section('a spouse brings themselves and not their own people');
// Which is what keeps a branch a branch rather than the whole country.
{
  const f = family();
  const herFather = f.fe.addPerson('Idah father', 'm', 'Soko', '1905', '');
  f.fe.linkExisting('child', herFather, f.idah);
  const herSon = f.fe.grow('child', herFather, 'Her brother', 'm', 'Soko', { born:'1940' });
  const b = f.fe.branchFrom(f.ben);
  check('Idah is on the branch', b.has(f.idah));
  check('her father is not', !b.has(herFather));
  check('and neither is her brother', !b.has(herSon));
}

section('ONLY THE DRAWING NARROWS');
{
  const f = family();
  eq('everybody is drawn to begin with', drawn(f.fe).size, 9);
  f.fe.startBuild(f.ben);
  const on = drawn(f.fe);
  eq('and seven while building', on.size, 7);
  check('Tete has stepped out of the picture', !on.has(f.tete));
  eq('but she is still in the tree', f.fe.getState().people[f.tete].name, 'Tete');
  eq('and the tree still holds everybody', Object.keys(f.fe.getState().people).length, 9);
}

section('THE WORDS ARE STILL TRUE ACROSS THE EDGE OF THE BRANCH');
/* The assertion this whole design exists to satisfy. Tete is not on screen;
   Tanaka is. What she is to him must not have changed because of a view. */
{
  const f = family();
  const before = f.fe.kinTerms(f.tete, f.tanaka).list.map(t => t.term);
  f.fe.startBuild(f.ben);
  f.fe.layoutOf();
  const during = f.fe.kinTerms(f.tete, f.tanaka).list.map(t => t.term);
  eq('unchanged', during, before);
  check('and it is a real word, not an empty answer', during.length > 0, JSON.stringify(during));

  const back = f.fe.kinTerms(f.tanaka, f.tete).list.map(t => t.term);
  check('the way back is named too', back.length > 0, JSON.stringify(back));
}

section('and nothing is written down');
// A view is not an edit. If this ever syncs, it is a bug.
{
  const f = family();
  const synced = JSON.parse(JSON.stringify(f.fe.getState()));
  for (const p of Object.values(synced.people)) p.v = 1;
  f.fe.startBuild(f.ben);
  f.fe.layoutOf();
  eq('no ops at all', f.fe.diffOps(synced, f.fe.getState()).length, 0);
}

section('WHAT YOU ADD WHILE BUILDING APPEARS ON THE BRANCH');
// Otherwise the one thing the mode is for does not work.
{
  const f = family();
  f.fe.startBuild(f.ben);
  eq('seven to begin with', drawn(f.fe).size, 7);
  const baby = f.fe.grow('child', f.tanaka, 'New baby', 'f', 'Nzou', { born:'2015' });
  const on = drawn(f.fe);
  check('the new child is drawn straight away', on.has(baby), JSON.stringify([...on].length));
  eq('eight now', on.size, 8);
}

section('and adding somebody outside it does not drag them in');
{
  const f = family();
  f.fe.startBuild(f.ben);
  const outsider = f.fe.grow('child', f.tete, 'Another cousin', 'f', 'Moyo', { born:'1966' });
  check('they are recorded', !!f.fe.getState().people[outsider]);
  check('and not drawn', !drawn(f.fe).has(outsider));
}

section('somebody set aside inside a branch is still set aside');
// The two rules stack; neither one excuses the other.
{
  const f = family();
  f.fe.startBuild(f.ben);
  f.fe.setAside(f.rudo, 'entered twice');
  check('she is out of the picture', !drawn(f.fe).has(f.rudo));
  check('while her brother stays in it', drawn(f.fe).has(f.farai));
}

section('CLOSING THE BUILD BRINGS EVERYBODY BACK');
{
  const f = family();
  const before = JSON.stringify(f.fe.layoutOf().persons);
  f.fe.startBuild(f.ben);
  eq('narrowed', drawn(f.fe).size, 7);
  f.fe.closeBuild();
  eq('and the picture is exactly the one it was', JSON.stringify(f.fe.layoutOf().persons), before);
}

section('a build cannot be started on nobody');
{
  const f = family();
  check('not on a name that is not there', f.fe.startBuild('nobody') === false);
  f.fe.closeBuild();
  f.fe.setAside(f.ben, 'x');
  check('nor on somebody set aside', f.fe.startBuild(f.ben) === false);
}

section('and the branch is drawn as carefully as the whole tree is');
{
  const f = family();
  f.fe.startBuild(f.ben);
  const L = f.fe.layoutOf();
  const rows = {};
  for (const [id, q] of Object.entries(L.persons)) (rows[q.y] = rows[q.y] || []).push(q.x);
  let overlaps = 0;
  for (const y of Object.keys(rows)){
    const r = rows[y].sort((a, b) => a - b);
    for (let i = 1; i < r.length; i++) if (r[i] - r[i-1] < 131.5) overlaps++;
  }
  eq('nobody stands on anybody', overlaps, 0);
  eq('and it draws the same twice', JSON.stringify(f.fe.layoutOf().persons),
                                    JSON.stringify(f.fe.layoutOf().persons));
}

report();
