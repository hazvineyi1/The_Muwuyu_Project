// THE FAMILIES THAT MARRIED IN — separate trees, foldable, and named.
//
// "This is the beginning of a new tree with possibly different roots. New
//  trees should be collapsible and also show up differently. If I am building
//  my tree, then branch to my mother and her parents and grandparents and
//  siblings, that is now a different tree from my father's, and the
//  connection is my mother being married to my father. I think when marriage
//  or partnerships happen, that's the indicator of a new tree growing in a
//  different direction with a separate root."
//
// Sent with a photograph of five Marumahoko filling the top-left corner of a
// Musoni tree. They are his father's brother's wife's brothers and sisters —
// a whole family, with a root of its own, drawn as though they were branches
// of his. Nothing on the screen said otherwise and there was no way to put
// them away while he worked on his own line.
//
// The reading is right and this file is built on it: a marriage is not a step
// in a family line, it is the DOOR between two of them. Cut every edge except
// child-to-father and the tree falls into exactly the families a family would
// name.
//
// WHAT A FOLD MUST NEVER COST, which is most of what is asserted here:
//   - a record. Nothing is deleted, nothing is sent, and the words still
//     reckon straight through everybody behind a fold.
//   - a marriage. The person who married in stays: she is standing in a
//     household that is still on the screen.
//   - a way back. Folded and then unreachable is worse than never folded.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* His tree, reduced to what the photograph showed, plus one family deeper
   than the photograph went: his mother's brother's wife has people of her
   own, and they are only on this screen through the Mandabas. */
function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');

  // HIS OWN LINE
  const ggm  = P('Mbuya VaMangwenya', 'f', 'Mwendamberi', '1880');
  const gf   = fe.grow('child', ggm, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const gBro = fe.grow('child', ggm, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const dad    = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const dadBro = fe.grow('child', gf, 'Terence Musoni', 'm', 'Mwendamberi', { born:'1945' });

  // THE FAMILY IN THE PHOTOGRAPH: his father's brother's wife's people
  const daisy  = fe.grow('partner', dadBro, 'Daisy Marumahoko', 'f', 'Soko', { born:'1948' });
  const herMum = P('Georgina Vera', 'f', 'Soko', '1920');
  fe.linkExisting('child', herMum, daisy);
  const hers = [['David Marumahoko','1944','m'], ['Maryjane Chiweshe','1946','f'],
                ['Phineas Marumahoko','1950','m'], ['Doreen Marumahoko','1952','f']]
    .map(([n, y, s]) => fe.grow('child', herMum, n, s, 'Soko', { born:y }));

  // HIS MOTHER'S PEOPLE
  const mum  = fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const mgf  = P('James Mandaba', 'm', 'Moyondizvo', '1925');
  fe.linkExisting('child', mgf, mum);
  const mBro = fe.grow('child', mgf, 'Joseph Mandaba', 'm', 'Moyondizvo', { born:'1956' });

  // AND HERS: only on this screen through the Mandabas
  const ruth = fe.grow('partner', mBro, 'Ruth Chikowore', 'f', 'Nzou', { born:'1958' });
  const rDad = P('Enoch Chikowore', 'm', 'Nzou', '1930');
  fe.linkExisting('child', rDad, ruth);
  const rBro = fe.grow('child', rDad, 'Tendai Chikowore', 'm', 'Nzou', { born:'1960' });

  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, ggm, gf, gBro, dad, dadBro, daisy, herMum, hers,
           mum, mgf, mBro, ruth, rDad, rBro };
}
const named = (t, id) => t.fe.getState().people[id].name;
const onScreen = t => new Set(Object.keys(t.fe.layoutOf().persons));
const lineNamed = (t, name) => t.fe.familyLines().lines.find(l => l.name === name);
const fold = (t, name, on) => t.fe.setLineFolded(lineNamed(t, name).id, on !== false);

section('THE TREE FALLS INTO THE FAMILIES A FAMILY WOULD NAME');
{
  const t = tree();
  const lines = t.fe.familyLines().lines;
  eq('four of them, not one', lines.map(l => l.name).sort(),
     ['Chikowore', 'Mandaba', 'Marumahoko', 'Musoni']);
  eq('and his is the one he is standing in',
     named(t, t.fe.familyLines().homeId), 'Mbuya VaMangwenya');
}

