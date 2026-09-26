// WHAT NOBODY HAS CONFIRMED, AND WHAT THAT DOES TO A WORD.
//
// "Handle uncertainty explicitly. Hazvina kusimbiswa."
//
// Every record in this tree was stated as fact. A year read off a gravestone
// and a year an aunt half-remembers were the same row; a marriage everybody
// attended and one nobody can quite place were the same union. The app then
// read a Shona term off those links and put it in gold on a pod, with no way
// of knowing that one step of the reasoning was a guess.
//
// That is not a gap in the data — it is a gap in what could be SAID. A family
// filling in three generations from memory knows perfectly well which parts
// they are sure of, and there was nowhere to put it, so the honest answer had
// to be recorded as certainty or not recorded at all. Families have chosen
// the second and left people out.
//
// THREE STATES, AND THE NULL IS THE POINT, exactly as for the caption in
// migration 018. null is nobody having said, which is what every record
// entered before migration 019 holds and is NOT the same as confirmed; '' is
// a family marking a doubt and giving no reason; text is the doubt itself.
// This file exists mostly to hold that distinction down, because it is the
// one a later hand would collapse into a boolean.
//
// AND IT TRAVELS. A word is read off a chain of recorded links, so a chain
// with an unconfirmed link in it produces a word that is unconfirmed too, and
// the app says which link it was. That is the same rule the rest of this app
// keeps — it has never been willing to say a word nobody said — applied to
// the links underneath the words.
//
// NOTHING IS HIDDEN, MOVED OR DERIVED DIFFERENTLY. An unconfirmed person is
// in the tree, drawn, counted and related to everybody exactly as before.
// What changes is only what the app CLAIMS.

const { check, eq, section, report, freshPool, newTree, loadFrontend } = require('./helpers');
const { applyOps } = require('../db/ops');
const { fullTree } = require('../db/reads');

/*   Sydney Mandaba
       ├── Rudo Mandaba ═══ Joseph Chirwa
       │        └── Belinda Chirwa
       └── Tendai Mandaba

   Belinda is reading. Tendai is her Sekuru, through her mother Rudo, and the
   two of them are Sydney's children. */
function family(){
  const fe = loadFrontend();
  const sydney  = fe.addPerson('Sydney Mandaba', 'm', 'Moyondizvo', '1900', '');
  const rudo    = fe.grow('child', sydney, 'Rudo Mandaba', 'f', 'Moyondizvo', { born:'1932' });
  const joseph  = fe.grow('partner', rudo, 'Joseph Chirwa', 'm', 'Mangwenya', { born:'1930' });
  const belinda = fe.grow('child', rudo, 'Belinda Chirwa', 'f', 'Mangwenya', { born:'1958' });
  const tendai  = fe.grow('child', sydney, 'Tendai Mandaba', 'm', 'Moyondizvo', { born:'1936' });
  fe.setMe(belinda);
  return { fe, sydney, rudo, joseph, belinda, tendai };
}
const unionOf = (fe, a, b) => Object.values(fe.getState().unions).find(u =>
  (u.partners.includes(a) || u.children.includes(a)) &&
  (u.partners.includes(b) || u.children.includes(b)));

