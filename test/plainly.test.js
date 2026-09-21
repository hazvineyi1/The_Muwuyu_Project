// SAYING WHAT A THING IS, IN THE WORDS OF SOMEBODY WHO DOES NOT ALREADY KNOW.
//
// "What does this mean? Some things are not very clear."
//
// Sent with a photograph of one button: a four-pointed sparkle and the words
// "By what you call them".
//
// TWO FAULTS IN ONE SMALL BUTTON, and both are kinds rather than one-offs.
//
// The four buds beside it are THINGS you can add — Child, Sibling, Partner,
// Parent. This one was a description of a METHOD. A different kind of phrase,
// doing a different job, sitting in the same row at the same size, so it read
// as decoration rather than as an offer. Nothing about it said that tapping
// it would let you add your Tete.
//
// And the sparkle. In this decade a four-pointed star means one thing to
// almost everybody, which is a machine having a guess. There is no guessing
// anywhere behind that button — it is a list of the words the family already
// uses — so the icon was promising the opposite of what is there.
//
// The panel it opens was always clear: "Add someone you call…", "Pick the
// word your family uses for them. The app works out where they go." The
// button simply never said any of it. So now it says the words themselves.

const { check, eq, section, report, loadFrontend } = require('./helpers');
const fs = require('fs');
const path = require('path');
const page = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf  = P('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const me  = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, gf, dad };
}

section('THE BUD SAYS THE WORDS, rather than describing them');
{
  const t = tree();
  const words = t.fe.budWords(t.me);
  check('there are words to show', words.length === 2, JSON.stringify(words));
  check('and they are words a family would say, not a sentence about words',
        words.every(w => /^[A-Z][a-z'’]+$/.test(w)), JSON.stringify(words));
}

section('and never a word the plain buds already reach');
/* Baba and Amai are Parent. Mukoma and Hanzvadzi are Sibling. Offering those
   here would be this button advertising what the button beside it does —
   which is how a row of five ends up reading as a row of noise. */
{
  const t = tree();
  for (const who of [t.me, t.gf, t.dad]){
    const words = t.fe.budWords(who);
    const overlap = words.filter(w => t.fe.PLAIN_BUDS.has(w));
    eq(`nothing already on another bud (${t.fe.getState().people[who].name})`, overlap, []);
  }
}

section('and never a word it cannot actually offer');
/* A button that says "Tete, Sekuru…" and then offers neither is worse than
   one that said nothing at all. */
{
  const t = tree();
  for (const who of [t.me, t.gf, t.dad]){
    const words = t.fe.budWords(who);
    const ready = new Set(t.fe.waysToAdd(who).filter(w => w.ready).map(w => w.term));
    const empty = words.filter(w => !ready.has(w));
    eq(`every word shown can be used (${t.fe.getState().people[who].name})`, empty, []);
  }
}

section('and it is their OWN family’s words, not a fixed pair');
/* Reckoned from the person the buds are standing round, so the button beside
   a grandfather offers what fits a grandfather. */
{
  const t = tree();
  const mine = t.fe.budWords(t.me).join(',');
  const his = t.fe.budWords(t.gf).join(',');
  check('two different people, two different offers', mine !== his,
        JSON.stringify({ mine, his }));
}

section('a tree with nobody in it yet does not promise words it has not got');
{
  const fe = loadFrontend();
  const only = fe.addPerson('The first person', 'f', 'Nzou', '1950', '');
  fe.setMe(only);
  fe.setShape('');
  const words = fe.budWords(only);
  check('either real words or none at all',
        words.every(w => typeof w === 'string' && w.length > 1), JSON.stringify(words));
}

section('NO SPARKLE, anywhere');
/* A four-pointed star means a machine guessing. Nothing in this app guesses:
   every word it shows is one the family has either taught it or one that
   falls straight out of how the tree is joined up. Promising otherwise is a
   lie about what the thing is. */
{
  const bad = ['✦', '✧', '✨', '✩', '✪', '✶'];
  const found = bad.filter(c => page.includes(c));
  eq('not one of them is on the page', found, []);
}

section('AND NO BUTTON IS LABELLED WITH A NAME ONLY THIS APP KNOWS');
/* The palette button used to say "Muwuyu" — which tells you what you are
   already wearing and nothing about what the button does. A label is for
   somebody who has not been here before. */
{
  const bar = (page.match(/<div id="bar"[\s\S]*?<\/div>/) || [''])[0];
  const labels = [...bar.matchAll(/<button[^>]*>([^<]+)</g)].map(m => m[1].trim());
  check('the bar has its buttons', labels.length >= 5, JSON.stringify(labels));
  const jargon = ['Muwuyu', 'Mudzi', 'Muti', 'Miombo', 'Msasa', 'Indigo', 'Stone'];
  const named = labels.filter(l => jargon.includes(l));
  eq('none of them is a name from inside the app', named, []);
}

section('and every one of them is a word or two, not a sentence');
{
  const bar = (page.match(/<div id="bar"[\s\S]*?<\/div>/) || [''])[0];
  const labels = [...bar.matchAll(/<button[^>]*>([^<]+)</g)].map(m => m[1].trim())
    .filter(l => l.length > 1);
  const wordy = labels.filter(l => l.split(/\s+/).length > 3);
  eq('nothing in the bar is a sentence', wordy, []);
}

section('A LABEL THAT CANNOT SAY IT ALL HAS A SENTENCE BEHIND IT');
/* The bud has room for two words. What it is for takes more than two, so the
   rest is on the button itself — for a pointer and for a screen reader
   alike. Read off the markup the page builds, not off the source that builds
   it, because the source is a template and would pass whatever it produced. */
{
  const t = tree();
  const html = t.fe.budsHtml(t.me);
  check('there are buds', /class="bud"/.test(html), html.slice(0, 200));
  const ways = (html.match(/<div class="bud" data-bud="ways"[^>]*>/) || [''])[0];
  check('the word bud is drawn', !!ways, html);
  check('and carries the whole of it in a sentence',
        /title="[^"]*word your family uses[^"]*"/.test(ways), ways);
  check('and a screen reader is told the same thing',
        /aria-label="[^"]*word your family uses[^"]*"/.test(ways), ways);
  check('and the label itself is the words',
        /Tete|Sekuru|Babamukuru|Ambuya|Muroora|Muzukuru|Amaiguru/.test(ways ? html : ''),
        html);
}

report();
