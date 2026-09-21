// STRAIGHT LINES.
//
// "Change the layout completely to straight lines."
//
// The branches were curves — a cubic leaving the marriage going straight up
// and arriving at the child going straight up, so a fork had the spring of a
// real branch rather than the look of a wire. It is the prettier line and it
// is the worse one to read, for one reason: a curve has no direction you can
// follow with your eye. Two of them crossing look like one line bending, and
// on a tree where a household's parents stand a long way off, following a
// curve across half a canvas of other curves is guesswork.
//
// Three segments now, all square: up out of the marriage, across at one
// height, up into the child. The crossbar is the useful part — every child
// of one marriage leaves from the same point and turns at the same height,
// so their verticals hang off ONE horizontal and a family reads as a family
// instead of as a handful of lines that happen to converge.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf  = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const gBro = fe.grow('child', ggf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const gm  = fe.grow('partner', gf, 'Mai Shava', 'f', 'Shava', { born:'1905' });
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const aunt = fe.grow('child', gf, 'Netsai Musoni', 'f', 'Mwendamberi', { born:'1943' });
  const unc = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });
  const mum = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const me  = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  const sis = fe.grow('child', dad, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, ggf, gf, gBro, gm, dad, aunt, unc, mum, sis };
}
const links = t => t.fe.layoutOf().links.filter(l => l.kind === 'branch');
const paths = t => links(t).map(l => t.fe.branchPath(l));

section('NOT ONE CURVE IS LEFT IN THE TREE');
/* Asserted on the path data rather than on the source, because the source
   can gain a second way of drawing a line and this suite would never know. */
{
  const t = tree();
  const all = paths(t);
  check('there are branches to check', all.length >= 6, String(all.length));
  const curved = all.filter(d => /[CcSsQqTtAa]/.test(d));
  eq('none of them is drawn with a curve', curved, []);
  check('every one is moves and lines and nothing else',
        all.every(d => /^M[-\d. ]+(L[-\d. ]+)+$/.test(d)), JSON.stringify(all[0]));
}

section('AND EVERY SEGMENT IS EITHER UPRIGHT OR LEVEL');
/* A "straight line" that runs diagonally from a marriage to a child is still
   a straight line and still the thing being complained about: it crosses
   everything between the two rows at an angle nobody can follow. */
{
  const t = tree();
  let slanted = null;
  for (const d of paths(t)){
    const pts = d.slice(1).split('L').map(s => s.trim().split(/\s+/).map(Number));
    for (let i = 1; i < pts.length; i++){
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      if (Math.abs(x1 - x2) > 0.5 && Math.abs(y1 - y2) > 0.5) slanted = d;
    }
  }
  eq('nothing runs at an angle', slanted, null);
}

section('A CHILD STANDING OVER THE MARRIAGE GETS ONE UNBROKEN VERTICAL');
/* THE CASE WORTH GETTING RIGHT. On this shape the whole line of descent
   stands over itself, every generation of it, so the mudzi is now literally
   a single straight line from the oldest elder to whoever is marked You —
   with no corner anywhere in it. A crossbar there would be a kink in the one
   thing the shape exists to keep straight. */
{
  const t = tree();
  const spine = links(t).filter(l => Math.abs(l.x1 - l.x2) < 0.5);
  check('there is at least one such line', spine.length >= 1, String(spine.length));
  for (const l of spine){
    const d = t.fe.branchPath(l);
    eq('two points, one line', d.split('L').length, 2);
    check('and both at the same x', /^M([-\d.]+) [-\d.]+L\1 /.test(d), d);
  }
}

section('and the line of descent never steps further than half a household');
/* THE ONE PLACE A KINK CAN SURVIVE, and the size of it is the whole of the
   answer. A branch leaves from the MARRIAGE, which is the point between two
   people, while the shape lines up the PEOPLE on the line — measured person
   to person on purpose, because lining up the households instead leaves the
   line stepping half a pod sideways at every generation. So the stem drops
   from between the couple and steps across to the child: at most half a pod
   and a gap, once, and never the wander this shape exists to stop. */
{
  const t = tree();
  const line = [t.ggf, t.gf, t.dad, t.me];
  const steps = links(t)
    .filter(l => line.includes(l.child))
    .map(l => Math.abs(l.x2 - l.x1));
  check('every one of them is drawn', steps.length >= 3, String(steps.length));
  const most = Math.max(...steps);
  check('and none steps further than half a household across',
        most <= (132 + 30) / 2 + 0.5, JSON.stringify(steps.map(Math.round)));
}

