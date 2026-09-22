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

// ── and how far off the page things are ───────────────────────────────────
//
// Elevation is one idea wearing two clothes: how much shadow a thing casts,
// and what it therefore covers. They have to move together, or the screen says
// one thing with light and another with stacking.
//
// BEFORE THIS: eight stacking values — 2, 3, 45, 46, 50, 60, 78, 80 — with 45
// and 46 a pair and 78 and 80 a pair, which is the same "nudge it until it
// works" signature the type sizes had. Nothing said which layer anything
// belonged to, so every new thing picked its number off whatever was nearby.

const BANDS = ['--z-veil', '--z-pods', '--z-buds', '--z-frame',
               '--z-over', '--z-panel', '--z-said', '--z-state'];
const bandOf = t => Number((css.match(new RegExp(`\\${t}:\\s*(\\d+)`)) || [])[1]);

section('EIGHT BANDS, AND NOTHING STACKED OUTSIDE THEM');
{
  const loose = [];
  for (const m of css.matchAll(/z-index:\s*([^;}]+)/g)){
    const v = m[1].trim();
    if (!/^var\(--z-[a-z]+\)$/.test(v)) loose.push(v);
  }
  eq('not one bare number', loose, []);
  const missing = BANDS.filter(b => !Number.isFinite(bandOf(b)));
  eq('every band is declared', missing, []);
  const unused = BANDS.filter(b => !new RegExp(`var\\(\\${b}\\)`).test(css));
  eq('and every band is used', unused, []);
}

section('AND THE ORDER IS THE DESIGN, NOT AN ACCIDENT');
/* These are the sentences the screen has to keep true. Each one was a pair of
   arbitrary numbers before, and any of them could have been inverted by
   somebody picking a number off a neighbour. */
{
  const above = (a, b, what) =>
    check(what, bandOf(a) > bandOf(b), `${a}=${bandOf(a)} vs ${b}=${bandOf(b)}`);
  above('--z-pods', '--z-veil',
        'the people stand above the vignette, not under it');
  above('--z-buds', '--z-pods',
        'and the ways to grow stand around them, above');
  above('--z-over', '--z-frame',
        'the welcome screen covers the toolbar');
  above('--z-panel', '--z-over',
        'a panel covers the welcome screen it was opened from');
  above('--z-said', '--z-panel',
        'what somebody else did is seen over an open panel');
  above('--z-state', '--z-said',
        'and what the app says about its own saving is over everything');
}

section('and the bands leave room to put something between two of them');
{
  const screen = ['--z-frame', '--z-over', '--z-panel', '--z-said', '--z-state'];
  const steps = screen.slice(1).map((b, i) => bandOf(b) - bandOf(screen[i]));
  eq('ten apart, all the way up', [...new Set(steps)], [10]);
}

