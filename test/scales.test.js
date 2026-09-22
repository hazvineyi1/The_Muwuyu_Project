// HOW BIG THE WORDS ARE, AND HOW MUCH ROOM IS LEFT AROUND THEM.
//
// "Redesign and build this using the best structure, color schemes, layout and
//  architectural genius... intuitive, cohesive and collaborative."
//
// Colour became a system: six tints measured against colour blindness, and a
// contrast audit that fails the build. Type and space never did.
//
// TYPE, BEFORE THIS: seventeen sizes between 8px and 18px across 124
// declarations, in half-pixel steps — 10 and 10.5, 11 and 11.5, 12 and 12.5,
// 13 and 13.5, 14 and 14.5. Half a pixel is below the size at which anybody
// can tell two things apart, so those pairs were not a hierarchy. They were
// the record of somebody nudging a number until a line stopped wrapping.
//
// SPACE, BEFORE THIS: every whole number from 1 to 13, plus 15, 16, 18, 22, a
// 6.5 and an 8.5, across more than two hundred declarations. Not a rhythm —
// two hundred separate decisions.
//
// Six type sizes and eight spacings now, and this file is what keeps them six
// and eight. It reads the shipped stylesheet, the same way the colour audit
// does, because a scale that lives in a comment is a suggestion.

const { check, eq, section, report } = require('./helpers');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
const css = html.split('<style>')[1] ? html.split('<style>')[1].split('</style>')[0] : html;

const TYPE  = ['--t-mark', '--t-note', '--t-read', '--t-act', '--t-name', '--t-head'];
const SPACE = [2, 4, 6, 8, 10, 12, 16, 24];

section('SIX TYPE SIZES, AND EVERY ONE OF THEM DOING A JOB');
{
  const declared = TYPE.filter(t => new RegExp(`\\${t}:\\s*[0-9.]+px`).test(css));
  eq('all six are set', declared, TYPE);
  const unused = TYPE.filter(t => !new RegExp(`var\\(\\${t}\\)`).test(css));
  eq('and every one is used — a step nobody needs is a step that will be misused',
     unused, []);
}

section('AND NOTHING IS SET IN A SIZE THAT IS NOT ONE OF THEM');
/* The rule that stops the seventeen coming back. */
{
  const loose = [];
  for (const m of css.matchAll(/font-size:\s*([^;}]+)/g)){
    const v = m[1].trim();
    if (/^var\(--t-(mark|note|read|act|name|head)\)$/.test(v)) continue;
    if (v === '0') continue;                       // the dot on a private pod
    if (/^clamp\(/.test(v)) continue;              // the welcome title, below
    loose.push(v);
  }
  eq('not one loose size', loose, []);
}

section('and the two that are not on the scale are named, not missed');
{
  /* A dot, not a word: .pod .shut is five pixels of background with a
     character inside it that must not be drawn. */
  check('the private-record dot is font-size:0 on purpose',
        /\.pod \.shut\{[^}]*font-size:0/.test(css), 'the dot has changed shape');
  /* Display type. It grows with the viewport because it is the first thing
     anybody sees and the only thing on that screen. */
  check('the welcome title is display type, and says so',
        /#seed h1\{[^}]*font-size:clamp\(/.test(css), 'the welcome title has changed');
}

section('THE LARGEST TYPE IN THE INTERFACE IS ONE SHONA WORD');
/* Not an accident of the scale — the scale agreeing with the project. The
   answer this app exists to give is what one person is to another, in the
   family's own word. */
{
  const uses = (css.match(/var\(--t-head\)/g) || []).length;
  eq('--t-head is used exactly once', uses, 1);
  check('and it is the kinship word on a card',
        /#form \.relline b\{[^}]*font-size:var\(--t-head\)/.test(css),
        'the largest type is no longer the word');
  const head = Number((css.match(/--t-head:\s*([0-9.]+)px/) || [])[1]);
  const name = Number((css.match(/--t-name:\s*([0-9.]+)px/) || [])[1]);
  check('bigger than anybody’s name', head > name, `${head} vs ${name}`);
}

section('EIGHT SPACINGS, AND NOTHING BETWEEN THEM');
{
  const loose = [];
  const props = /(?:^|[\s;{])((?:margin|padding)(?:-top|-bottom|-left|-right)?|(?:row-|column-)?gap):([^;}]*)/g;
  for (const m of css.matchAll(props)){
    for (const px of m[2].matchAll(/([0-9.]+)px/g)){
      const v = Number(px[1]);
      if (v === 0) continue;
      if (!SPACE.includes(v)) loose.push(`${m[1]}: ${px[0]}`);
    }
  }
  eq('every margin, padding and gap is one of the eight', [...new Set(loose)], []);
}

section('and the eight are a rhythm, not a list');
/* Two pixels apart where the interface does nearly all its spacing, then two
   larger steps for holding a panel off the edge of the screen. */
{
  const fine = SPACE.filter(v => v <= 12);
  const steps = fine.slice(1).map((v, i) => v - fine[i]);
  eq('an even two-pixel grid up to twelve', [...new Set(steps)], [2]);
  eq('and two larger ones above it', SPACE.filter(v => v > 12), [16, 24]);
  const declared = [];
  for (let i = 1; i <= 8; i++){
    const m = css.match(new RegExp(`--s-${i}:\\s*([0-9.]+)px`));
    if (m) declared.push(Number(m[1]));
  }
  eq('and the tokens say the same eight', declared, SPACE);
}

section('THE POD STILL FITS WHAT IS PUT IN IT');
/* The one place type and layout are tied together: POD_W is a number in the
   JavaScript, and the pod's own padding has to leave room inside it. */
{
  const podW = Number((html.match(/const POD_W\s*=\s*(\d+)/) || [])[1]);
  /* The .pod rule that draws one — not the .pod{transition:none} inside the
     reduced-motion block, which is also a .pod rule and comes first. */
  const rule = ([...css.matchAll(/\.pod\{[^}]*\}/g)]
    .map(m => m[0]).find(r => /width:/.test(r))) || '';
  const w = Number((rule.match(/width:(\d+)px/) || [])[1]);
  eq('the pod is drawn the width the layout reserves', w, podW);
  const pad = (rule.match(/padding:([^;]*)/) || [''])[1] || '';
  const nums = [...pad.matchAll(/([0-9.]+)px/g)].map(x => Number(x[1]));
  check('and its padding is on the scale like everything else',
        nums.length > 0 && nums.every(v => SPACE.includes(v)), pad);
}

report();
