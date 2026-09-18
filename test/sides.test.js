// Which side people stand on.
//
// THE COMPLAINT THIS FILE IS ABOUT, in the family's own words: "the tree
// should grow from the proper side, some additions are on the other side."
//
// That is one bug wearing three coats. A row of people was ordered by which
// end the marriage-walk happened to start at; a top-level family was placed
// where the diary put it; and a new child was always appended to the young
// end of the row whatever year they were born. All three made the picture
// depend on the order things were TYPED rather than on who the people are.
//
// So the test that matters is not "is Baba on the left". It is: enter the
// same family two different ways and get the same picture. Everything below
// is a version of that.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const names = (fe, ids) => ids.map(i => (fe.getState().people[i] || {}).name || '?');

(async () => {

// ── the same family, entered two ways ──────────────────────────────────────
section('A HUSBAND ADDED TO A WIFE STANDS WHERE A WIFE ADDED TO A HUSBAND DOES');
/* The original fault, at its smallest. Two marriages, identical in every way
   except which of the two people was entered first. They used to come out
   facing opposite ways. */
{
  const a = loadFrontend();
  const hA = a.addPerson('Tonderai Musoni', 'm', 'Mwendamberi', '1970', '');
  const wA = a.grow('partner', hA, 'Rudo Nyoni', 'f', 'Nzou', { born:'1972' });

  const b = loadFrontend();
  const wB = b.addPerson('Rudo Nyoni', 'f', 'Nzou', '1972', '');
  const hB = b.grow('partner', wB, 'Tonderai Musoni', 'm', 'Mwendamberi', { born:'1970' });

  eq('entered husband first', names(a, a.rowOf(hA)), ['Tonderai Musoni', 'Rudo Nyoni']);
  eq('entered wife first', names(b, b.rowOf(wB)), ['Tonderai Musoni', 'Rudo Nyoni']);
}

section('and the rule that decides it is the line, not the sex');
/* Sex is the LAST thing consulted and only when nothing else separates two
   people. What actually decides is whose parents are in this tree: descent
   runs through them, so they stand next to their own parents and the branch
   between stays short. Put the spouse there instead and the line has to reach
   across a stranger to find its child. */
{
  const fe = loadFrontend();
  const gran = fe.addPerson('Sekuru Musoni', 'm', 'Mwendamberi', '1940', '');
  // The daughter is the blood member here, and her husband married in.
  const dau = fe.grow('child', gran, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  const hub = fe.grow('partner', dau, 'Farai Nyoni', 'm', 'Nzou', { born:'1973' });

  eq('the daughter stands on her father\'s side, the husband outside',
     names(fe, fe.rowOf(dau)), ['Bertha Musoni', 'Farai Nyoni']);
  check('even though he is the older of the two, and a man',
        fe.seniorSide(dau, hub) < 0,
        `seniorSide(daughter, husband) = ${fe.seniorSide(dau, hub)}`);
}

// ── children ───────────────────────────────────────────────────────────────
section('A CHILD LANDS AT THEIR AGE, NOT AT THE END OF THE QUEUE');
/* Families do not enter their children oldest first. Every one of these used
   to be appended to the young end, so the row — which is what Mukoma and
   Munin'ina are read off — said the opposite of the truth. */
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  fe.grow('child', baba, 'Middle', 'm', 'Mwendamberi', { born:'1970' });
  fe.grow('child', baba, 'Youngest', 'f', 'Mwendamberi', { born:'1980' });
  fe.grow('child', baba, 'Eldest', 'm', 'Mwendamberi', { born:'1965' });   // remembered last

  const kids = Object.values(fe.getState().unions)[0].children;
  eq('the row is in birth order however it was typed',
     names(fe, kids), ['Eldest', 'Middle', 'Youngest']);
}

section('a child with no year is added at the end, and nowhere else');
/* Deliberate. The row IS the family's statement of seniority when there are
   no dates — olderThan falls back on it — so dropping an undated person into
   the middle would invent a claim nobody made. The end asserts nothing. */
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  fe.grow('child', baba, 'Eldest', 'm', 'Mwendamberi', { born:'1965' });
  fe.grow('child', baba, 'Youngest', 'f', 'Mwendamberi', { born:'1980' });
  fe.grow('child', baba, 'No year known', 'f', 'Mwendamberi', {});

  const kids = Object.values(fe.getState().unions)[0].children;
  eq('appended, not guessed at',
     names(fe, kids), ['Eldest', 'Youngest', 'No year known']);
}

section('and the arrows still move anybody, because the family outranks the dates');
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  const first = fe.grow('child', baba, 'A', 'm', 'Mwendamberi', { born:'1965' });
  const second = fe.grow('child', baba, 'B', 'm', 'Mwendamberi', { born:'1970' });
  fe.reorder(second, -1);
  eq('hand-ordering wins', names(fe, Object.values(fe.getState().unions)[0].children), ['B', 'A']);
}