section('each with a root of its own, which is the whole of his point');
/* "A new tree growing in a different direction with a separate root." Not a
   branch of his tree that happens to be far from the middle — a root. */
{
  const t = tree();
  const root = n => named(t, lineNamed(t, n).root);
  eq('the Marumahoko come down from Georgina', root('Marumahoko'), 'Georgina Vera');
  eq('the Mandaba from James', root('Mandaba'), 'James Mandaba');
  eq('the Chikowore from Enoch', root('Chikowore'), 'Enoch Chikowore');
  eq('and his own from his great-grandmother', root('Musoni'), 'Mbuya VaMangwenya');
}

section('A MARRIAGE IS THE DOOR, NOT A STEP');
/* The rule the whole file rests on. His mother is in her father's family and
   not in his, and the one thing joining the two is that she married his
   father — which is what he said, and what stops a walk up his own line
   wandering into hers and coming back with her whole family as his. */
{
  const t = tree();
  const of = id => t.fe.familyLines().of(id);
  check('his mother is not in his line', of(t.mum) !== of(t.me),
        JSON.stringify([named(t, t.mum), named(t, t.me)]));
  eq('she is in her father’s', of(t.mum), of(t.mgf));
  eq('and he is in his father’s', of(t.me), of(t.dad));
  const door = lineNamed(t, 'Mandaba').doors[0];
  eq('the door out of her family is her own marriage',
     [named(t, door.person), named(t, door.with)], ['Evelyn Mandaba', 'Sydney Musoni']);
}

section('and a family names itself, rather than being named after its eldest');
/* Georgina Vera kept her father's name; her children carry their father's.
   Filing them under Vera would file them under a name not one of them
   answers to. */
{
  const t = tree();
  eq('the commonest name among them wins', lineNamed(t, 'Marumahoko').name, 'Marumahoko');
  check('even though the woman at the head of it is a Vera',
        named(t, lineNamed(t, 'Marumahoko').root) === 'Georgina Vera');
}

section('YOUR OWN LINE IS NEVER OFFERED FOR FOLDING');
{
  const t = tree();
  const offered = t.fe.foldableLines().map(l => l.name).sort();
  eq('the other three, and not his', offered, ['Chikowore', 'Mandaba', 'Marumahoko']);
}

section('and neither is a wife with no relatives of her own');
/* One person is not a family waiting to be tidied away. Offering to fold her
   would be offering to hide somebody's wife. */
{
  const fe = loadFrontend();
  const dad = fe.addPerson('Father', 'm', 'Shumba', '1940', '');
  fe.grow('partner', dad, 'A wife who married in', 'f', 'Nzou', { born:'1945' });
  const me = fe.grow('child', dad, 'Me', 'm', 'Shumba', { born:'1970' });
  fe.setMe(me);
  eq('nothing to fold', fe.foldableLines().length, 0);
  check('although she is her own line all the same',
        fe.familyLines().lines.length === 2,
        JSON.stringify(fe.familyLines().lines.map(l => l.name)));
}

section('FOLDING ONE TAKES THEM OFF THE SCREEN');
{
  const t = tree();
  const before = onScreen(t);
  eq('everybody to start with', before.size, 18);

  fold(t, 'Marumahoko');
  const after = onScreen(t);
  const gone = [...before].filter(id => !after.has(id)).map(id => named(t, id)).sort();
  eq('her mother and her brothers and sisters go', gone,
     ['David Marumahoko', 'Doreen Marumahoko', 'Georgina Vera',
      'Maryjane Chiweshe', 'Phineas Marumahoko']);
}

section('BUT NEVER THE WOMAN WHO MARRIED IN');
/* The one that would be a bug rather than a setting. Daisy is standing in
   Terence's household and Terence has not gone anywhere — folding her away
   would leave him married to nobody. */
{
  const t = tree();
  fold(t, 'Marumahoko');
  const shown = onScreen(t);
  check('Daisy is still beside her husband', shown.has(t.daisy) && shown.has(t.dadBro),
        JSON.stringify([shown.has(t.daisy), shown.has(t.dadBro)]));
}

section('AND WHAT HUNG OFF THE FOLD GOES WITH IT');
/* Ruth is her own family and nobody folded her. But the only way from her to
   him runs through her husband Joseph, so with the Mandabas away she would be
   left floating in open canvas joined to nothing — a worse picture than the
   one the fold was asked to tidy.
 *
 * AND THE ORDER MATTERS. Joseph is married, so a rule that looks for doors
 * before it works out what is still standing keeps him for Ruth's sake and
 * her for his, and the pair of them hang off a family that is not drawn. */
{
  const t = tree();
  fold(t, 'Mandaba');
  const shown = onScreen(t);
  check('her father and her brother go too',
        !shown.has(t.rDad) && !shown.has(t.rBro),
        JSON.stringify([shown.has(t.rDad), shown.has(t.rBro)]));
  check('and so does she', !shown.has(t.ruth));
  check('her husband is not kept back by her being married to him',
        !shown.has(t.mBro), named(t, t.mBro) + ' is still drawn');
  check('his own mother stays, as the door', shown.has(t.mum));
}