section('BROTHERS AND SISTERS HANG OFF ONE SHARED CROSSBAR');
/* The reason for the shape. Three children of one marriage leave it from the
   same point and turn at the same height, so what the eye sees is one
   horizontal with three drops off it — a family — rather than three separate
   lines that happen to meet. */
{
  const t = tree();
  const kids = [t.dad, t.aunt, t.unc];
  const theirs = links(t).filter(l => kids.includes(l.child));
  eq('all three are drawn', theirs.length, 3);
  const bars = theirs.map(l => {
    const pts = t.fe.branchPath(l).slice(1).split('L').map(s => s.trim().split(/\s+/).map(Number));
    return pts.length === 4 ? Math.round(pts[1][1]) : null;
  });
  check('every one of them turns at the same height',
        new Set(bars.filter(v => v !== null)).size === 1, JSON.stringify(bars));
  const starts = theirs.map(l => Math.round(l.x1));
  eq('and they all leave the marriage from one point', new Set(starts).size, 1);
}

section('and the bar sits nearer the children than the parents');
/* So it reads as belonging to the row it gathers, rather than floating in
   the middle of the gap where it could be either row's. */
{
  const t = tree();
  const l = links(t).find(x => x.child === t.aunt);
  const pts = t.fe.branchPath(l).slice(1).split('L').map(s => s.trim().split(/\s+/).map(Number));
  const bar = pts[1][1];
  const toChild = Math.abs(bar - l.y2), toParent = Math.abs(bar - l.y1);
  check('closer to the children', toChild < toParent,
        JSON.stringify({ toChild:Math.round(toChild), toParent:Math.round(toParent) }));
  check('and clear of the pods it runs under', toChild > 46,
        String(Math.round(toChild)));
}

