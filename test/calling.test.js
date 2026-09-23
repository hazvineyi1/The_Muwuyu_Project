// What a side of the family is CALLED, and who gets to say.
//
// "How was this name generated and it should be editable or removable."
//
// Sent with a photograph of a pod wearing a gold pill — BOLATIWA — under the
// birth year, on a woman whose own name is Mliswa. Nobody had typed that
// word anywhere. The page had counted it: every person in her line, the last
// word of each of their names, and whichever word most of them carried
// became the caption.
//
// The count is a reasonable default and is kept as one. What it could not do
// was be wrong in public with no way to answer back — so this file holds
// both halves: the rule that produces the guess, and the three answers a
// family can give instead.
//
//   NULL   nobody has said — count the surnames
//   ''     somebody said "put no name on this side", which is an ANSWER
//   text   this is what we call ourselves
//
// The middle one is why the column is nullable; see migration 018. A schema
// that stores '' as "unset" cannot record a family asking for no caption,
// which is exactly what was asked for here.

const { check, eq, section, report, freshPool, newTree, loadFrontend } = require('./helpers');
const { applyOps } = require('../db/ops');
const { fullTree } = require('../db/reads');

/* Two lines and a marriage between them, which is the only arrangement that
   puts a caption on screen at all — a tree of one family has nothing to tell
   apart.

     Chaitezvi Musoni            Jairos Bolatiwa ═ Tsitsi Bolatiwa
            │                                  │
      Sydney Musoni ═══════════════════ Nomhle Mliswa
            │
     Musekiwa Musoni

   Nomhle married in. Her mother's people are the Bolatiwa line, and the
   caption on that line is the word this whole file is about. */
function tree(){
  const fe = loadFrontend();
  const gf  = fe.addPerson('Chaitezvi Musoni', 'm', 'Mwendamberi', '1900', '');
  const dad = fe.grow('child', gf, 'Sydney Musoni', 'm', 'Mwendamberi', { born:'1938' });
  const mum = fe.grow('partner', dad, 'Nomhle Mliswa', 'f', 'Shumba', { born:'1942' });
  const gm  = fe.grow('parent', mum, 'Tsitsi Bolatiwa', 'f', 'Shumba', { born:'1915' });
  const gd  = fe.grow('partner', gm, 'Jairos Bolatiwa', 'm', 'Nzou', { born:'1910' });
  const me  = fe.grow('child', dad, 'Musekiwa Musoni', 'm', '', { born:'1968' });
  fe.setMe(me);
  return { fe, gf, dad, mum, gm, gd, me };
}
const lineOf = (fe, id) => fe.familyLines().lines.find(l => l.members.includes(id));

