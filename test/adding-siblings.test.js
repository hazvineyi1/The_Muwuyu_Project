// ADDING A BROTHER OR SISTER, AND WHERE THEY LAND.
//
// "It is confusing to add a name and it jumps to the far side of the screen
//  or tree. For example I am adding my paternal grandfather's siblings and
//  they are placed far away from their parents and other siblings."
//
// TWO FAULTS, and the first is the one that makes it look deliberate.
//
// A new brother or sister was put immediately BESIDE the anchor — before
// them or after them, by a Before/After control whose After was pressed by
// default. So a family typing "Baya Musoni, born 1898" as a brother of
// Chaitezvi, born 1900, and never touching a control they had no reason to
// touch, told the app the elder brother was the younger. The row is not
// decoration — Mukoma and Munin'ina are read off it — and everything below a
// person travels with their place in it. Baya was drawn past his brother's
// entire family, and the view followed him there. That is the jump.
//
// The second only shows once there are three or four of them. A brother
// coming in towards his parents is blocked by whichever brother stands
// between him and them, so the outermost cannot move until the ones inside
// him have. The rescue went furthest-first, found no room for the outermost,
// passed over him, and then brought the others in — leaving him stranded a
// thousand pixels out on his own.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* His tree as it stands before he starts: a grandfather with a family of his
   own below him, which is what makes a new sibling of that grandfather land
   past all of it. */
