// WHAT THE OTHERS HAVE DONE.
//
// "The collaboration layer."
//
// A tree that several relatives fill in across several countries, and the
// whole of the collaboration in the product was one line that appeared for
// six seconds and went: "Tsitsi changed the tree — 11 changes brought in."
// If you were asleep, at work, or simply looking at something else, you
// never found out. There was no way to ask.
//
// Every one of those changes has been recorded since the first migration —
// who did it, what they did, which person it was about, and when — and the
// server has served it all along on /changes. The product read it once to
// decide whether to refresh, and threw the rest away.
//
// Nothing here is new information. It is the information the app already
// had, shown to the people it belongs to, in their own terms rather than the
// model's: "Tsitsi added Baya Musoni", not "addPerson".

const { check, eq, section, report, loadFrontend } = require('./helpers');

function tree(){
  const fe = loadFrontend();
  const P = (n, s, t, b) => fe.addPerson(n, s, t, b, '');
  const gf = P('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  fe.setShape('');
  return { fe, me, gf, dad };
}
const ago = mins => new Date(Date.now() - mins * 60000).toISOString();

section('AN ACT IS READ BACK IN THE WORDS OF THE PERSON WHO DID IT');
/* Not "addPerson". Somebody who has just been handed a link to their
   family's tree is owed a sentence, not an operation name. */
{
  const t = tree();
  const said = op => t.fe.saidWhat({ op, entity_id:t.gf, payload:{} });
  eq('added', said('addPerson').verb, 'added');
  eq('corrected', said('updatePerson').verb, 'corrected');
  eq('took out of the tree', said('setAside').verb, 'took out of the tree');
  eq('put back', said('restore').verb, 'put back');
  eq('and a marriage is a marriage',
     t.fe.saidWhat({ op:'addPartner', payload:{} }).what, 'a marriage');
  eq('and a row put in birth order says so',
     t.fe.saidWhat({ op:'reorderChildren', payload:{} }).verb, 'put in birth order');
}

section('and it names the person, from the tree as it stands now');
/* The line is about a person, and a person’s name is whatever the family
   has since settled on — not whatever was typed the first time. */
{
  const t = tree();
  eq('the name as it is today',
     t.fe.saidWhat({ op:'addPerson', entity_id:t.gf, payload:{ name:'Chaitezvy' } }).what,
     'Chaitezvi Musoni');
}

section('and where the record has gone, it says so rather than inventing one');
{
  const t = tree();
  const said = t.fe.saidWhat({ op:'setAside', entity_id:'a person who is gone', payload:{} });
  eq('no name is made up', said.what, 'somebody no longer in the tree');
  const kept = t.fe.saidWhat({ op:'deletePerson', entity_id:'gone', payload:{ name:'Rudo Musoni' } });
  eq('but the record’s own words are used if it has any', kept.what, 'Rudo Musoni');
}

section('EVERY WORD THE APP CAN WRITE IS A WORD SOMEBODY CAN READ');
/* The ops vocabulary grows. A line that falls through to "changed" is not
   wrong, but it is the app failing to say what happened — so every op this
   app actually emits is checked to have its own sentence. */
{
  const t = tree();
  const OPS = ['addPerson', 'addUnion', 'addPartner', 'addChild', 'removePartner',
               'removeChild', 'reorderChildren', 'updatePerson', 'setAside',
               'restore', 'deletePerson', 'teachTerm', 'forgetTerm', 'affirmTerm',
               'setRoot', 'setVisibility', 'decideLink', 'proposeLink',
               'dismissDuplicate'];
  const dull = OPS.filter(op =>
    t.fe.saidWhat({ op, entity_id:t.gf, payload:{} }).verb === 'changed');
  eq('not one of them falls through to "changed"', dull, []);
}

section('WHEN, IN THE WORDS SOMEBODY WOULD USE');
{
  const t = tree();
  eq('just now', t.fe.whenWords(ago(0)), 'just now');
  eq('minutes', t.fe.whenWords(ago(20)), '20 minutes ago');
  eq('an hour', t.fe.whenWords(ago(70)), 'an hour ago');
  eq('hours', t.fe.whenWords(ago(60 * 5)), '5 hours ago');
  eq('yesterday', t.fe.whenWords(ago(60 * 30)), 'yesterday');
  eq('days', t.fe.whenWords(ago(60 * 24 * 3)), '3 days ago');
  check('and a date once it is far enough back',
        /^\d+ [A-Z]/.test(t.fe.whenWords(ago(60 * 24 * 40))),
        t.fe.whenWords(ago(60 * 24 * 40)));
  eq('nonsense in, nothing out', t.fe.whenWords('not a date'), '');
}

section('A RUN BY ONE PERSON ON ONE RECORD IS ONE LINE');
/* A name typed, then a year, then a mutupo is three changes and one thing
   that happened. Eleven lines saying "Tsitsi corrected Baya Musoni" is a
   record of the database, not of the family. */
{
  const t = tree();
  const changes = [
    { seq:1, op:'addPerson',    entity_id:t.gf, by:'Tsitsi', at:ago(5), payload:{} },
    { seq:2, op:'updatePerson', entity_id:t.gf, by:'Tsitsi', at:ago(5), payload:{} },
    { seq:3, op:'updatePerson', entity_id:t.gf, by:'Tsitsi', at:ago(4), payload:{} },
    { seq:4, op:'updatePerson', entity_id:t.gf, by:'Tsitsi', at:ago(4), payload:{} },
    { seq:5, op:'addPerson',    entity_id:t.dad, by:'Rudo',  at:ago(2), payload:{} }
  ];
  const lines = t.fe.newsLines(changes);
  eq('five changes, three lines', lines.length, 3);
  eq('newest first', lines[0].by, 'Rudo');
  eq('and the run is counted', lines[1].n, 3);
  check('a different person breaks the run',
        lines.every(l => l.n === 1 || l.by === 'Tsitsi'), JSON.stringify(lines));
}

section('and two people doing the same thing are never folded together');
{
  const t = tree();
  const lines = t.fe.newsLines([
    { seq:1, op:'updatePerson', entity_id:t.gf, by:'Tsitsi', at:ago(5), payload:{} },
    { seq:2, op:'updatePerson', entity_id:t.gf, by:'Rudo',   at:ago(4), payload:{} }
  ]);
  eq('two lines, two people', lines.map(l => l.by), ['Rudo', 'Tsitsi']);
}

section('SINCE YOU LAST LOOKED IS A FACT ABOUT A DEVICE');
/* Kept where the zoom and the folds are kept, and never sent. Two relatives
   reading the same tree have seen different amounts of it, and both are
   right. */
{
  const t = tree();
  t.fe.sharedNow();
  t.fe.headTo(40);
  t.fe.seenTo(0);
  eq('everything is new to begin with', t.fe.newsCount(), 40);

  t.fe.markSeen(40);
  eq('and nothing once it has been looked at', t.fe.newsCount(), 0);
  eq('written down on the device',
     t.fe.prefs.getItem('muti-baobab-seen'), '40');

  t.fe.headTo(52);
  eq('twelve more arrive', t.fe.newsCount(), 12);

  /* It only ever moves forward. A change log read out of order, or an older
     tab, must not make news that has been seen look unseen again. */
  t.fe.markSeen(30);
  eq('and a lower mark never winds it back', t.fe.newsCount(), 12);
}

section('and it is honoured on the next visit');
{
  const t = tree();
  t.fe.sharedNow();
  t.fe.prefs.setItem('muti-baobab-seen', '99');
  t.fe.loadSeen();
  t.fe.headTo(105);
  eq('six unseen, not a hundred and five', t.fe.newsCount(), 6);
}

section('and nonsense in there is not a broken tree');
{
  for (const junk of ['', 'not a number', '{}', '-4']){
    const t = tree();
    t.fe.sharedNow();
    t.fe.prefs.setItem('muti-baobab-seen', junk);
    t.fe.loadSeen();
    t.fe.headTo(7);
    const n = t.fe.newsCount();
    check(`${JSON.stringify(junk)} gives a sane count`, n >= 0 && n <= 7, String(n));
  }
}

section('A BROWSER KEEPING ITS OWN COPY HAS NOBODY TO COLLABORATE WITH');
/* No server, no other relatives, and therefore no count and no mark. */
{
  const t = tree();
  t.fe.headTo(40);
  t.fe.seenTo(0);
  eq('nothing to report', t.fe.newsCount(), 0);
}

section('AND THE DOOR OFFERS IT FIRST, because it is the first question');
/* On a tree several relatives are filling in, what anybody wants on opening
   it is what has happened since they were last here. */
{
  const t = tree();
  t.fe.sharedNow();
  const first = t.fe.hubRooms()[0];
  eq('at the top of the first group', first.rooms[0].id, 'news');
  check('and it says what it holds',
        /who made it, and when/.test(first.rooms[0].why), first.rooms[0].why);

  t.fe.headTo(12); t.fe.seenTo(0);
  check('with the count in its name',
        /· 12/.test(t.fe.hubRooms()[0].rooms[0].name),
        t.fe.hubRooms()[0].rooms[0].name);
}

section('and the mark on the door counts it with everything else waiting');
{
  const t = tree();
  t.fe.sharedNow();
  t.fe.headTo(5); t.fe.seenTo(0);
  eq('five things waiting', t.fe.hubMark(), 5);
  t.fe.markSeen(5);
  eq('and none once looked at', t.fe.hubMark(), 0);
}

report();