(async () => {

section('WHERE THE WORD ON THE POD COMES FROM');
/* It is counted, and nothing on the screen ever said so. The rule: the last
   word of every member's name, and the commonest one wins. */
{
  const t = tree();
  const musoni = lineOf(t.fe, t.gf);
  eq('a line is named by the surname most of it carries', musoni.name, 'Musoni');
  eq('and the count is kept beside it, for the panel to offer back',
     musoni.counted, 'Musoni');
  check('nobody has said otherwise', !musoni.saidBy);
}

section('and it is not always the name the person wearing it answers to');
/* The case in the photograph. The caption sits on the head of the line, and
   the head is not always of the line's commonest surname — a woman who kept
   her father's name heading a line of people who carry another. It is
   deliberate: naming the line after her would file her whole family under a
   name none of them use. It is still a surprise, and that is why the word
   needs to be answerable. */
{
  const t = tree();
  const bolatiwa = lineOf(t.fe, t.gd);
  eq('the line is called Bolatiwa', bolatiwa.name, 'Bolatiwa');
  const head = t.fe.getState().people[bolatiwa.root].name;
  check('and the caption sits on the head of it', /Bolatiwa/.test(head), head);
}

section('A FAMILY CAN SAY WHAT THEY CALL THEMSELVES');
{
  const t = tree();
  const before = lineOf(t.fe, t.gd);
  t.fe.getState().people[before.root].house = 'Bolatiwa of Mhondoro';
  t.fe.forgetLines();
  const after = lineOf(t.fe, t.gd);
  eq('the word they gave is the word on the pod', after.name, 'Bolatiwa of Mhondoro');
  eq('and the count is still there to go back to', after.counted, 'Bolatiwa');
  eq('and the page knows whose answer it is', after.saidBy, before.root);
}

section('and can ask for no name on that side at all');
/* The answer the old shape could not hold. '' is not "unset" — it is a
   family saying they do not want a word there, and the caption is not
   drawn. The pod render tests truthiness, so an empty name draws nothing. */
{
  const t = tree();
  const line = lineOf(t.fe, t.gd);
  t.fe.getState().people[line.root].house = '';
  t.fe.forgetLines();
  eq('the name is empty', lineOf(t.fe, t.gd).name, '');
  check('which is not the same as never having answered',
        lineOf(t.fe, t.gd).saidBy === line.root);
}

section('and can put it back the way it was');
{
  const t = tree();
  const line = lineOf(t.fe, t.gd);
  t.fe.getState().people[line.root].house = 'Something else';
  t.fe.forgetLines();
  t.fe.getState().people[line.root].house = null;
  t.fe.forgetLines();
  const back = lineOf(t.fe, t.gd);
  eq('the counted name is back', back.name, 'Bolatiwa');
  check('and nothing is recorded as said', !back.saidBy);
}

section('REMEMBERING ONE MORE GENERATION DOES NOT LOSE THE NAME');
/* Heads move. Record a father above the person a line came down from and
   the line is now his — so an answer kept only on the old head would vanish
   the moment a family traced one step further back, which is the thing this
   app exists to encourage. The lookup walks down from the head, nearest
   first, so the answer survives the very act that would have destroyed it. */
{
  const t = tree();
  const line = lineOf(t.fe, t.gd);
  const wasHead = line.root;
  t.fe.getState().people[wasHead].house = 'Bolatiwa of Mhondoro';
  t.fe.forgetLines();
  t.fe.grow('parent', wasHead, 'Muchineripi Bolatiwa', 'm', 'Nzou', { born:'1880' });
  t.fe.forgetLines();
  const now = lineOf(t.fe, t.gd);
  check('the head has moved', now.root !== wasHead, { was:wasHead, now:now.root });
  eq('and the name the family gave is still the name', now.name, 'Bolatiwa of Mhondoro');
}

section('THE THREE ANSWERS SURVIVE A TRIP TO THE SERVER');
/* Which is the whole difference between a caption and a preference. A word
   one relative typed has to be the word every other relative sees. */
{
  const pool = await freshPool();
  const treeId = await newTree(pool, 'calling');
  const ops = o => applyOps(pool, treeId, o, 'tester');

  const made = await ops([{ op:'addPerson', ref:'$a', name:'Tsitsi Bolatiwa', sex:'f' }]);
  const id = made.refs.$a;

  const houseOf = async () => {
    const t = await fullTree(pool, treeId);
    return t.people.find(p => p.id === id).house;
  };

  eq('a new person has no answer on them', await houseOf(), null);

  await ops([{ op:'updatePerson', id, house:'Bolatiwa of Mhondoro' }]);
  eq('a name given comes back', await houseOf(), 'Bolatiwa of Mhondoro');

  await ops([{ op:'updatePerson', id, house:'' }]);
  eq('"put no name here" comes back as an empty answer, not as nothing',
     await houseOf(), '');

  await ops([{ op:'updatePerson', id, house:null }]);
  eq('and clearing it goes back to nobody having said', await houseOf(), null);

  /* The silence case, and it is the one a careless loop breaks: an op that
     says nothing about the caption must not wipe it. */
  await ops([{ op:'updatePerson', id, house:'Bolatiwa of Mhondoro' }]);
  await ops([{ op:'updatePerson', id, name:'Tsitsi Bolatiwa Nyoni' }]);
  eq('an edit that does not mention the name leaves it alone',
     await houseOf(), 'Bolatiwa of Mhondoro');

  await pool.end();
}

section('AND THE PAGE SENDS THE DIFFERENCE, RATHER THAN FLATTENING IT');
/* diffOps compares with ===, not with `|| ''`. Collapsing null and '' here
   would send nothing when a family asked for no caption, and the one answer
   that needed a new column would be the one that never left the browser. */
{
  const t = tree();
  const line = lineOf(t.fe, t.gd);
  const synced = JSON.parse(JSON.stringify(t.fe.getState()));
  t.fe.getState().people[line.root].house = '';
  const ops = t.fe.diffOps(synced, t.fe.getState())
    .filter(o => o.op === 'updatePerson' && o.id === line.root);
  eq('one edit is sent', ops.length, 1);
  eq('and it carries the empty answer', ops[0].house, '');

  const synced2 = JSON.parse(JSON.stringify(t.fe.getState()));
  t.fe.getState().people[line.root].house = null;
  const back = t.fe.diffOps(synced2, t.fe.getState())
    .filter(o => o.op === 'updatePerson' && o.id === line.root);
  eq('going back to the count is sent too', back.length, 1);
  eq('as a null, which is what the column means by "nobody has said"',
     back[0].house, null);
}

report();
})().catch(e => { console.error('\nHARNESS ERROR:', e); process.exit(1); });
