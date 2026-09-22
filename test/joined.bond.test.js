// HOW TWO PEOPLE ARE JOINED, WHEN IT IS NOT SIMPLY "MARRIED".
//
// "Some people have children with partners but were never married, others are
//  married and others are divorced and others are deceased."
//
// Every union in this project meant one thing. The word "married" was on the
// heading, in the kinship term, and in the sentence the app said when one was
// made — so a woman whose family never paid roora for her was called somebody's
// wife by the app, and a man divorced in 1994 was still recorded as his
// ex-wife's husband thirty years later.
//
// FOUR STATES, AND THE FOURTH IS SILENCE. Every union already recorded is in
// it, because nobody HAS said: they were entered when the app could only hear
// one answer. Defaulting them to "married" would put words in the mouth of
// every family on the deployment, so the default says nothing and the app goes
// on behaving exactly as it did.
//
// AND DEATH IS NOT ONE OF THEM. It is already recorded, on the person, in the
// year they died. A second copy on the marriage would go stale the moment a
// date was corrected, and would have to be kept by hand on the day a family is
// least able to. So it is derived — the way every kinship word here is.

const { check, eq, rejects, section, report, loadFrontend, freshPool, newTree } = require('./helpers');
const { applyOps } = require('../db/ops');
const reads = require('../db/reads');

function couple(opts = {}){
  const fe = loadFrontend();
  const man = fe.addPerson('Sydney Musoni', 'm', 'Mwendamberi', '1940', opts.hisDeath || '');
  const woman = fe.grow('partner', man, 'Evelyn Mandaba', 'f', 'Moyondizvo',
                        { born:'1954', died: opts.herDeath || '' });
  const kid = fe.grow('child', man, 'Hazvineyi Musoni', 'm', 'Mwendamberi', { born:'1979' });
  fe.setMe(man);
  const u = fe.getState().unions[
    Object.keys(fe.getState().unions).find(k =>
      fe.getState().unions[k].partners.includes(man) &&
      fe.getState().unions[k].partners.includes(woman))];
  return { fe, man, woman, kid, u };
}

section('A JOIN NOBODY HAS SPOKEN ABOUT SAYS NOTHING, AND BEHAVES AS IT ALWAYS DID');
/* The state every couple already in every tree is in. If this changes, the
   app has quietly demoted somebody's marriage because a column was added. */
{
  const t = couple();
  eq('no bond recorded', t.u.bond, '');
  eq('and no line claiming one', t.fe.bondLine(t.u, t.man), '');
  const r = t.fe.relationship(t.man, t.woman);
  eq('the word is the one it has always been', r.term, 'Mukadzi');
  check('and the reason too', /husband or wife/.test(r.why), JSON.stringify(r));
}

section('MARRIED IS SAID BECAUSE SOMEBODY SAID IT');
{
  const t = couple();
  check('it takes', t.fe.setBond(t.u.id, 'married'));
  eq('and reads plainly', t.fe.bondLine(t.u, t.man), 'Married');
  eq('with the word', t.fe.relationship(t.man, t.woman).term, 'Mukadzi');
}

section('TOGETHER KEEPS THE WORD AND DROPS THE CLAIM');
/* "Mukadzi wangu" is what a great many people say about a partner they did
   not marry, and an app from outside the language is in no position to tell a
   family they are speaking it wrong. What it can stop doing is asserting the
   marriage. */
{
  const t = couple();
  t.fe.setBond(t.u.id, 'together');
  eq('the line says what it is', t.fe.bondLine(t.u, t.man), 'Together, never married');
  const r = t.fe.relationship(t.man, t.woman);
  eq('the word stands', r.term, 'Mukadzi');
  check('the sentence does not claim a marriage',
        !/husband or wife/.test(r.why) && /not said you married/.test(r.why), r.why);
  check('and it has a shape of its own, so a family can teach their word',
        /^bond:together:/.test(r.shape), r.shape);
}

