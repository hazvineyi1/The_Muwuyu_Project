// WHO IS PICKED, AND SAYING SO.
//
// "It needs to be clearer when clicking on the person and highlighting them,
//  who is being highlighted."
//
// Tapping somebody does two things at once: it opens the ways to grow from
// them, and it makes every word on the tree reckon from where THEY stand. Both
// matter, and the app was marking neither in a way that could be found on a
// real screen — a two-pixel gold border, on a canvas where a married-in
// family's tint is a filled chip in full colour. Measured on a screenshot of
// a real tree, the woman standing beside the picked man drew the eye harder
// than the picked man did.
//
// TWO ANSWERS, BECAUSE THEY ANSWER DIFFERENT QUESTIONS. A mark on the pod can
// say "this one" and cannot say a name; at the zoom where a whole family fits
// on the screen, the names are too small to read and "this one" is not much of
// an answer. So the mark got louder AND the bar says the name in words, for as
// long as somebody is picked and not a moment longer.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function family(){
  const fe = loadFrontend();
  const elder = fe.addPerson('Musoni Elder', 'm', 'Mwendamberi', '1870', '');
  const a = fe.grow('child', elder, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const b = fe.grow('child', elder, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  fe.grow('partner', b, 'Rudo Musoni', 'f', 'Nzou', { born:'1902' });
  const dad = fe.grow('child', a, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  return { fe, elder, a, b, dad, me };
}
/* The class attribute comes before data-id in the markup, so a pod is read
   from the opening tag back — not by splitting on the id. */
const podOf = (html, name) => {
  const at = html.indexOf('>' + name + '<');
  if (at < 0) return '';
  const from = html.lastIndexOf('<div class="pod', at);
  return from < 0 ? '' : html.slice(from, at + name.length + 2);
};

section('THE PICKED POD IS MARKED, AND ONLY THE PICKED POD');
{
  const t = family();
  t.fe.pick(t.b);
  const html = t.fe.draw();
  check('it carries the mark', /class="pod[^"]*\bsel\b/.test(podOf(html, 'Baya Musoni')),
        podOf(html, 'Baya Musoni').slice(0, 160));
  check('and the woman beside him does not',
        !/\bsel\b/.test(podOf(html, 'Rudo Musoni')), podOf(html, 'Rudo Musoni').slice(0, 160));
  eq('one pod, not two', (html.match(/class="pod[^"]*\bsel\b/g) || []).length, 1);
}

section('AND THE BAR SAYS WHO, BY NAME');
/* The half a ring cannot do. At the zoom where a whole family fits on the
   screen the names on the pods are too small to read, and "this one" is not
   much of an answer to "who". */
{
  const t = family();
  t.fe.pick(t.b);
  const bar = t.fe.barNotices();
  check('the name, in full', /<b>Baya Musoni<\/b>/.test(bar), bar);
  check('and what being picked means',
        /every word is from here/.test(bar), bar);
  check('with the way to let go', /id="selOff"/.test(bar), bar);
  check('and the way out names them, for a screen reader too',
        /aria-label="Let go of Baya Musoni"/.test(bar), bar);
}

section('and it says "you" when the one picked is you');
{
  const t = family();
  t.fe.pick(t.me);
  const bar = t.fe.barNotices();
  check('named all the same', /<b>Hazvineyi Musoni<\/b>/.test(bar), bar);
  check('and marked as yourself', /you — every word is from here/.test(bar), bar);
}

section('NOTHING PICKED, NOTHING SAID');
/* A chip that is always there is not a chip, it is furniture. This one is the
   shape of a state somebody just made with a tap, and it goes when they let
   go — which tapping bare canvas already does. */
{
  const t = family();
  t.fe.pick(null);
  const bar = t.fe.barNotices();
  check('no chip at all', !/id="selOff"/.test(bar), bar);
  check('and no pod marked', !/class="pod[^"]*\bsel\b/.test(t.fe.draw()));
}

section('and somebody set aside is not still picked');
{
  const t = family();
  t.fe.pick(t.b);
  t.fe.setAside(t.b, 'a duplicate');
  check('the chip goes with them', !/Baya Musoni<\/b>/.test(t.fe.barNotices()),
        t.fe.barNotices());
}

section('A LIT WORD SPEAKS INSTEAD, SO THE BAR NEVER SAYS TWO THINGS AT ONCE');
/* Lighting a word is an answer somebody asked for and it earns the bar. Being
   picked is the state underneath it, and two chips saying two different
   things about the same tap is worse than either alone. */
{
  const t = family();
  t.fe.pick(t.b);
  t.fe.lightWord(t.me, 'Baba', new Set([t.dad]));
  const bar = t.fe.barNotices();
  check('the word has it', /<b>Baba<\/b>/.test(bar), bar);
  check('and the picked chip stands down', !/id="selOff"/.test(bar), bar);
}

section('THE MARK IS THREE THINGS, NOT ONE');
/* One mark was not enough against a filled colour chip two inches away. */
{
  const css = require('fs').readFileSync(
    require('path').join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const rule = (css.match(/\.pod\.sel\{[^}]*\}/) || [''])[0];
  check('a ring outside the pod, where nothing else is drawn',
        /box-shadow:[^;]*var\(--gold\)/.test(rule), rule);
  check('and height off the canvas', /z-index/.test(rule) && /scale\(/.test(rule), rule);
  check('and the name comes up in weight',
        /\.pod\.sel \.nm\{font-weight:600/.test(css));
  /* Dimmed and picked at once is the app disagreeing with itself. */
  check('a picked pod is never set back at the same time',
        /\.pod\.sel\.dim[^{]*\{opacity:1/.test(css));
}

report();
