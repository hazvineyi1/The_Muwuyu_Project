// MUDZI — the house line straight down the middle.
//
// "Make sure all family are aligned and on the same side, not across the
//  screen with no reasoning." ... "Change the layout."
//
// The old shape was a tidy-tree: every household centred over its children,
// packed left to right. It is a good way to fit a tree on a page and a bad
// way to read one, because where a person ends up says nothing about who
// they are — it says how much room the packing needed. The line of descent
// wanders, and a family looking for it has to trace every branch to find it.
//
// Mudzi fixes the line and lets everything else move. A household on the
// line stands over the child of it that is also on the line, so the descent
// shares one x from the oldest elder traced down to whoever is marked You.
// Then a person's place on the screen means something: on the line, or
// hanging off it at a named remove.
//
// WHAT IT MUST NOT COST, and this file is mostly about the costs:
//   - seniority. The eldest is still on the left. Straightening a line is a
//     convenience for the reader; birth order is a fact about the family.
//   - room. Nothing may be laid on top of anything else.
//   - the old shape. Muti is still there, one tap away in the Muwuyu panel.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* Four generations, with the line running through the MIDDLE child at one
   step and the ELDEST at another — because those are the two cases, and the
   second is the one that needs room on the left where there is none. */
function line(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const chai = P('Chaitezvi Musoni', 'm', 'Shumba', '1900');
  const mavhu = fe.grow('partner', chai, 'Mavhu Musoni', 'f', 'Nzou', { born:'1905' });
  const baya   = fe.grow('child', chai, 'Baya Musoni', 'm', 'Shumba', { born:'1925' });
  const thomas = fe.grow('child', chai, 'Thomas Musoni', 'm', 'Shumba', { born:'1927' });
  const rudo   = fe.grow('child', chai, 'Rudo Musoni', 'f', 'Shumba', { born:'1930' });
  const idah   = fe.grow('partner', thomas, 'Idah Musoni', 'f', 'Moyo', { born:'1931' });
  // Sydney is the ELDEST of his row, so the line runs down its left edge.
  const sydney = fe.grow('child', thomas, 'Sydney Musoni', 'm', 'Shumba', { born:'1940' });
  const netsai = fe.grow('child', thomas, 'Netsai Musoni', 'f', 'Shumba', { born:'1943' });
  const tendai = fe.grow('child', thomas, 'Tendai Musoni', 'm', 'Shumba', { born:'1946' });
  const evelyn = fe.grow('partner', sydney, 'Evelyn Musoni', 'f', 'Moyondizvo', { born:'1944' });
  const me     = fe.grow('child', sydney, 'Hazvineyi Musoni', 'm', 'Shumba', { born:'1979' });
  const tsitsi = fe.grow('child', sydney, 'Tsitsi Musoni', 'f', 'Shumba', { born:'1982' });
  fe.setMe(me);
  return { fe, chai, mavhu, baya, thomas, rudo, idah, sydney, netsai, tendai,
           evelyn, me, tsitsi };
}
const at = (fe, id) => fe.layoutOf().persons[id];
const xs = (fe, ids) => ids.map(id => Math.round(at(fe, id).x));

section('THE LINE IS STRAIGHT, TO THE PIXEL');
{
  const t = line();
  t.fe.setShape('');
  const down = xs(t.fe, [t.chai, t.thomas, t.sydney, t.me]);
  eq('four generations, one x', new Set(down).size, 1);

  /* MEASURED PERSON TO PERSON, not household to household. A household is a
     husband and a wife side by side; lining up their middles leaves the line
     stepping half a pod sideways at every generation, which is the wandering
     this shape exists to stop. The wives are NOT on the line, and that is
     what proves it was the men who were lined up. */
  const wives = xs(t.fe, [t.mavhu, t.idah, t.evelyn]);
  check('and the wives beside them are not on it',
        wives.every(x => x !== down[0]), JSON.stringify({ down, wives }));
}