section('PARTED DOES NOT KEEP THE WORD');
/* "Your wife" about a woman somebody divorced is wrong in any language, and
   there is no one Shona word for it every family would accept. Silence and a
   plain sentence beat a wrong word — this project has always held that. */
{
  const t = couple();
  t.fe.setBond(t.u.id, 'parted');
  eq('the line says it', t.fe.bondLine(t.u, t.man), 'Married, then parted');
  const r = t.fe.relationship(t.man, t.woman);
  eq('no word is asserted', r.term, null);
  check('the fact is', /you were married, and parted/.test(r.why), r.why);
  check('and the shape is offered to be taught', /^bond:parted:/.test(r.shape), r.shape);
}

section('and the children of a marriage that ended are untouched by its ending');
{
  const t = couple();
  t.fe.setBond(t.u.id, 'parted');
  eq('he is still his father', t.fe.relationship(t.kid, t.man).term, 'Baba');
  eq('and she is still his mother', t.fe.relationship(t.kid, t.woman).term, 'Amai');
  eq('and nobody is floating', t.fe.adrift(), []);
}

section('DEATH IS READ OFF THE PERSON, NOT STORED ON THE MARRIAGE');
{
  const t = couple({ herDeath:'1998' });
  t.fe.setBond(t.u.id, 'married');
  eq('the line carries it', t.fe.bondLine(t.u, t.man), 'Married, until Evelyn died in 1998');
  eq('and the year comes from her record', t.fe.widowedIn(t.u, t.man), '1998');
  const r = t.fe.relationship(t.man, t.woman);
  eq('a late wife is still a wife', r.term, 'Mukadzi');
  check('and the sentence says when', /died in 1998/.test(r.why), r.why);
}

section('and correcting the year corrects the marriage, because it was never copied');
{
  const t = couple({ herDeath:'1998' });
  t.fe.setBond(t.u.id, 'married');
  t.fe.getState().people[t.woman].died = '1999';
  eq('the line follows', t.fe.bondLine(t.u, t.man), 'Married, until Evelyn died in 1999');
  t.fe.getState().people[t.woman].died = '';
  eq('and so does taking it back', t.fe.bondLine(t.u, t.man), 'Married');
}

section('PRESSING THE ANSWER ALREADY GIVEN IS HOW IT IS UNSAID');
{
  const t = couple();
  t.fe.setBond(t.u.id, 'married');
  t.fe.setBond(t.u.id, '');
  eq('back to nobody having said', t.u.bond, '');
  eq('and the word goes back to what it was',
     t.fe.relationship(t.man, t.woman).term, 'Mukadzi');
}

section('and nothing outside the four is ever recorded');
{
  const t = couple();
  t.fe.setBond(t.u.id, 'divorced');           // the word a person would reach for
  eq('a value that is not one of them records nothing', t.u.bond, '');
  eq('the three that are allowed', t.fe.BONDS, ['married', 'together', 'parted']);
}

section('THE CARD ASKS, AND SAYS WHAT EACH ANSWER MEANS');
{
  const t = couple();
  const html = t.fe.marriageBlock(t.man);
  check('it is no longer headed "Married"', !/<p class="lbl">Married<\/p>/.test(html), html.slice(0, 120));
  check('it asks who they are joined to', /Joined to/.test(html), html.slice(0, 120));
  for (const w of ['Married', 'Together', 'Parted'])
    check(`${w} is offered`, new RegExp(`>${w}</button>`).test(html), html.slice(0, 400));
  check('and while nobody has said, it says that',
        /Nobody has said how/.test(html), html);
  check('the way out of the join altogether is still there',
        /data-unmarry=/.test(html), html);
  check('and what "Together" and "Parted" mean is spelled out',
        /did not marry/.test(html) && /marriage that ended/.test(html), html);
}

section('and once said, the card says it back');
{
  const t = couple({ herDeath:'1998' });
  t.fe.setBond(t.u.id, 'parted');
  check('parted', /Married, then parted/.test(t.fe.marriageBlock(t.man)));
  t.fe.setBond(t.u.id, 'married');
  check('and a widower is told so without being asked twice',
        /Married, until Evelyn died in 1998/.test(t.fe.marriageBlock(t.man)));
}

