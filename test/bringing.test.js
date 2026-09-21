// BRINGING SOMEBODY ALREADY RECORDED ONTO THE BRANCH YOU ARE WORKING ON.
//
// "If I want to open an individual and make them part of the tree I am
//  working on, that should be possible."
//
// It was possible and it was not findable. Every bud around a selected person
// makes a NEW person — Child, Sibling, Partner, Parent, and the word your
// family uses. The one door to somebody already recorded was on their card,
// below a paragraph about a kinship word being wrong, which is where you go
// when something has gone wrong rather than when you are building.
//
// That matters most at the exact moment two relatives filling in the same
// family from opposite ends meet in the middle. If the only door open then
// makes a new record, that is the door they take, and the man they both knew
// is in the tree twice.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function family(){
  const fe = loadFrontend();
  const gf = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  return { fe, gf, dad, me };
}
const budKinds = html => (html.match(/data-bud="([a-z]+)"/g) || [])
  .map(m => m.replace(/.*"([a-z]+)"$/, '$1'));

section('THE OFFER IS ON THE RING, BESIDE THE ONES THAT MAKE A NEW PERSON');
{
  const t = family();
  const html = t.fe.budsHtml(t.dad);
  check('there is a bud for it', budKinds(html).includes('join'), budKinds(html).join(','));
  check('and it says what it is for in plain words',
        /Somebody already here/.test(html), html.slice(0, 400));
}

section('and it says what it saves you');
{
  const t = family();
  const html = t.fe.budsHtml(t.dad);
  const title = (html.match(/title="([^"]*already in this tree[^"]*)"/) || [])[1] || '';
  check('brought onto this branch', /onto this branch/.test(title), title);
  check('and no second record made', /No second record, no duplicate/.test(title), title);
}

section('BUT NOT IN A TREE WITH NOBODY TO FIND');
/* An offer that can only ever come back empty is not an offer. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('The first name', 'f', 'Nzou', '1950', '');
  fe.setMe(a);
  check('nobody else in the tree, no such bud',
        !budKinds(fe.budsHtml(a)).includes('join'), budKinds(fe.budsHtml(a)).join(','));
  const b = fe.grow('child', a, 'Her child', 'm', 'Nzou', { born:'1980' });
  check('nor with only the two of them',
        !budKinds(fe.budsHtml(a)).includes('join'), budKinds(fe.budsHtml(a)).join(','));
  fe.grow('child', a, 'Another child', 'f', 'Nzou', { born:'1982' });
  check('and from three, it is there',
        budKinds(fe.budsHtml(a)).includes('join'), budKinds(fe.budsHtml(a)).join(','));
}

section('THE OTHER BUDS ARE ALL STILL THERE');
/* A ring that drops an offer to make room for this one has traded one
   complaint for another. */
{
  const t = family();
  eq('every way in, and the new one beside them',
     budKinds(t.fe.budsHtml(t.dad)).sort(),
     ['child', 'join', 'parent', 'partner', 'sibling', 'ways']);
  /* And on the root, where the Parent bud is replaced by the way to lift the
     root rather than simply dropped. */
  t.fe.toggleRoot(t.gf);
  eq('and on the root, the same, with the way through the root',
     budKinds(t.fe.budsHtml(t.gf)).sort(),
     ['child', 'deepen', 'join', 'partner', 'sibling', 'ways']);
}

section('AND IT IS THE PLAIN KIND OF LABEL THE REST OF THE RING USES');
{
  const t = family();
  const html = t.fe.budsHtml(t.dad);
  check('no four-pointed star anywhere near it', !/✦|✨|✧/.test(html), html);
  check('and nothing about the app working anything out',
        !/works out/.test((html.match(/title="[^"]*already in this tree[^"]*"/) || [''])[0]));
}

report();