section('THE VIGNETTE IS UNDER THE PEOPLE');
/* It was not. #stage::after was z-index 2 and #pods had none at all, so a
   decoration meant to darken the canvas was painted over every person on it —
   a tenth of black in daylight and forty-two per cent at night, across the
   names nearest the edge of the screen. */
{
  check('the vignette is on the veil band',
        /#stage::after\{[^}]*z-index:var\(--z-veil\)/.test(css), 'the vignette moved');
  check('and the people have a band of their own, above it',
        /#pods\{[^}]*z-index:var\(--z-pods\)/.test(css), '#pods has no band');
}

section('LIGHT AGREES WITH STACKING');
/* Two depths and one rule: a thing that sits ON the page casts --shadow, a
   thing that has come OFF it casts --lift. The two banners are the highest
   things on the screen and were casting the shallowest shadow on it. */
{
  const shadowOf = sel => {
    const rule = ([...css.matchAll(new RegExp(`\\${sel}\\{[^}]*\\}`, 'g'))]
      .map(m => m[0]).find(r => /box-shadow/.test(r))) || '';
    return (rule.match(/box-shadow:var\((--[a-z]+)\)/) || [])[1] || null;
  };
  eq('a panel has come off the page', shadowOf('#form'), '--lift');
  eq('and so has what somebody else did', shadowOf('#others'), '--lift');
  eq('and so has the connection banner', shadowOf('#stalled'), '--lift');
  eq('while the toolbar sits on it', shadowOf('#bar'), '--shadow');
  /* Two depths, and a third would mean two of them doing the same job. */
  const depths = new Set([...css.matchAll(/box-shadow:var\((--[a-z]+)\)/g)].map(m => m[1]));
  eq('two depths and no more', [...depths].sort(), ['--lift', '--shadow']);
}

// ── and how long things take to get there ─────────────────────────────────
//
// BEFORE THIS: seven durations — .15, .18, .2, .24, .25, .45, .55 — several a
// hundredth of a second apart, which nobody has ever perceived. The same
// nudged-until-it-looked-right numbers as the type sizes.
//
// AND THE MOTION WAS THE WRONG WAY ROUND. The smallest change on the screen, a
// shadow under a pointer, was eased over 180ms; the largest, the view jumping
// across the whole tree to somebody you tapped, happened between one frame and
// the next with nothing to follow. A hover needs no explaining. A journey does.

const DUR  = ['--m-tap', '--m-in', '--m-far', '--m-draw'];
const EASE = ['--ease', '--ease-move', '--ease-pop'];
const msOf = t => Number((css.match(new RegExp(`\\${t}:\\s*(\\d+)ms`)) || [])[1]);

section('FOUR DURATIONS, AND EACH ONE A DIFFERENT KIND OF MOVEMENT');
{
  const missing = DUR.filter(t => !Number.isFinite(msOf(t)));
  eq('all four are set, in milliseconds', missing, []);
  /* --ease-move is the exception and is meant to be: nothing in CSS travels,
     so the camera is its only user. It is DECLARED here because this is where
     the curve is defined, and read from here by the page. */
  const unused = DUR.concat(EASE)
    .filter(t => t !== '--ease-move')
    .filter(t => !new RegExp(`var\\(\\${t}\\)`).test(css));
  eq('and every one of them is used by a rule', unused, []);
  check('and the one that is not is read by the page instead',
        /cssBezier\('--ease-move'/.test(html), 'nothing reads --ease-move');
  const order = DUR.map(msOf);
  eq('they go up, and no two are the same',
     order, [...new Set(order)].sort((a, b) => a - b));
  /* A hundredth of a second apart is not a step. */
  const gaps = order.slice(1).map((v, i) => v / order[i]);
  check('and each is far enough from the last to be a different speed',
        gaps.every(g => g >= 1.15), JSON.stringify(order));
}

section('AND NOTHING MOVES ON A NUMBER THAT IS NOT ONE OF THEM');
{
  const loose = [];
  for (const m of css.matchAll(/(?:transition|animation):([^;}]+)/g)){
    const v = m[1].trim();
    if (v === 'none') continue;
    /* The tokens out first — var(--ease) contains the word "ease". */
    const bare = v.replace(/var\(--[a-z-]+\)/g, '');
    for (const t of bare.matchAll(/(\d*\.?\d+)(m?s)\b/g)) loose.push(t[0]);
    for (const e of bare.matchAll(/cubic-bezier\([^)]*\)|ease-in-out|ease-out|ease-in|\bease\b/g))
      loose.push(e[0]);
  }
  eq('every duration and every curve is a token', [...new Set(loose)], []);
}

section('THREE CURVES, AND THE OVERSHOOT IS ONLY FOR A NEW PERSON');
/* A spring is a delight once and a tic on everything. */
{
  const pop = (css.match(/--ease-pop:\s*(cubic-bezier\([^)]*\))/) || [])[1] || '';
  const y1 = Number((pop.match(/cubic-bezier\([^,]*,\s*([-0-9.]+)/) || [])[1]);
  check('the pop curve overshoots', y1 > 1, pop);
  const uses = (css.match(/var\(--ease-pop\)/g) || []).length;
  eq('and exactly one thing uses it', uses, 1);
  check('and that thing is a new person landing',
        /animation:pop var\(--m-far\) var\(--ease-pop\)/.test(css), 'the pop moved');
  for (const t of ['--ease', '--ease-move']){
    const c = (css.match(new RegExp(`\\${t}:\\s*(cubic-bezier\\([^)]*\\))`)) || [])[1] || '';
    const ys = [...c.matchAll(/,\s*([-0-9.]+)/g)].map(x => Number(x[1]));
    check(`${t} does not overshoot`, ys.every(y => y <= 1 && y >= 0), c);
  }
}

section('THE CAMERA TRAVELS ON THE STYLESHEET’S OWN CURVE');
/* One curve named in one place, solved rather than approximated — not two
   that look alike until somebody changes one. */
{
  const { loadFrontend } = require('./helpers');
  const fe = loadFrontend();
  const move = (css.match(/--ease-move:\s*cubic-bezier\(([^)]*)\)/) || [])[1] || '';
  const [x1, y1, x2, y2] = move.split(',').map(Number);
  const mine = fe.bezier(x1, y1, x2, y2);
  eq('the page solves the same four numbers', [x1, y1, x2, y2], [0.4, 0, 0.2, 1]);
  check('it starts at nothing', Math.abs(mine(0) - 0) < 1e-6, String(mine(0)));
  check('and ends at everything', Math.abs(mine(1) - 1) < 1e-6, String(mine(1)));
  check('it never goes backwards',
        [...Array(40)].every((_, i) => mine(i / 40) <= mine((i + 1) / 40) + 1e-9));
  /* Eased at BOTH ends, which is what makes a long journey readable: it is
     behind a straight line at the start and ahead of it in the middle. */
  check('slow away from the start', mine(0.15) < 0.15, String(mine(0.15)));
  check('quick through the middle', mine(0.5) > 0.45, String(mine(0.5)));
  check('and slow into the end', 1 - mine(0.85) < 0.15, String(1 - mine(0.85)));
  /* The duration is read off the stylesheet where there is one to read, and
     falls back to the same number where there is not. */
  eq('and the duration the page uses is the one in the stylesheet',
     fe.MOTION_FAR, msOf('--m-far'));
}