section('INCLUDING WHERE THE LINE RUNS DOWN THE LEFT EDGE OF A ROW');
/* Sydney is the eldest of his brothers and sisters, so there is nobody to his
   left to borrow room from. The straightening cannot open a gap for him; it
   moves the household ABOVE him instead, and then shifts everything under it
   along so nothing lands on the family standing before. */
{
  const t = line();
  t.fe.setShape('');
  const kids = xs(t.fe, [t.sydney, t.netsai, t.tendai]);
  eq('he is still the leftmost of his row', Math.min(...kids), kids[0]);
  eq('and his father is still exactly over him',
     Math.round(at(t.fe, t.thomas).x), kids[0]);
}

section('SENIORITY SURVIVES IT, which is the thing worth protecting');
{
  const t = line();
  t.fe.setShape('');
  const row1 = xs(t.fe, [t.baya, t.thomas, t.rudo]);
  check('eldest to youngest, left to right', row1[0] < row1[1] && row1[1] < row1[2],
        JSON.stringify(row1));
  const row2 = xs(t.fe, [t.sydney, t.netsai, t.tendai]);
  check('and in the row below too', row2[0] < row2[1] && row2[1] < row2[2],
        JSON.stringify(row2));
  const row3 = xs(t.fe, [t.me, t.tsitsi]);
  check('and the youngest row', row3[0] < row3[1], JSON.stringify(row3));
}

section('NOBODY IS LAID ON TOP OF ANYBODY');
/* The straightening moves households sideways, which is exactly the move that
   causes an overlap if the room is not accounted for. This is the check that
   the accounting is right, and it is run on both shapes because a rule that
   only holds in one of them is a rule that will be broken by the other. */
for (const shape of ['', 'muti']){
  const t = line();
  t.fe.setShape(shape);
  const L = t.fe.layoutOf();
  const rows = new Map();
  for (const [id, q] of Object.entries(L.persons)){
    const y = Math.round(q.y);
    (rows.get(y) || rows.set(y, []).get(y)).push({ id, x:q.x });
  }
  let clash = null;
  for (const [y, row] of rows){
    row.sort((a, b) => a.x - b.x);
    for (let i = 1; i < row.length; i++){
      // 132 wide, so two people are clear of each other at 132 apart.
      if (row[i].x - row[i - 1].x < 131.5){
        clash = `y ${y}: ${row[i - 1].id} and ${row[i].id} are ` +
                `${Math.round(row[i].x - row[i - 1].x)} apart`;
      }
    }
  }
  eq(`${shape || 'mudzi'}: every row is clear`, clash, null);
}

section('AND MUTI IS STILL THERE, packing as it always did');
{
  const t = line();
  t.fe.setShape('muti');
  const down = xs(t.fe, [t.chai, t.thomas, t.sydney, t.me]);
  check('the line wanders again, which is what it used to do',
        new Set(down).size > 1, JSON.stringify(down));
  /* The point is not that Muti is wrong — it is that the two are different
     shapes of the same tree, and nobody loses the one they had. */
  t.fe.setShape('');
  eq('and switching back straightens it again',
     new Set(xs(t.fe, [t.chai, t.thomas, t.sydney, t.me])).size, 1);
}

section('AN UNKNOWN SHAPE IS NOT A BROKEN TREE');
{
  const t = line();
  t.fe.setShape('something the app has never heard of');
  eq('it falls back to the line', new Set(xs(t.fe, [t.chai, t.thomas, t.me])).size, 1);
}

section('WITH NOBODY MARKED YOU, THE LINE RUNS THROUGH THE ROOT');
/* A family filling in ancestors before saying who they are still gets a
   shape. Falling back to nothing would mean the tree looked different for
   the one person who has not answered a question yet. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('Chaitezvi', 'm', 'Shumba', '1900', '');
  const b = fe.grow('child', a, 'Thomas', 'm', 'Shumba', { born:'1927' });
  fe.grow('child', a, 'Baya', 'm', 'Shumba', { born:'1925' });
  const c = fe.grow('child', b, 'Sydney', 'm', 'Shumba', { born:'1940' });
  fe.setShape('');
  const L = fe.layoutOf();
  check('there is still a straight line to be seen',
        !!L.persons[a] && !!L.persons[c],
        JSON.stringify(Object.keys(L.persons).length));
  eq('and the root is over its own descent',
     Math.round(L.persons[a].x), Math.round(L.persons[b].x));
}

report();
