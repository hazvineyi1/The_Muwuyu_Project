// FOCUSING ON ONE PART OF THE TREE, AND SHUTTING THE REST.
//
// "When I click on a name, that family tree part should come into focus. I
//  should be able to minimize the other trees and focus on one tree. I want
//  to be able to close and open different tree sectors."
//
// Most of the machinery was already here and none of it was joined up.
// branchFrom() has computed a sector for months. The fold could close a
// family that married in — and only a family that married in, because that
// was the complaint the day it was written. Tapping a name showed where the
// tree could grow from it and answered nothing about which of two hundred
// people were theirs.
//
// So: a tap lifts their part and sets the rest back, a fold closes ANY
// sector from the person it hangs off, and the two are different acts on
// purpose. Lifting is what happens while you look. Folding is what you do
// when you have decided.

const { check, eq, section, report, loadFrontend } = require('./helpers');

/* Four branches off one elder, so there is a real "the rest of the tree" to
   set back or shut. */
function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const elder = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const a = fe.grow('child', elder, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const b = fe.grow('child', elder, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  fe.grow('partner', b, 'Baya’s wife', 'f', 'Nzou', { born:'1902' });
  const b1 = fe.grow('child', b, 'Nephew One', 'm', 'Mwendamberi', { born:'1930' });
  fe.grow('child', b, 'Nephew Two', 'm', 'Mwendamberi', { born:'1933' });
  fe.grow('child', b1, 'Great nephew', 'm', 'Mwendamberi', { born:'1960' });
  const dad = fe.grow('child', a, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.grow('child', dad, 'Bertha Musoni', 'f', 'Mwendamberi', { born:'1975' });
  fe.setMe(me);
  fe.setShape('');
  fe.clearFolds();
  return { fe, me, elder, a, b, b1, dad };
}
const onScreen = t => new Set(Object.keys(t.fe.layoutOf().persons));
const nm = (t, id) => t.fe.getState().people[id].name;

section('TAPPING A NAME LIFTS THAT PART OF THE TREE');
{
  const t = tree();
  eq('nothing picked, nothing lifted', t.fe.focusIds(), null);

  t.fe.pick(t.b);
  const ids = t.fe.focusIds();
  check('picking somebody lifts a part of it', !!ids, String(ids));
  check('them, and everyone below them',
        ids.has(t.b) && ids.has(t.b1), JSON.stringify([...ids].map(x => nm(t, x))));
  check('and the person they married, who stands beside them',
        [...ids].some(x => nm(t, x) === 'Baya’s wife'));
  check('and the parents they hang from', ids.has(t.elder));
  check('but not the brother’s family beside them',
        !ids.has(t.dad) && !ids.has(t.me), JSON.stringify([...ids].map(x => nm(t, x))));
}

section('AND NOTHING IS HIDDEN BY IT');
/* Which people are somebody's is only worth knowing against everybody else.
   Hiding the rest answers the question by deleting it. */
{
  const t = tree();
  const all = onScreen(t).size;
  t.fe.pick(t.b);
  eq('every pod is still on the screen', onScreen(t).size, all);
  eq('and the tree still holds everybody',
     Object.keys(t.fe.getState().people).length, 11);
}

section('a branch that is most of the tree is not a focus');
/* Setting four people back to lift a hundred and ninety-six says nothing at
   all, and would leave the whole tree looking faded for no reason. */
{
  const t = tree();
  t.fe.pick(t.elder);
  eq('the elder everybody descends from lifts nothing', t.fe.focusIds(), null);
}

section('and it can be turned off, and stays off');
{
  const t = tree();
  t.fe.pick(t.b);
  check('on by default', !!t.fe.focusIds());
  t.fe.setFocusLifts(false);
  eq('off when asked', t.fe.focusIds(), null);
  eq('written down on the device', t.fe.prefs.getItem('muti-baobab-focus'), 'off');
  t.fe.loadFocus();
  eq('and honoured on the next visit', t.fe.focusIds(), null);
  t.fe.setFocusLifts(true);
  check('and back on when asked again', !!t.fe.focusIds());
  eq('with nothing left in storage', t.fe.prefs.getItem('muti-baobab-focus'), null);
}

section('CLOSING A SECTOR SHUTS WHAT HANGS BELOW IT');
/* The fold used to be for families that married in and nothing else. It is
   the same act everywhere: a household with people below it is a sector. */
{
  const t = tree();
  const before = onScreen(t);
  t.fe.setLineFolded(t.b, true);
  const after = onScreen(t);
  const gone = [...before].filter(x => !after.has(x)).map(x => nm(t, x)).sort();
  eq('his nephews and their children go',
     gone, ['Great nephew', 'Nephew One', 'Nephew Two']);
}

section('but never the person it hangs off, nor their marriage');
/* Folding somebody away entirely would take a name off the screen with
   nothing left to open it again — the way back has to stay where the way in
   was. And a household with one partner missing is a picture of something
   that did not happen. */
{
  const t = tree();
  t.fe.setLineFolded(t.b, true);
  const shown = onScreen(t);
  check('he is still there to open it again', shown.has(t.b));
  check('and his wife is still beside him',
        [...shown].some(x => nm(t, x) === 'Baya’s wife'));
}

section('and the rest of the tree is untouched by it');
{
  const t = tree();
  t.fe.setLineFolded(t.b, true);
  const shown = onScreen(t);
  check('his brother’s family is all there',
        shown.has(t.a) && shown.has(t.dad) && shown.has(t.me));
  eq('and every record is still in the tree',
     Object.keys(t.fe.getState().people).length, 11);
}

section('AND IT OPENS AGAIN');
{
  const t = tree();
  const before = onScreen(t).size;
  t.fe.setLineFolded(t.b, true);
  check('something went', onScreen(t).size < before);
  t.fe.setLineFolded(t.b, false);
  eq('and everybody is back', onScreen(t).size, before);
}

section('TWO SECTORS CAN BE SHUT AT ONCE');
{
  const t = tree();
  t.fe.setLineFolded(t.b, true);
  t.fe.setLineFolded(t.dad, true);
  const shown = onScreen(t);
  check('neither branch is drawn',
        !shown.has(t.b1) && !shown.has(t.me), JSON.stringify([...shown].map(x => nm(t, x))));
  check('but both the people they hang off are',
        shown.has(t.b) && shown.has(t.dad));
  check('and so is the elder above them both', shown.has(t.elder));
}

section('AND A SHUT SECTOR IS STILL IN THE WORDS AND THE COUNT');
/* The same promise every narrowing in this app makes: the picture is
   smaller, the family is not. */
{
  const t = tree();
  t.fe.setLineFolded(t.b, true);
  eq('the tree holds all eleven', Object.keys(t.fe.getState().people).length, 11);
  eq('and the words still reckon through somebody behind the fold',
     (t.fe.kinTerms(t.me, t.b1).list[0] || {}).term !== undefined, true);
}

section('A SECTOR FOLD IS KEPT ON THE DEVICE, never sent');
{
  const t = tree();
  t.fe.setLineFolded(t.b, true);
  const written = t.fe.prefs.getItem('muti-baobab-folded');
  check('written down', !!written && written.indexOf(t.b) >= 0, String(written));
  eq('and nothing about it is waiting to be saved',
     t.fe.diffOps(t.fe.getState(), t.fe.getState()).length, 0);
}

section('THE POD CARRIES THE WAY IN AND THE WAY BACK');
{
  const t = tree();
  t.fe.pick(t.b);
  const html = t.fe.draw();
  check('a control on the person picked', /data-shut="/.test(html),
        (html.match(/data-shut="[^"]*"/g) || []).join(' '));
  check('saying what it will close, by name',
        /Close everything below Baya/.test(html),
        (html.match(/title="[^"]*"/g) || []).slice(0, 6).join(' | '));

  t.fe.setLineFolded(t.b, true);
  const shut = t.fe.draw();
  check('and once shut it counts what is behind it',
        /Open everything below Baya — 3 people/.test(shut),
        (shut.match(/title="Open[^"]*"/g) || []).join(' | '));
}

section('and only on the person picked, not on every pod in the tree');
/* A control on every pod is the tree taken over by its own furniture. */
{
  const t = tree();
  t.fe.pick(t.b);
  const html = t.fe.draw();
  const marks = (html.match(/data-shut="/g) || []).length;
  eq('exactly one', marks, 1);
}

report();