section('THE WOOD BETWEEN THEM SAYS IT TOO');
/* Nobody should have to open a card to see that a marriage ended. */
{
  const t = couple();
  check('nothing claimed while nobody has said',
        !/class="bond[^"]*is-/.test(t.fe.treeSvg()), 'a bond was classed before anybody said');
  t.fe.setBond(t.u.id, 'married');
  check('whole wood for a marriage', /class="bond[^"]*is-married/.test(t.fe.treeSvg()));
  t.fe.setBond(t.u.id, 'together');
  check('and its own for a couple who did not marry',
        /class="bond[^"]*is-together/.test(t.fe.treeSvg()));
  t.fe.setBond(t.u.id, 'parted');
  check('and broken wood for a marriage that ended',
        /class="bond[^"]*is-parted/.test(t.fe.treeSvg()));
}

section('AND IT TRAVELS TO THE SERVER AS ITS OWN OP');
{
  const t = couple();
  const before = JSON.parse(JSON.stringify(t.fe.getState()));
  t.fe.setBond(t.u.id, 'parted');
  const ops = t.fe.diffOps(before, t.fe.getState());
  const mine = ops.filter(o => o.op === 'setBond');
  eq('one op', mine.length, 1);
  eq('naming the union', mine[0].unionId, t.u.id);
  eq('and what was said', mine[0].bond, 'parted');
  check('and nothing else was disturbed',
        ops.length === 1, JSON.stringify(ops.map(o => o.op)));
}

// ── and the same thing on the server, which is where it has to survive ─────
(async () => {
  const pool = await freshPool();
  const tree = await newTree(pool, 'bonds');
  const ops = o => applyOps(pool, tree, o, 'tester');

  const made = await ops([
    { op:'addPerson', ref:'$he', name:'Sydney Musoni', sex:'m', born:'1940' },
    { op:'addPerson', ref:'$she', name:'Evelyn Mandaba', sex:'f', born:'1954' },
    { op:'addUnion', ref:'$u' },
    { op:'addPartner', unionId:'$u', personId:'$he' },
    { op:'addPartner', unionId:'$u', personId:'$she' }
  ]);
  const u = made.refs['$u'];

  section('A UNION ARRIVES SAYING NOTHING');
  {
    const { rows } = await pool.query('SELECT bond FROM unions WHERE id = $1', [u]);
    eq('the default is silence, not a marriage', rows[0].bond, '');
  }

  section('AND WHAT IS SAID IS KEPT, AND COMES BACK');
  {
    await ops([{ op:'setBond', unionId:u, bond:'parted' }]);
    const { rows } = await pool.query('SELECT bond FROM unions WHERE id = $1', [u]);
    eq('stored', rows[0].bond, 'parted');
    const tr = await reads.fullTree(pool, tree);
    const back = tr.unions.find(x => x.id === u);
    eq('and read back to the page', back.bond, 'parted');
  }

  section('and it can be unsaid');
  {
    await ops([{ op:'setBond', unionId:u, bond:'' }]);
    const { rows } = await pool.query('SELECT bond FROM unions WHERE id = $1', [u]);
    eq('back to nobody having said', rows[0].bond, '');
  }

  section('NOTHING OUTSIDE THE THREE IS EVER WRITTEN');
  /* Not because a bad value is likely from this app's own page, but because a
     free-text status would drift into forty spellings of "divorced" across one
     deployment and nothing derived from it could be trusted again. */
  {
    await rejects('the word a person would reach for is refused by name', () =>
      ops([{ op:'setBond', unionId:u, bond:'divorced' }]), { status: 400 });
    await rejects('and so is anything else', () =>
      ops([{ op:'setBond', unionId:u, bond:'widowed' }]), { status: 400 });
    const { rows } = await pool.query('SELECT bond FROM unions WHERE id = $1', [u]);
    eq('and the refusal changed nothing', rows[0].bond, '');
  }

  section('AND THE DATABASE ITSELF WILL NOT HOLD ONE');
  /* The op checks, and so does the table. Two doors on the same rule, because
     the migration script and anything written later do not go through the op. */
  {
    let stopped = false;
    try { await pool.query('UPDATE unions SET bond = $2 WHERE id = $1', [u, 'separated']); }
    catch (e) { stopped = /unions_bond_known/.test(e.message) || e.code === '23514'; }
    check('a direct write of an unknown bond is refused', stopped);
  }

  await pool.end();
  report();
})();
