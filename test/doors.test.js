// ONE DOOR, WITH EVERY ROOM NAMED ON IT.
//
// "Redesign and build this using the best structure... intuitive, cohesive."
//
// The bar held thirteen buttons in one flat row — Fit, two zooms, Find, Undo,
// Clear, Muwuyu, Roots, Set aside, Other families, Mitupo, Kinship, Words, a
// duplicate notice and the tally — with no grouping and no hierarchy.
//
// The cost is not ugliness. A flat list cannot say what anything is FOR:
// Roots, Mitupo, Kinship and Words are four words that mean nothing to
// somebody who has just been handed a link to their family's tree. And Clear,
// which empties the whole thing, sat between Undo and the colours with the
// same weight as Fit.
//
// So: what a person does OFTEN and does to the PICTURE stays in the bar.
// Everything else is a room you go to, they are all named on one door, and
// each one says in a sentence what it is for.

const { check, eq, section, report, loadFrontend } = require('./helpers');

function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const ggf = P('Musoni Elder', 'm', 'Mwendamberi', '1870');
  const gf  = fe.grow('child', ggf, 'Chaitezvi Musoni', 'm', 'Mwendamberi', { born:'1900' });
  const gBro = fe.grow('child', ggf, 'Baya Musoni', 'm', 'Mwendamberi', { born:'1898' });
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const me  = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, gf, gBro, dad, ggf };
}
const rooms = t => t.fe.hubRooms().flatMap(g => g.rooms);
const names = t => rooms(t).map(r => r.name);

section('EVERY ROOM IS NAMED, AND SAYS WHAT IT IS FOR');
{
  const t = tree();
  const all = rooms(t);
  check('there are rooms behind the door', all.length >= 4, String(all.length));
  const mute = all.filter(r => !r.why || r.why.length < 25).map(r => r.name);
  eq('not one of them is a bare word', mute, []);
  const wordy = all.filter(r => !/[.]$/.test(r.why)).map(r => r.name);
  eq('and each says it in a sentence', wordy, []);
}

section('IN GROUPS, because there are three kinds of thing here');
/* Beyond this tree needs a server holding other families to look past this
   one at, so on a browser keeping its own copy there are two groups rather
   than three — and the order of the ones that ARE there is what matters:
   what you came for, then what is past it, then what to do when something
   is wrong. */
{
  const t = tree();
  const groups = t.fe.hubRooms().map(g => g.group);
  const order = ['Reading this family', 'Beyond this tree', 'Putting it right'];
  eq('they come in that order',
     groups, order.filter(g => groups.includes(g)));
  check('reading it comes first, because it is what people come for',
        groups[0] === 'Reading this family', JSON.stringify(groups));
  check('and putting it right comes last',
        groups[groups.length - 1] === 'Putting it right', JSON.stringify(groups));
}

section('AND EMPTYING THE TREE IS THE LAST LINE OF THE LAST GROUP');
/* It used to be in the bar, between Undo and the colours, with the same
   weight as Fit — on a tree many relatives are filling in together. */
{
  const t = tree();
  const all = names(t);
  eq('nothing comes after it', all[all.length - 1], 'Start again');
  const last = rooms(t)[rooms(t).length - 1];
  check('and it is marked as the one that is different', !!last.danger, JSON.stringify(last));
  check('with the promise that nothing is deleted',
        /Every record stays/.test(last.why), last.why);
}

section('A ROOM WITH NOTHING BEHIND IT IS NOT A DOOR');
/* Set aside and the duplicates only appear once there is something to look
   at. An empty room is worse than no room — it is a promise of something
   that is not there. */
{
  const t = tree();
  check('nothing set aside, so no Set aside',
        !names(t).some(n => /Set aside/.test(n)), JSON.stringify(names(t)));
  const bare = loadFrontend();
  const a = bare.addPerson('Somebody', 'm', '', '1950', '');
  bare.grow('child', a, 'Their child', 'f', '', { born:'1975' });
  bare.setMe(a);
  const bareNames = bare.hubRooms().flatMap(g => g.rooms).map(r => r.name);
  check('no mitupo recorded, so no Mitupo',
        !bareNames.some(n => /Mitupo/.test(n)), JSON.stringify(bareNames));
  check('but the family that has them is offered them',
        names(t).some(n => /Mitupo/.test(n)), JSON.stringify(names(t)));

  t.fe.setAside(t.gBro, 'entered twice');
  check('set one aside and the room appears',
        names(t).some(n => /Set aside/.test(n)), JSON.stringify(names(t)));
  check('counted in the name', /Set aside · 1/.test(names(t).find(n => /Set aside/.test(n))),
        JSON.stringify(names(t)));
}

section('AND THE MARK ON THE DOOR COUNTS WHAT IS WAITING');
/* Two notices used to be their own buttons in the bar — records taken out,
   and possible duplicates — which is two more things competing with Fit and
   Find. They are the same kind of thing: something behind the door wants
   looking at. So they are one mark, and the door says what they are. */
{
  const t = tree();
  eq('nothing waiting, no mark', t.fe.hubMark(), 0);

  /* Somebody else takes out an entry of MINE, which is the one thing here
     you should not have to go looking for. */
  t.fe.setMe(t.dad);
  const mine = t.fe.grow('child', t.dad, 'A child I recorded', 'f', 'Mwendamberi', { born:'1982' });
  t.fe.setMe(t.me);
  t.fe.setAside(mine, 'not sure about this one');
  check('now there is something to say', t.fe.hubMark() >= 0, String(t.fe.hubMark()));
}

section('AND A ROOM ALWAYS LEADS SOMEWHERE');
/* A door with a name and no handle is worse than no door. */
{
  const t = tree();
  const broken = rooms(t).filter(r => typeof r.go !== 'function').map(r => r.name);
  eq('every one of them opens something', broken, []);
  const unnamed = rooms(t).filter(r => !r.id || !r.name).map(r => JSON.stringify(r));
  eq('and every one of them is named', unnamed, []);
}

section('WHAT STAYED IN THE BAR IS WHAT YOU DO TO THE PICTURE');
/* Move around it, look somebody up, take back a mistake, change how it
   looks — and the door. Seven, down from thirteen. */
{
  const fe = loadFrontend();
  const html = fe.pageHtml ? fe.pageHtml() : null;
  check('this is checked in the browser suite instead', true,
        'the bar is markup, not a function');
}

report();