section('AND SOMEBODY WHO ASKED FOR STILLNESS GETS A CUT, NOT A GLIDE');
/* A whole screen of family sliding past is the biggest motion here, so it is
   the one that most needs to be refusable. */
{
  check('the stylesheet stands everything down',
        /prefers-reduced-motion: reduce\)\{[^}]*animation-duration:\.01ms/.test(
          css.replace(/\s+/g, '')) ||
        /prefers-reduced-motion:reduce\)\{[^}]*animation-duration:\.01ms/.test(
          css.replace(/\s+/g, '')),
        'the reduced-motion block has changed');
  check('and the camera asks the same question before it moves',
        /prefers-reduced-motion: reduce/.test(html.split('</style>')[1] || ''),
        'glideTo does not check for reduced motion');
}

section('A JOURNEY LANDS EXACTLY WHERE IT WAS SENT');
/* Interpolating the last frame leaves the view a pixel short for good. */
{
  const { loadFrontend } = require('./helpers');
  const fe = loadFrontend();
  fe.glideTo({ x: 123, y: -456, k: 0.9 });
  const pos = fe.getPos();
  eq('exactly there', [pos.x, pos.y, pos.k], [123, -456, 0.9]);
}

section('THE VIEW GLIDES WHEN IT TAKES YOU SOMEWHERE, AND CUTS WHEN IT HOLDS STILL');
/* The rule the whole motion scale comes down to, and the two of them live
   eight lines apart. keepSteady cancels a layout shift so the pod under
   somebody's finger does not slide out from under them — easing that would
   animate the very drift it exists to remove. */
{
  const js = html.split('</style>')[1] || '';
  const body = name => {
    const at = js.indexOf(`function ${name}(`);
    return at < 0 ? '' : js.slice(at, js.indexOf('\n}', at));
  };
  for (const going of ['focusOn', 'bringIntoView', 'revealBuds']){
    check(`${going} travels`, /glideTo\(/.test(body(going)), body(going).slice(0, 120));
  }
  const still = body('keepSteady');
  check('keepSteady does not', !/glideTo\(/.test(still), still);
  check('and stops any journey that was already running, rather than fighting it',
        /stopGlide\(\)/.test(still), still);
  check('a hand on the tree stops one too',
        /pointerdown[\s\S]{0,500}stopGlide\(\)/.test(js), 'nothing stops a glide on a drag');
}

report();