section('AND TWO FAMILIES NEVER SHARE ONE CROSSBAR');
/* THE COST OF THE SHARED BAR, and the fix for it. Every child of a marriage
   turning at the same height is what makes them read as one family — and it
   makes two DIFFERENT families in the same gap turn at that height too.
   Where one family's children have been split apart by a marriage its bar
   runs the width of the canvas, straight through the other's, and the two
   are drawn as one line joining four people who are nothing to each other.
   Measured on the tree below before the lanes went in: two bars overlapping
   for two hundred pixels. */
{
  const fe = loadFrontend();
  const P = (n, sx, tt, b) => fe.addPerson(n, sx, tt, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf  = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  fe.grow('child', ggf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const gm  = fe.grow('partner', gf, 'Mai Shava', 'f', 'Shava', { born:'1905' });
  const gmDad = P('Shava Elder', 'm', 'Shava', '1875');
  fe.linkExisting('child', gmDad, gm);
  fe.grow('child', gmDad, 'Ruth Shava', 'f', 'Shava', { born:'1910' });
  fe.grow('child', gmDad, 'Tendai Shava', 'm', 'Shava', { born:'1912' });
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  fe.grow('child', gf, 'Netsai Musoni', 'f', 'Mwendamberi', { born:'1943' });
  const unc = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });
  fe.grow('partner', unc, 'Daisy Marumahoko', 'f', 'Soko', { born:'1948' });
  const mum = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const mgf = P('James Mandaba', 'm', 'Moyondizvo', '1925');
  fe.linkExisting('child', mgf, mum);
  fe.grow('child', mgf, 'Joseph Mandaba', 'm', 'Moyondizvo', { born:'1956' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me); fe.setShape('');

  const st = fe.getState();
  const bars = [];
  for (const l of fe.layoutOf().links){
    if (l.kind !== 'branch') continue;
    const pts = fe.branchPath(l).slice(1).split('L').map(z => z.trim().split(/\s+/).map(Number));
    if (pts.length !== 4) continue;
    const u = Object.values(st.unions).find(x => x.children.includes(l.child));
    bars.push({ y:Math.round(pts[1][1]),
                lo:Math.round(Math.min(pts[1][0], pts[2][0])),
                hi:Math.round(Math.max(pts[1][0], pts[2][0])),
                fam: u ? u.id : '?' });
  }
  check('there are crossbars to check', bars.length >= 6, String(bars.length));
  check('one family\u2019s children really are split across another\u2019s',
        bars.some(b => b.hi - b.lo > 600), JSON.stringify(bars.map(b => b.hi - b.lo)));

  let merged = null;
  for (let i = 0; i < bars.length; i++)
    for (let j = i + 1; j < bars.length; j++){
      const a = bars[i], b = bars[j];
      if (a.y !== b.y || a.fam === b.fam) continue;
      if (a.hi + 40 > b.lo && b.hi + 40 > a.lo) merged = `${a.lo}-${a.hi} / ${b.lo}-${b.hi} at y ${a.y}`;
    }
  eq('and still no two of them are drawn as one line', merged, null);

  /* A family that overlaps nothing keeps the height nearest its children, so
     the ordinary tree is not rearranged to pay for the difficult one. */
  const ys = new Set(bars.map(b => b.y));
  check('and the lanes are only used where they are needed',
        ys.size <= 6, JSON.stringify([...ys].sort((a, b) => a - b)));
}

section('A MARRIAGE REACHING PAST SOMEBODY STEPS ROUND THEM SQUARELY TOO');
/* The one other curve in the picture: a husband and a wife with a second
   marriage standing between them were tied by a bow under the row. */
{
  const t = tree();
  const fe = t.fe;
  fe.grow('partner', t.gf, 'A second wife', 'f', 'Nzou', { born:'1915' });
  fe.grow('partner', t.gf, 'A third wife', 'f', 'Soko', { born:'1920' });
  const reach = fe.layoutOf().links.filter(l => l.kind === 'bond' && l.reach);
  check('a third marriage makes a tie that has to reach past somebody',
        reach.length >= 1, String(reach.length));
  /* Read off the drawn svg rather than a helper, because the bond path is
     built inside draw() and a helper would be testing a second copy of it. */
  const svg = fe.treeSvg();
  const bonds = svg.match(/<path class="bond[^"]*" d="([^"]*)"/g) || [];
  check('every tie is drawn', bonds.length >= 2, String(bonds.length));
  check('and not one of them with a curve',
        !bonds.some(b => /[CcSsQqTtAa]/.test(b.split('d="')[1])),
        bonds.join(' | '));
  const reached = bonds.filter(b => /class="bond reach"/.test(b));
  check('the one that reaches steps down and back squarely',
        reached.every(b => (b.split('d="')[1].match(/L/g) || []).length === 3),
        reached.join(' | '));
}

section('THE PICTURE IS STILL A TREE, not a pile of disconnected lines');
/* Changing how a line is drawn must not change what it joins. Every branch
   still runs from a marriage to a child, and still carries both of them so a
   tap on it can say what they are to each other. */
{
  const t = tree();
  const bad = links(t).filter(l => !l.child || !l.parents || !l.parents.length);
  eq('every branch still knows who it joins', bad.length, 0);
  const d = t.fe.branchPath(links(t)[0]);
  check('and a path still starts where the marriage is',
        d.startsWith('M' + links(t)[0].x1 + ' '), d);
}

section('AND A LINE TO NOWHERE IS STILL DRAWN');
/* A household whose parents nobody has named hangs off an empty socket. It
   is a dashed line and it still has to arrive somewhere. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('One brother', 'm', 'Shumba', '1940', '');
  const b = fe.grow('sibling', a, 'Another brother', 'm', 'Shumba', { born:'1943' });
  fe.setMe(a);
  fe.setShape('');
  const unknown = fe.layoutOf().links.filter(l => l.unknown);
  check('there is one', unknown.length >= 1, String(unknown.length));
  for (const l of unknown){
    const d = fe.branchPath(l);
    check('drawn square like the rest', !/[CcSsQqTtAa]/.test(d), d);
  }
}

report();