(async () => {

section('NOBODY HAVING SAID IS NOT THE SAME AS CONFIRMED');
/* The distinction the whole column exists for. A boolean cannot hold it, and
   a boolean is what a later hand will reach for. */
{
  const t = family();
  const p = t.fe.getState().people[t.rudo];
  check('a person entered before any of this has no answer on them',
        p.unsure === undefined || p.unsure === null, JSON.stringify(p.unsure));
  eq('and nothing is said about them', t.fe.doubtsAlong(t.belinda, t.tendai), []);
}

section('and a doubt with no reason is still a doubt');
/* '' is an answer: a family who are not sure and cannot say why have said
   something, and it must not read as silence. */
{
  const t = family();
  t.fe.getState().people[t.rudo].unsure = '';
  const said = t.fe.doubtsAlong(t.belinda, t.tendai);
  eq('it is reported', said.length, 1);
  eq('as the person it is about', said[0].id, t.rudo);
  eq('with no reason, because none was given', said[0].why, '');
  check('and the line still says it', /Hazvina kusimbiswa/.test(t.fe.doubtLine(t.belinda, t.tendai)));
}

section('A DOUBT ON THE WAY IS A DOUBT ABOUT THE WORD');
/* The point. Tendai is Sekuru because Rudo is Belinda's mother and Sydney's
   daughter. Doubt any one of those and Sekuru is a guess. */
{
  const t = family();
  const word = () => (t.fe.relationship(t.belinda, t.tendai) || {}).term;
  eq('the word is Sekuru', word(), 'Sekuru');

  t.fe.getState().people[t.rudo].unsure = 'Ambuya says she was Sydney’s, her sister is not sure';
  const said = t.fe.doubtsAlong(t.belinda, t.tendai);
  eq('the doubt in the middle is found', said.map(d => d.id), [t.rudo]);
  eq('and the word is not changed, because the link is still what it is', word(), 'Sekuru');

  const line = t.fe.doubtLine(t.belinda, t.tendai);
  check('the line names it in the family’s words',
        /Hazvina kusimbiswa/.test(line), line);
  check('and says who', /Rudo/.test(line), line);
  check('and what is doubted about them', /her sister is not sure/.test(line), line);
  check('and that the word above is only as sure as the family is',
        /as sure as the family is/.test(line), line);
}

section('and a doubt nowhere near the two of them is nobody’s business');
/* Joseph is Belinda's father and stands on no path between her and Tendai. */
{
  const t = family();
  t.fe.getState().people[t.joseph].unsure = 'nobody remembers his year';
  eq('it does not follow a word it has nothing to do with',
     t.fe.doubtsAlong(t.belinda, t.tendai), []);
  check('though it is still reported where it does belong',
        t.fe.doubtsAlong(t.belinda, t.joseph).length === 1);
}

section('A DOUBTED JOIN IS THE ONE THAT REACHES FURTHEST');
/* A person can be doubted about a year. A union is the link itself, and every
   Shona term downstream of it hangs on it being true. */
{
  const t = family();
  const u = unionOf(t.fe, t.sydney, t.rudo);
  check('there is a union to doubt', !!u);
  u.unsure = 'nobody living remembers whether Rudo was his';
  const said = t.fe.doubtsAlong(t.belinda, t.tendai);
  eq('it is found on the way', said.map(d => d.kind), ['link']);
  check('and named by the two people it joins',
        /Sydney/.test(said[0].between.join(' ')) && /Rudo/.test(said[0].between.join(' ')),
        said[0].between);
  const line = t.fe.doubtLine(t.belinda, t.tendai);
  check('and said as a join rather than as a person',
        /being joined/.test(line), line);
}

section('AND NOTHING IS HIDDEN, MOVED OR COUNTED DIFFERENTLY');
/* The promise the migration makes. A family who mark a doubt must not be
   punished by losing the person. */
{
  const t = family();
  const before = t.fe.people().length;
  const wordBefore = (t.fe.relationship(t.belinda, t.tendai) || {}).term;
  t.fe.getState().people[t.rudo].unsure = 'not sure';
  const u = unionOf(t.fe, t.sydney, t.rudo);
  u.unsure = 'not sure either';
  eq('everybody is still in the tree', t.fe.people().length, before);
  eq('and still related exactly as before',
     (t.fe.relationship(t.belinda, t.tendai) || {}).term, wordBefore);
  eq('and the way there is the same way',
     t.fe.linkChain(t.belinda, t.tendai).map(s => s.id).length, 3);
}

section('AND IT SURVIVES THE TRIP TO POSTGRES AND BACK');
/* A column the client fills in and the server drops is worse than no column:
   a family marks a doubt, sees it, and finds it gone the next morning. */
{
  const pool = await freshPool();
  const treeId = await newTree(pool, 'unsure');
  await applyOps(pool, treeId, [
    { op:'addPerson', ref:'$a', name:'Sydney Mandaba', sex:'m' },
    { op:'addPerson', ref:'$b', name:'Rudo Mandaba', sex:'f',
      unsure:'Ambuya says 1932, her sister says 1935' },
    { op:'addUnion', ref:'$u' },
    { op:'addPartner', unionId:'$u', personId:'$a' },
    { op:'addChild', unionId:'$u', personId:'$b' }
  ], 'test');

  const tree = await fullTree(pool, treeId);
  const rudo = tree.people.find(p => /Rudo/.test(p.name));
  const sydney = tree.people.find(p => /Sydney/.test(p.name));
  eq('the reason comes back exactly as it went',
     rudo.unsure, 'Ambuya says 1932, her sister says 1935');
  check('and a person nobody said anything about comes back with null',
        sydney.unsure === null, JSON.stringify(sydney.unsure));

  await applyOps(pool, treeId, [
    { op:'setUnsure', unionId:tree.unions[0].id, unsure:'' }
  ], 'test');
  const after = await fullTree(pool, treeId);
  eq('a doubt on a join with no reason is stored as the answer it is',
     after.unions[0].unsure, '');

  await applyOps(pool, treeId, [
    { op:'setUnsure', unionId:tree.unions[0].id, unsure:null },
    { op:'updatePerson', id:rudo.id, unsure:null }
  ], 'test');
  const lifted = await fullTree(pool, treeId);
  check('and a family who have since asked an elder can take it off again',
        lifted.unions[0].unsure === null &&
        lifted.people.find(p => /Rudo/.test(p.name)).unsure === null,
        JSON.stringify([lifted.unions[0].unsure,
                        lifted.people.find(p => /Rudo/.test(p.name)).unsure]));
  await pool.end();
}

report();
})();