function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf  = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  fe.grow('partner', gf, 'Mai Musoni', 'f', 'Nzou', { born:'1905' });
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const unc = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });
  fe.grow('partner', unc, 'Daisy Marumahoko', 'f', 'Soko', { born:'1948' });
  fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const me  = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.grow('child', dad, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  fe.grow('child', dad, 'Tsitsi Musoni', 'f', 'Mwendamberi', { born:'1982' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, ggf, gf, dad };
}
const x = (t, id) => Math.round(t.fe.layoutOf().persons[id].x);
const kidsOf = (t, id) => {
  const st = t.fe.getState();
  const u = Object.values(st.unions).find(v => v.children.includes(id));
  return u ? u.children.map(c => st.people[c].name) : [];
};

section('A BIRTH YEAR PUTS THEM WHERE THAT YEAR BELONGS');
/* The control is not touched, which is the whole point: it is the case
   everybody is in, and it used to be the case that got it wrong. */
{
  const t = tree();
  t.fe.grow('sibling', t.gf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  eq('the elder brother goes first in the row',
     kidsOf(t, t.gf), ['Baya Musoni', 'Chaitezvi Musoni']);
}

section('and is drawn on the elder side of him');
{
  const t = tree();
  const baya = t.fe.grow('sibling', t.gf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  check('to his left, where the eldest stands',
        x(t, baya) < x(t, t.gf), JSON.stringify([x(t, baya), x(t, t.gf)]));
}

section('WHICHEVER ORDER THEY ARE REMEMBERED IN');
/* Families do not enter their elders oldest first. They remember the one who
   lives nearby, then the one whose birthday it was, then the eldest who died
   before the others were born. */
{
  for (const order of [['1898', '1902', '1906'], ['1906', '1898', '1902'],
                       ['1902', '1906', '1898']]){
    const t = tree();
    for (const y of order)
      t.fe.grow('sibling', t.gf, 'Born ' + y, 'm', 'Mwendamberi', { born:y });
    eq(`entered ${order.join(', ')} — the row still reads eldest first`,
       kidsOf(t, t.gf),
       ['Born 1898', 'Chaitezvi Musoni', 'Born 1902', 'Born 1906']);
  }
}

section('AND NONE OF THEM IS LEFT OUT ON THEIR OWN');
/* THE SECOND FAULT. Added one at a time, which is how a family does it, the
   fourth used to land a thousand pixels from the other three — blocked by
   the siblings between it and the parents, passed over, and then abandoned
   there when they came in without it. */
{
  const t = tree();
  const added = [['Baya Musoni', '1898'], ['Tsowhe Musoni', '1902'],
                 ['Nyasha Musoni', '1906']]
    .map(([n, y]) => t.fe.grow('sibling', t.gf, n, 'm', 'Mwendamberi', { born:y }));

  const far = added.filter(id => Math.abs(x(t, id) - x(t, t.gf)) > 700)
                   .map(id => t.fe.getState().people[id].name);
  eq('not one of them is out past his family', far, []);

  /* And the row itself is whole: the four of them and one wife, in birth
     order, with nobody else standing in the middle of it. */
  const L = t.fe.layoutOf();
  const y = Math.round(L.persons[t.gf].y);
  const row = Object.entries(L.persons)
    .filter(([, q]) => Math.round(q.y) === y)
    .sort((a, b) => a[1].x - b[1].x)
    .map(([id]) => t.fe.getState().people[id].name);
  eq('the whole row, in birth order, with only his wife among them',
     row, ['Baya Musoni', 'Chaitezvi Musoni', 'Mai Musoni',
           'Tsowhe Musoni', 'Nyasha Musoni']);
}

section('and adding one never pushes the ones already there further out');
/* Not "never moves": the first brother added on his own is the only one in
   his half of the row and the packing leaves him wide, and the moment a
   second arrives the rescue brings them BOTH in. Coming closer to the family
   is the fix working. What must never happen is the reverse — somebody
   already placed being shoved further away to make room for a newcomer,
   which is how a tree ends up feeling like it moves under you. */
{
  const t = tree();
  const baya = t.fe.grow('sibling', t.gf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const was = Math.abs(x(t, baya) - x(t, t.gf));
  t.fe.grow('sibling', t.gf, 'Tsowhe Musoni', 'f', 'Mwendamberi', { born:'1902' });
  const mid = Math.abs(x(t, baya) - x(t, t.gf));
  t.fe.grow('sibling', t.gf, 'Nyasha Musoni', 'm', 'Mwendamberi', { born:'1906' });
  const now = Math.abs(x(t, baya) - x(t, t.gf));
  check('he is no further from his brother than he started',
        mid <= was && now <= was, JSON.stringify({ was, mid, now }));
  check('and the two added after him are on his brother\u2019s other side',
        now < 300, String(now));
}

section('WITH NO YEAR, THE FAMILY’S OWN ANSWER DECIDES');
/* A person nobody has dated cannot be slotted into a row of years without
   inventing a claim, so the Before/After control is the only thing that can
   settle it — and it is still there, and still works. */
{
  const t = tree();
  t.fe.grow('sibling', t.gf, 'An elder sister', 'f', 'Mwendamberi',
            { position:'older' });
  eq('before him, because that is what was said',
     kidsOf(t, t.gf), ['An elder sister', 'Chaitezvi Musoni']);

  const u = tree();
  u.fe.grow('sibling', u.gf, 'A younger sister', 'f', 'Mwendamberi', {});
  eq('and after him when nothing is said',
     kidsOf(u, u.gf), ['Chaitezvi Musoni', 'A younger sister']);
}

section('and a year outranks a control nobody touched');
/* The control's After is pressed by default — it is what the form looks like
   before anybody has thought about it — so it cannot be allowed to overrule
   a year that was actually typed. */
{
  const t = tree();
  t.fe.grow('sibling', t.gf, 'Baya Musoni', 'm', 'Mwendamberi',
            { born:'1898', position:'younger' });
  eq('the year wins', kidsOf(t, t.gf), ['Baya Musoni', 'Chaitezvi Musoni']);
}

section('AND THE ORDER IS ACTUALLY SENT, which is where it was really lost');
/* THE THIRD FAULT, and the one that survived a green unit suite. Everything
   above is about the row the page builds. The page then saves, and reads the
   tree back — and the order that came back was the server's.
 *
 * A reorder was only sent when the children ALREADY RECORDED had changed
 * places among themselves, and a new brother inserted into the middle of a
 * row does not move any of them. So nothing was sent, addChild appended him
 * at the end, the next read brought that order back, and the elder brother
 * the family had just entered turned into the youngest in front of them.
 * Every seniority word in this app is read off that row. */
{
  const t = tree();
  const synced = JSON.parse(JSON.stringify(t.fe.getState()));
  const baya = t.fe.grow('sibling', t.gf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const ops = t.fe.diffOps(synced, t.fe.getState());

  const adds = ops.filter(o => o.op === 'addChild');
  eq('one child is added', adds.length, 1);
  const order = ops.filter(o => o.op === 'reorderChildren');
  eq('and the row he landed in is sent with him', order.length, 1);
  check('naming every child of it, eldest first',
        order[0].orderedIds.length === 2, JSON.stringify(order[0].orderedIds));
  check('with the new brother first, since he is the elder',
        String(order[0].orderedIds[0]).replace('$', '') === baya,
        JSON.stringify(order[0].orderedIds));
  check('and the reorder comes after the add, or it names somebody not there yet',
        ops.indexOf(order[0]) > ops.indexOf(adds[0]),
        JSON.stringify(ops.map(o => o.op)));
}

section('and a row that is already in the right order sends nothing extra');
/* The other half of it: a picture that sent a reorder on every single add
   would be writing a change log entry for nothing, on every name a family
   enters. The youngest brother appended to the end is exactly where the
   server would have put him. */
{
  const t = tree();
  const synced = JSON.parse(JSON.stringify(t.fe.getState()));
  t.fe.grow('sibling', t.gf, 'Nyasha Musoni', 'm', 'Mwendamberi', { born:'1906' });
  const ops = t.fe.diffOps(synced, t.fe.getState());
  eq('no reorder', ops.filter(o => o.op === 'reorderChildren').length, 0);
  eq('just the one addChild', ops.filter(o => o.op === 'addChild').length, 1);
}

section('THE FORM SAYS SO, rather than contradicting the year in silence');
{
  const t = tree();
  const html = t.fe.formHtml('sibling', t.gf);
  check('the control is offered', /id="fOrder"/.test(html), html.slice(0, 300));
  check('with a line saying when it is needed',
        /id="fOrderWhy"/.test(html), html.slice(0, 600));
}

section('AND THE SAME HOLDS FOR A CHILD AND FOR A WHOLE ROW');
/* grow('child') already went by the year. This is the regression guard that
   the sibling fix did not disturb it. */
{
  const t = tree();
  t.fe.grow('child', t.gf, 'A late child', 'm', 'Mwendamberi', { born:'1942' });
  eq('a child lands by year too',
     kidsOf(t, t.dad), ['Sydney Musoni', 'A late child', 'Terence Musoni']);
}

section('NOBODY IS LAID ON TOP OF ANYBODY AFTER ALL THAT');
{
  for (const shape of ['', 'muti']){
    const t = tree();
    t.fe.setShape(shape);
    for (const [n, y] of [['Baya Musoni', '1898'], ['Tsowhe Musoni', '1902'],
                          ['Nyasha Musoni', '1906'], ['Rudo Musoni', '1910']])
      t.fe.grow('sibling', t.gf, n, 'm', 'Mwendamberi', { born:y });
    const L = t.fe.layoutOf();
    const rows = new Map();
    for (const [id, q] of Object.entries(L.persons)){
      const yy = Math.round(q.y);
      (rows.get(yy) || rows.set(yy, []).get(yy)).push({ id, x:q.x });
    }
    let clash = null;
    for (const row of rows.values()){
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++)
        if (row[i].x - row[i - 1].x < 131.5)
          clash = t.fe.getState().people[row[i - 1].id].name + ' / ' +
                  t.fe.getState().people[row[i].id].name;
    }
    eq(`${shape || 'mudzi'}: every row is clear`, clash, null);
  }
}

report();