section('a family standing on its own is never swept up by somebody else’s fold');
/* The difference between "cut off by the fold" and "was never joined to you
   in the first place". A second family entered on the same tree and not yet
   linked to anybody is not behind anybody's fold. */
{
  const t = tree();
  const stranger = t.fe.addPerson('Nobody’s relative', 'f', 'Shava', '1970', '');
  t.fe.grow('child', stranger, 'Their child', 'm', 'Shava', { born:'1995' });
  fold(t, 'Mandaba');
  check('they are still on the screen', onScreen(t).has(stranger));
}

section('TWO FOLDED FAMILIES DO NOT HOLD EACH OTHER OPEN');
/* Both folded, and married to each other. A rule that asks "is your partner
   showing" against a set already half undone answers yes for whichever is
   asked second, and one of the two families never folds. */
{
  const t = tree();
  fold(t, 'Mandaba');
  fold(t, 'Chikowore');
  const shown = onScreen(t);
  check('the Chikowore are away', !shown.has(t.ruth) && !shown.has(t.rDad));
  check('and so are the Mandaba', !shown.has(t.mgf) && !shown.has(t.mBro));
  check('his mother is still the door into his own household', shown.has(t.mum));
}

section('NOTHING IS DELETED BY FOLDING IT AWAY');
/* The same promise the reach makes, and the reason to keep making it: this
   project has frightened one family twice with relatives that looked gone. */
{
  const t = tree();
  fold(t, 'Mandaba');
  fold(t, 'Marumahoko');
  eq('the tree still holds all eighteen',
     Object.keys(t.fe.getState().people).length, 18);
  eq('and the words still reckon straight through them',
     (t.fe.kinTerms(t.me, t.mgf).list[0] || {}).term, 'Sekuru');
  check('including into a family folded behind another one',
        !!t.fe.kinTerms(t.me, t.ruth).list.length ||
        !!(t.fe.relationship(t.me, t.ruth) || {}).why,
        JSON.stringify(t.fe.kinTerms(t.me, t.ruth)));
}

section('AND A FOLD COMES BACK');
{
  const t = tree();
  const before = onScreen(t).size;
  fold(t, 'Marumahoko');
  check('something went', onScreen(t).size < before);
  fold(t, 'Marumahoko', false);
  eq('and everybody is back', onScreen(t).size, before);
}

section('IT IS KEPT ON THE DEVICE, like the zoom and the reach');
/* Never sent. Two relatives reading the same tree on the same afternoon can
   have different halves of it folded and both be right. */
{
  const t = tree();
  const id = lineNamed(t, 'Mandaba').id;
  fold(t, 'Mandaba');
  const written = t.fe.prefs.getItem('muti-baobab-folded');
  check('it was written down', !!written && written.indexOf(id) >= 0, String(written));
  eq('and nothing about it is waiting to be saved',
     t.fe.diffOps(t.fe.getState(), t.fe.getState()).length, 0);

  fold(t, 'Mandaba', false);
  eq('unfolding the last one clears it rather than leaving an empty list',
     t.fe.prefs.getItem('muti-baobab-folded'), null);
}

section('a fold written by an older visit is honoured on the next one');
{
  const t = tree();
  const id = lineNamed(t, 'Mandaba').id;
  t.fe.prefs.setItem('muti-baobab-folded', JSON.stringify([id]));
  t.fe.loadFolded();
  check('the family it names is folded', t.fe.isFolded(id));
  check('and they are off the screen', !onScreen(t).has(t.mgf));
}

section('and nonsense in there is not a broken tree');
/* Whatever ends up in a device's storage — an older version's format, a
   half-written value, a family id from a different tree — the answer is the
   whole family, never an empty screen. */
{
  for (const junk of ['', 'not json at all', '{"a":1}', '[1,2,3]', 'null']){
    const t = tree();
    t.fe.prefs.setItem('muti-baobab-folded', junk);
    t.fe.loadFolded();
    eq(`${JSON.stringify(junk)} shows everybody`, onScreen(t).size, 18);
  }
  const t = tree();
  t.fe.prefs.setItem('muti-baobab-folded', JSON.stringify(['a family from another tree']));
  t.fe.loadFolded();
  eq('and so does a family that is not in this tree', onScreen(t).size, 18);
}

