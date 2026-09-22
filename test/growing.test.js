// WHERE THE TREE CAN GROW.
//
// "Think of a better way to see where and how to add more."
//
// There was a list called "Where the tree stops". It named the ends of the
// lines and then put you back on the tree to find them: no marks on the tree
// it was describing, and no way to answer anything from it. Half of "see
// where", and none of "how".
//
// WHAT THIS REFUSES TO BE. Not a completeness score, and not a list of what is
// missing from people's lives. A man with no children recorded is not a gap. A
// woman with no marriage recorded is not a gap. Those are lives, and an app
// that marks them incomplete is telling a family their relatives are
// unfinished records. The four things it does ask for are the four the APP
// cannot do its own job without — so every one of them is the app saying what
// IT cannot say, not the family being told what they have not done.
//
//   he or she      without it there is no Shona word for them at all
//   who came before the line stops, and nobody has said whether that is the end
//   the year        only where there are brothers and sisters to be ranked
//   the mutupo      only where somebody else in the tree carries one
//
// AND EVERY ROW IS ANSWERED WHERE IT STANDS, which is the whole of "how".

const { check, eq, section, report, loadFrontend } = require('./helpers');

function family(){
  const fe = loadFrontend();
  const gf = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1940' });
  fe.grow('partner', dad, 'Evelyn Mandaba', 'f', 'Moyondizvo', { born:'1954' });
  const noSex = fe.grow('child', dad, 'Bertha Musoni', '', '', {});
  const noYear = fe.grow('child', dad, 'Tendai Musoni', 'm', '', {});
  const me = fe.grow('child', dad, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(me);
  return { fe, gf, dad, noSex, noYear, me };
}
const needs = (fe, id) => fe.growthGaps().filter(g => g.id === id).map(g => g.need);

section('THE FOUR THINGS THE APP CANNOT DO ITS JOB WITHOUT');
{
  const t = family();
  eq('nobody has said he or she', needs(t.fe, t.noSex).includes('sex'), true);
  eq('the line stops at the eldest', needs(t.fe, t.gf).includes('line'), true);
  eq('no year, and brothers and sisters to be ranked against',
     needs(t.fe, t.noYear).includes('year'), true);
  eq('and no mutupo where everybody else has one',
     needs(t.fe, t.noYear).includes('mutupo'), true);
}

section('AND NOT ONE THING ABOUT ANYBODY’S LIFE');
/* The line this view will not cross. */
{
  const t = family();
  const kinds = new Set(t.fe.growthGaps().map(g => g.need));
  check('nobody is asked for children', !kinds.has('children'), [...kinds].join(','));
  check('nor for a marriage', !kinds.has('marriage'), [...kinds].join(','));
  eq('four kinds and no more', [...kinds].sort(), ['line', 'mutupo', 'sex', 'year']);
  /* Hazvineyi has no children and no marriage recorded and is not a gap. */
  eq('a man with neither is not asked for either', needs(t.fe, t.me), []);
}

section('A YEAR IS ONLY ASKED FOR WHERE IT WOULD DECIDE SOMETHING');
/* Mukoma and Munin'ina are read off the row. An only child has no row. */
{
  const fe = loadFrontend();
  const a = fe.addPerson('An elder', 'f', 'Nzou', '1930', '');
  const only = fe.grow('child', a, 'An only child', 'm', 'Nzou', {});
  fe.setMe(only);
  check('an only child is not asked for a year',
        !fe.growthGaps().some(g => g.id === only && g.need === 'year'),
        JSON.stringify(fe.growthGaps().map(g => g.need)));
  fe.grow('sibling', only, 'A brother', 'm', 'Nzou', { born:'1960' });
  check('and is, the moment there is somebody to be ranked against',
        fe.growthGaps().some(g => g.id === only && g.need === 'year'));
}

section('and a mutupo only where the family records them at all');
{
  const fe = loadFrontend();
  const a = fe.addPerson('An elder', 'f', '', '1930', '');
  const kid = fe.grow('child', a, 'Their child', 'm', '', { born:'1960' });
  fe.setMe(kid);
  check('a family that records no mitupo is never asked for one',
        !fe.growthGaps().some(g => g.need === 'mutupo'),
        JSON.stringify(fe.growthGaps().map(g => g.need)));
  fe.getState().people[a].totem = 'Nzou';
  check('and is, once one of them carries one',
        fe.growthGaps().some(g => g.id === kid && g.need === 'mutupo'));
}

section('SOMEBODY MARKED AS THE END OF THE LINE IS NOT A STOP');
/* That is the whole difference the mark exists to record: as far as anyone
   got, versus as far as anyone can go. */
{
  const t = family();
  check('the eldest is a stop to begin with', needs(t.fe, t.gf).includes('line'));
  t.fe.toggleRoot(t.gf);
  check('and is not, once somebody has vouched for it',
        !needs(t.fe, t.gf).includes('line'), JSON.stringify(needs(t.fe, t.gf)));
}

section('AND A MARK FITS THE POD IT IS WORN ON');
/* 132 pixels. "Who came before?" was cut off at "who came befo…", which is a
   mark that has stopped saying anything. */
{
  const t = family();
  const longest = Math.max(...t.fe.growthGaps().map(g => g.what.length));
  check('the longest of them is short', longest <= 14,
        JSON.stringify(t.fe.growthGaps().map(g => g.what)));
  check('and every one is still a question',
        t.fe.growthGaps().every(g => g.what.endsWith('?')),
        JSON.stringify(t.fe.growthGaps().map(g => g.what)));
  /* The whole question is not lost — it is in the heading the panel puts
     above them, and in the title on the mark itself. */
  check('with the whole of it kept in the reason',
        t.fe.growthGaps().every(g => g.why.length > 40));
}

section('THE MOST HELPLESS THING FIRST');
/* A pod has room for one line, so the one it wears has to be the one the app
   is most stuck without. */
{
  const t = family();
  const first = t.fe.growthFor(t.noSex);
  eq('he or she comes before a missing year', first.need, 'sex');
  eq('and it says so in the fewest words that answer it', first.what, 'he or she?');
}

section('THE TREE WEARS THE MARKS, AND ONLY WHILE THE VIEW IS ON');
/* A tree that always wore its gaps would be a tree wearing a list of chores,
   and this family has said twice that things appearing over their relatives
   are intrusive. */
{
  const t = family();
  t.fe.setGrowing(false);
  check('nothing on the tree by default', !/gapmark/.test(t.fe.draw()));
  t.fe.setGrowing(true);
  const html = t.fe.draw();
  check('and the marks appear when it is turned on', /gapmark/.test(html));
  check('saying what is wanted', /he or she\?/.test(html), html.slice(0, 300));
  check('with the pod marked as waiting rather than wrong',
        /class="pod[^"]*\bgap\b/.test(html));
  /* One line per pod, whatever else is missing about them. */
  const pods = (html.match(/class="pod[^"]*\bgap\b/g) || []).length;
  const marks = (html.match(/class="gapmark"/g) || []).length;
  eq('one mark per pod, not one per gap', marks, pods);
  t.fe.setGrowing(false);
}

section('THE ROOM ANSWERS EVERY KIND WHERE IT STANDS');
{
  const t = family();
  const room = t.fe.growthRoom();
  check('he or she is two buttons', /data-gsex="[^"]*\|f"/.test(room) && /data-gsex="[^"]*\|m"/.test(room), room.slice(0, 400));
  check('a stopped line offers the parents',  /data-gparent=/.test(room), room);
  check('and offers to mark it as the end',   /data-groot=/.test(room), room);
  check('a year is a box and a tick',         /data-gyear=/.test(room) && /data-gyeargo=/.test(room), room);
  check('a mutupo opens the card that knows this family’s own',
        /data-gcard=/.test(room), room);
  check('and every one of them can be looked at first', /data-gsee=/.test(room), room);
}

section('AND WHEN THERE IS NOTHING LEFT TO ASK, IT SAYS SO');
{
  const fe = loadFrontend();
  const a = fe.addPerson('An elder', 'f', 'Nzou', '1930', '');
  fe.toggleRoot(a);
  const kid = fe.grow('child', a, 'Their child', 'm', 'Nzou', { born:'1960' });
  fe.setMe(kid);
  eq('no gaps at all', fe.growthGaps(), []);
  eq('and no room to show', fe.growthRoom(), '');
}

report();
