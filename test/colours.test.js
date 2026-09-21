// THE COLOURS, MEASURED RATHER THAN JUDGED.
//
// "Now do the colours."
//
// Contrast is computable, so this file computes it. Every palette this app
// ships — five of them, each with a light face and a dark one — is read
// straight out of the stylesheet and every pair of colours the page actually
// draws text with is measured against WCAG.
//
// TWO FAILURES WERE FOUND BY DOING THIS, and neither was visible to me:
//
//   2.96:1  the rank under a name (ELDEST), on every pod in the tree
//   3.71:1  the ROOT OF THE LINE badge, in all five dark faces
//
// Both are the smallest type in the app — nine and eight and a half pixels,
// uppercase, letter-spaced — which makes it worse rather than better.
//
// THE CAUSE IS WORTH MORE THAN THE FIX. The rank was painted --gold-soft,
// which is the app's soft EDGE: hover borders, a dashed outline, an
// underline. It was never a colour decision; it was a colour reached for
// because it was nearby. That is what naming colours after materials rather
// than jobs costs you — and --muted, which IS the job, already cleared the
// bar in all ten faces without a single value changing.
//
// This file exists so that the next palette cannot ship the same way.

const { check, eq, section, report } = require('./helpers');
const fs = require('fs');
const path = require('path');

const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8')
  .split('<style>')[1].split('</style>')[0];

/* Every :root block in the sheet, and the tokens it sets. Read from the
   shipped file rather than from a copy kept here, because a copy is a second
   truth that will quietly stop matching the first. */
function faces(){
  const blocks = [];
  const re = /(:root(?:\[[^\]]*\])*(?::not\(\[[^\]]*\]\))?)\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))){
    const vars = {};
    for (const v of m[2].matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9A-Fa-f]{3,8})/g)) vars['--' + v[1]] = v[2];
    if (Object.keys(vars).length) blocks.push({ sel:m[1], vars });
  }
  const nameOf = b => ({
    pal: (b.sel.match(/data-palette="([a-z]+)"/) || [, 'muwuyu'])[1],
    face: (/data-theme="dark"/.test(b.sel) ||
           /:not\(\[data-theme="light"\]\)/.test(b.sel)) ? 'dark' : 'light'
  });
  const base = { light:{}, dark:{} };
  for (const b of blocks){
    const n = nameOf(b);
    if (n.pal === 'muwuyu') Object.assign(base[n.face], b.vars);
  }
  const out = {};
  for (const b of blocks){
    const n = nameOf(b), k = n.pal + '/' + n.face;
    out[k] = Object.assign(out[k] || { ...base[n.face] }, b.vars);
  }
  return out;
}

const rgb = h => {
  const s = h.replace('#', '');
  const n = s.length === 3 ? s.split('').map(x => x + x).join('') : s;
  return [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16));
};
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const L = h => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => {
  const x = L(a), y = L(b), hi = Math.max(x, y), lo = Math.min(x, y);
  return (hi + 0.05) / (lo + 0.05);
};

/* Every pair the page draws TEXT with, and how big that text is. All of it
   is small — 8.5 to 13 pixels — so 4.5:1 is the bar for every one of them;
   none is anywhere near the 18.66px bold that would let it down to 3:1. */
const TEXT = [
  ['--ink',   '--pod',         'a name on a pod'],
  ['--muted', '--pod',         'the dates under a name'],
  ['--muted', '--pod',         'the rank under a name'],
  ['--muted', '--pod',         'the sex mark on a pod'],
  ['--muted', '--pod-hi',      'a note on a panel row'],
  ['--gold',  '--pod',         'a term on a card'],
  ['--ink',   '--pod-hi',      'a name on a highlighted row'],
  // The not-joined room names the match in gold on a highlighted row, and so
  // does the line saying who else has the tree open.
  ['--gold',  '--pod-hi',      'a name picked out on a highlighted row'],
  ['--muted', '--sky',         'the hint under the tree'],
  ['--ink',   '--sky',         'text on the canvas'],
  ['--sky',   '--gold',        'the label on a gold chip'],
  ['--sky',   '--leaf',        'the YOU badge'],
  ['--sky',   '--root-strong', 'the ROOT OF THE LINE badge']
];