section('THE PICTURE SAYS WHICH FAMILY IS WHICH');
/* "New trees should... also show up differently." Quiet, because the last
   thing this app put on every pod it was asked to take off again — a tint
   down the left edge, and ONE name per family. */
{
  const t = tree();
  const html = t.fe.draw();
  check('the pods carry the family they belong to', /data-fam="/.test(html), html.slice(0, 400));
  /* A NAMED COLOUR, not a number worked out here. The six tints live in the
     stylesheet with one set per face, so a family reading at midnight gets
     the colours that were measured against a midnight page — and the page
     cannot invent a seventh that nobody checked. */
  check('with a tint to tell them apart', /--fam:var\(--fam-[1-6]\)/.test(html),
        (html.match(/--fam:[^";]*/g) || []).join(' | '));
  const used = [...new Set((html.match(/--fam:var\(--fam-(\d)\)/g) || []))];
  check('and no tint outside the six that were measured',
        used.every(u => /--fam-[1-6]\)/.test(u)), JSON.stringify(used));
  check('the Marumahoko are named once, under the woman they come down from',
        (html.match(/class="famname"/g) || []).length === 3,
        JSON.stringify((html.match(/famname">[^<]*/g) || [])));
  check('and his own line is not tinted at all',
        !new RegExp(`data-id="${t.me}"[^>]*data-fam`).test(html));
}

section('and the way to fold one is at the marriage that joined them');
{
  const t = tree();
  const html = t.fe.draw();
  const doors = html.match(/data-fold="[^"]*"/g) || [];
  eq('one button per family that married in', doors.length, 3);
  check('it says what it is for in words',
        /Fold away the Marumahoko family — 5 people/.test(html),
        (html.match(/title="[^"]*family[^"]*"/g) || []).join(' | '));
  check('and it is on the person who married in',
        new RegExp(`data-id="${t.daisy}"[\\s\\S]{0,600}?data-fold`).test(html));
}

section('AND IT IS THE DOOR FACING HOME, never the one facing away');
/* Two marriages lead out of his mother's family: hers, towards him, and her
   brother's, away. A button on the brother offering to fold away the
   Mandabas would be a button that folds away the man wearing it — and would
   leave the family with two ways in that do different things. */
{
  const t = tree();
  const mandaba = lineNamed(t, 'Mandaba');
  eq('his mother is one marriage out, her brother\u2019s wife two',
     [mandaba.depth, lineNamed(t, 'Chikowore').depth], [1, 2]);
  eq('and his own line is where the counting starts',
     lineNamed(t, 'Musoni').depth, 0);
  eq('both marriages are doors out of her family', mandaba.doors.length, 2);
  eq('but only hers is the one it folds from',
     mandaba.inward.map(d => named(t, d.person)), ['Evelyn Mandaba']);

  const html = t.fe.draw();
  check('so her brother wears no button at all',
        !new RegExp(`data-id="${t.mBro}"[^>]*>(?:(?!</div>)[\\s\\S]){0,600}?data-fold`).test(html),
        'a fold button turned up on ' + named(t, t.mBro));
}

section('and once folded it says how many are behind it, and offers them back');
{
  const t = tree();
  fold(t, 'Marumahoko');
  const html = t.fe.draw();
  check('the button counts them', /aria-expanded="false"[^>]*>\+5</.test(html),
        (html.match(/class="fold"[\s\S]{0,320}?<\/button>/g) || []).join('\n'));
  check('and offers to open them', /Open the Marumahoko family/.test(html));
  check('the name goes with them, since nobody is left to wear it',
        !/famname">MARUMAHOKO|famname">Marumahoko/.test(html),
        (html.match(/famname">[^<]*/g) || []).join(' | '));
}

section('AND THE BAR SAYS SO FOR AS LONG AS ANYBODY IS FOLDED AWAY');
/* Said the way the reach says it, and for the same reason: a family folded
   a fortnight ago is a button somewhere off the side of a tree that has been
   panned and zoomed a hundred times since. "Where did my mother's people go"
   must never be a question this app leaves anybody holding. */
{
  const t = tree();
  eq('nothing on the bar while everybody is showing', t.fe.barNotices(), '');

  fold(t, 'Mandaba');
  const one = t.fe.barNotices();
  check('the family is named', /<b>Mandaba<\/b>/.test(one), one);
  check('with how many of them are on the screen', /13 of 18/.test(one), one);
  check('and the word that matters — not removed',
        /folded away, not removed/.test(one), one);
  check('and a way out of it', /id="foldOff"/.test(one), one);

  fold(t, 'Marumahoko');
  const two = t.fe.barNotices();
  check('two folded families are still one line, not two pills',
        (two.match(/class="pill"/g) || []).length === 1, two);
  check('both named on it', /Marumahoko/.test(two) && /Mandaba/.test(two), two);
  check('and it reads as a plural', /those families are/.test(two), two);

  fold(t, 'Mandaba', false);
  fold(t, 'Marumahoko', false);
  eq('and it goes when they come back', t.fe.barNotices(), '');
}

section('and folding one that is already behind another changes the names, not the count');
/* The Chikowore are on this screen only through the Mandabas, so with the
   Mandabas folded they have already gone. Folding them as well takes nobody
   further off the picture — but it IS a second fold, and "Open them" now
   opens two families rather than one, so the line has to say both. Counting
   them twice would be the bug. */
{
  const t = tree();
  fold(t, 'Mandaba');
  check('one family, thirteen showing', /<b>Mandaba<\/b>/.test(t.fe.barNotices()) &&
        /13 of 18/.test(t.fe.barNotices()), t.fe.barNotices());
  fold(t, 'Chikowore');
  const both = t.fe.barNotices();
  check('still thirteen showing, because nobody new went', /13 of 18/.test(both), both);
  check('and both are named, because opening now opens both',
        /<b>Mandaba, Chikowore<\/b>/.test(both), both);
}

section('THE FAMILIES ARE LISTED WHERE THEY CAN BE FOUND AGAIN');
/* A button on a pod is only findable if you already know it is there, and a
   family folded last week is a button somewhere off the side of a tree you
   have since panned away from. Folded and then lost would be worse than
   never folded. */
{
  const t = tree();
  fold(t, 'Mandaba');
  const panel = t.fe.famPanel();
  check('all three are named', /Marumahoko/.test(panel) && /Mandaba/.test(panel) &&
        /Chikowore/.test(panel), panel);
  check('with how many people each one is', /6 people/.test(panel), panel);
  check('and which marriage joined them',
        /joined by Evelyn Mandaba's marriage to Sydney Musoni/.test(panel), panel);
  check('the folded one says so', /aria-pressed="true"/.test(panel), panel);
  check('and there is a way back for all of them at once',
        /data-famall="open"/.test(panel), panel);
  check('his own line is named as the one that is never folded',
        /Your own line is the Musoni/.test(panel), panel);
}

section('and with nothing married in, the panel says nothing at all');
{
  const fe = loadFrontend();
  const a = fe.addPerson('Elder', 'm', 'Shumba', '1900', '');
  const b = fe.grow('child', a, 'Child', 'm', 'Shumba', { born:'1930' });
  fe.setMe(b);
  eq('no section for a family of one line', fe.famPanel(), '');
}

section('NOBODY IS LAID ON TOP OF ANYBODY WITH A FAMILY FOLDED AWAY');
/* Folding takes households out of the middle of rows, which is the move that
   leaves a gap or an overlap if the room is re-reckoned wrongly. */
{
  for (const shape of ['', 'muti']){
    const t = tree();
    t.fe.setShape(shape);
    fold(t, 'Marumahoko');
    const L = t.fe.layoutOf();
    const rows = new Map();
    for (const [id, q] of Object.entries(L.persons)){
      const y = Math.round(q.y);
      (rows.get(y) || rows.set(y, []).get(y)).push({ id, x:q.x });
    }
    let clash = null;
    for (const row of rows.values()){
      row.sort((a, b) => a.x - b.x);
      for (let i = 1; i < row.length; i++)
        if (row[i].x - row[i - 1].x < 131.5)
          clash = `${named(t, row[i - 1].id)} and ${named(t, row[i].id)}`;
    }
    eq(`${shape || 'mudzi'}: every row is clear`, clash, null);
  }
}

section('and the two halves still hold with one of them folded');
/* The sides and the folds are two rules about the same sort, so this is the
   check that they have not started arguing: his father's people are still
   left of him with his mother's family away, and the reverse. */
{
  const t = tree();
  fold(t, 'Mandaba');
  const x = id => Math.round(t.fe.layoutOf().persons[id].x);
  check('his father’s brother is still on his father’s side',
        x(t.gBro) < x(t.me), JSON.stringify([x(t.gBro), x(t.me)]));
  check('and his mother, the last of hers left, is still on hers',
        x(t.mum) > x(t.me), JSON.stringify([x(t.mum), x(t.me)]));
}

report();