// ── whole families ─────────────────────────────────────────────────────────
section('A GRANDFATHER ADDED TODAY DOES NOT LAND TO THE RIGHT OF HIS GRANDSON');
/* Top-level families were laid out in the order their people were entered.
   Trace a line one generation deeper and the new elder appeared at the far
   right of everything, which is the single most visible form of "it grew from
   the wrong side". */
{
  const fe = loadFrontend();
  const young = fe.addPerson('Grandson', 'm', 'Mwendamberi', '2000', '');
  // A second, unconnected household entered afterwards.
  const elder = fe.addPerson('An elder', 'm', 'Shava', '1930', '');

  const L = fe.layoutOf();
  check('the elder generation is placed first, left of the younger',
        L.persons[elder].x < L.persons[young].x,
        JSON.stringify({ elder:L.persons[elder].x, young:L.persons[young].x }));
}

// ── the property all of the above is really about ──────────────────────────
section('THE SAME FAMILY ENTERED BACKWARDS DRAWS THE SAME PICTURE');
/* The one that would catch a regression in any of the three rules at once.
   Build a household top-down, then build it bottom-up, and compare the rows. */
{
  const down = loadFrontend();
  {
    const f = down.addPerson('Sydney', 'm', 'Mwendamberi', '1940', '');
    const m = down.grow('partner', f, 'Evelyn', 'f', 'Shava', { born:'1945' });
    down.grow('child', f, 'Tonderai', 'm', 'Mwendamberi', { born:'1968' });
    down.grow('child', f, 'Bertha', 'f', 'Mwendamberi', { born:'1972' });
  }

  const up = loadFrontend();
  {
    const kid = up.addPerson('Bertha', 'f', 'Mwendamberi', '1972', '');
    up.grow('sibling', kid, 'Tonderai', 'm', 'Mwendamberi', { born:'1968', position:'older' });
    const f = up.grow('parent', kid, 'Sydney', 'm', 'Mwendamberi', { born:'1940' });
    up.grow('parent', kid, 'Evelyn', 'f', 'Shava', { born:'1945' });
  }

  const rowOfName = (fe, nm) => {
    const id = Object.keys(fe.getState().people)
      .find(k => fe.getState().people[k].name === nm);
    return names(fe, fe.rowOf(id));
  };
  eq('the parents read the same way', rowOfName(down, 'Sydney'), rowOfName(up, 'Sydney'));
  eq('and so do the children', rowOfName(down, 'Bertha'), rowOfName(up, 'Bertha'));
  eq('with the elder brother first', rowOfName(down, 'Bertha'), ['Tonderai', 'Bertha']);
}

section('drawing the same tree twice never moves anybody');
// The cheapest possible guard against an unstable comparator, which would
// show up as a tree that reshuffles every time it repaints.
{
  const fe = loadFrontend();
  const f = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  fe.grow('partner', f, 'Amai', 'f', 'Shava', { born:'1944' });
  fe.grow('child', f, 'One', 'm', 'Mwendamberi', { born:'1970' });
  fe.grow('child', f, 'Two', 'f', 'Mwendamberi', { born:'1974' });
  const once = JSON.stringify(fe.layoutOf().persons);
  const twice = JSON.stringify(fe.layoutOf().persons);
  eq('identical', once, twice);
}

report();
})();