section('EVERY WORD THIS APP DRAWS CAN BE READ, IN EVERY PALETTE');
{
  const all = faces();
  eq('ten palette faces are shipped', Object.keys(all).length, 10);

  const bad = [];
  for (const [k, v] of Object.entries(all))
    for (const [fg, bg, what] of TEXT){
      if (!v[fg] || !v[bg]) { bad.push(`${k}: ${what} — ${!v[fg] ? fg : bg} is not set`); continue; }
      const r = ratio(v[fg], v[bg]);
      if (r < 4.5) bad.push(`${r.toFixed(2)}:1  ${k}  ${what}  (${fg} on ${bg})`);
    }
  eq('not one pair falls below 4.5:1', bad, []);
}

section('AND THE TOKENS A TEXT COLOUR NEEDS ARE SET IN EVERY ONE OF THEM');
/* A face that forgets one inherits the base palette's value, which is a
   silent wrong colour rather than a visible missing one. */
{
  const all = faces();
  const missing = [];
  for (const [k, v] of Object.entries(all))
    for (const tok of ['--ink', '--muted', '--pod', '--pod-hi', '--sky', '--gold',
                       '--leaf', '--root-strong'])
      if (!v[tok]) missing.push(`${k} has no ${tok}`);
  eq('every face carries every one', missing, []);
}

section('THE SIX FAMILY TINTS ARE THE SIX THAT WERE MEASURED');
/* They tell two married-in families apart. Eight picked by eye failed three
   checks at once — three read as grey, and the worst adjacent pair was 4.0
   ΔE apart under protanopia and 10.7 under ordinary colour vision. These six
   cleared all of it. The stylesheet is the only place they exist, so the
   page cannot invent a seventh nobody checked. */
{
  const all = faces();
  const thin = [];
  for (const [k, v] of Object.entries(all)){
    const tints = [1, 2, 3, 4, 5, 6].map(n => v['--fam-' + n]);
    if (tints.some(t => !t)){ thin.push(`${k} is missing a tint`); continue; }
    // Against the pod they are drawn on: 3:1 is the bar for a mark rather
    // than for words, since the name beside it carries the meaning.
    for (const t of tints)
      if (ratio(t, v['--pod']) < 3) thin.push(`${k}: ${t} is ${ratio(t, v['--pod']).toFixed(2)}:1 on the pod`);
  }
  eq('all six are set and visible in every face', thin, []);
}

section('and no two of them are the same colour');
{
  const all = faces();
  const same = [];
  for (const [k, v] of Object.entries(all)){
    const tints = [1, 2, 3, 4, 5, 6].map(n => (v['--fam-' + n] || '').toUpperCase());
    if (new Set(tints).size !== 6) same.push(k + ': ' + tints.join(','));
  }
  eq('six distinct tints per face', same, []);
}

section('A COLOUR USED AS TEXT IS NEVER A COLOUR NAMED FOR AN EDGE');
/* The rule behind the fix, asserted so it holds. --gold-soft and --pod-edge
   are the app's edges — hover borders, dashed outlines, hairlines. The
   moment one of them is set as a `color:` it is being used for a job it was
   not measured for, which is exactly how the rank ended up at 2.96:1. */
{
  const EDGES = ['--gold-soft', '--pod-edge', '--bark-thin', '--horizon'];
  const bad = [];
  for (const m of css.matchAll(/(^|[;{\s])color\s*:\s*var\((--[a-z0-9-]+)\)/g))
    if (EDGES.includes(m[2])) bad.push(m[2]);
  eq('not one edge colour is set as text', [...new Set(bad)], []);
}

section('and the drawing colours stay out of the text too');
/* --root, --bark and --soil say what a root, a branch and the ground are
   drawn in. They are materials. The badge that needed one now has
   --root-strong, which was measured for carrying words. */
{
  const bad = [];
  for (const m of css.matchAll(/(^|[;{\s])color\s*:\s*var\((--[a-z0-9-]+)\)/g))
    if (['--root', '--soil', '--soil-deep'].includes(m[2])) bad.push(m[2]);
  eq('no material is set as text', [...new Set(bad)], []);
}

report();
