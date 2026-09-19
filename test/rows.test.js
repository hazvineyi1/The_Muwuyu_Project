// Bringing an old tree up to the current rule.
//
// THE ASK: "update all trees to have the latest specs."
//
// Almost nothing needs updating, and that is worth stating because it is the
// reason this file is small. Which side of a row somebody stands on, which
// family is drawn first, every kin term, every house relation — all derived
// on every repaint, so every tree on the deployment is already drawing by the
// current rule with nothing migrated.
//
// The sibling row is the one exception, because it is RECORDED rather than
// derived. New children are placed by their year; rows entered before that
// are still in the order somebody typed them.
//
// AND THEY MAY BE RIGHT. The row is the family's own statement of seniority
// when there are no dates — it is what olderThan falls back on, and somebody
// may have arranged it by hand precisely because they knew something the
// dates do not say. So a blanket re-sort would overwrite the considered
// judgement of every family to fix the careless typing of some. It is
// offered, per row, only where the row and the dates contradict each other.
//
// What is asserted here is mostly the restraint: who does NOT move.

const { check, eq, section, report, loadFrontend } = require('./helpers');

const names = (fe, ids) => ids.map(i => (fe.getState().people[i] || {}).name || '?');
const rowOf = fe => Object.values(fe.getState().unions)[0].children;

/* An OLD tree: children sitting in the order they were typed, which is how
   every row entered before insertByAge looks. Built by writing the row
   directly, because grow() would now place them correctly and there would be
   nothing to repair. */
function oldTree(order){
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  const made = {};
  for (const [nm, yr] of [['Eldest', '1965'], ['Middle', '1972'], ['Youngest', '1980']]){
    made[nm] = fe.grow('child', baba, nm, 'm', 'Mwendamberi', { born: yr });
  }
  Object.values(fe.getState().unions)[0].children = order.map(n => made[n]);
  return { fe, made };
}

// ── finding the rows that disagree ─────────────────────────────────────────
section('a row already in birth order is not touched');
{
  const { fe } = oldTree(['Eldest', 'Middle', 'Youngest']);
  eq('nothing to do', fe.rowsOutOfOrder().length, 0);
  eq('and nothing is done', fe.sortAllRowsByAge(), 0);
  eq('the row is as it was', names(fe, rowOf(fe)), ['Eldest', 'Middle', 'Youngest']);
}

section('a row that contradicts its own dates is found and put right');
{
  const { fe } = oldTree(['Youngest', 'Eldest', 'Middle']);
  eq('one row', fe.rowsOutOfOrder().length, 1);
  eq('one fixed', fe.sortAllRowsByAge(), 1);
  eq('oldest first', names(fe, rowOf(fe)), ['Eldest', 'Middle', 'Youngest']);
  eq('and there is nothing left to fix', fe.rowsOutOfOrder().length, 0);
}

section('and the app stops reporting the conflict it just resolved');
{
  const { fe } = oldTree(['Youngest', 'Eldest', 'Middle']);
  check('it was reported', fe.seniorityConflicts().length > 0);
  fe.sortAllRowsByAge();
  eq('and is not any more', fe.seniorityConflicts().length, 0);
}

// ── the restraint, which is the point ──────────────────────────────────────
section('SOMEBODY WITH NO BIRTH YEAR DOES NOT MOVE');
/* The rule that makes this safe to offer at all. There is nothing to check an
   undated person's placement against, so moving them would be inventing a
   claim rather than correcting one — and their position in the row is the
   only statement of their seniority that exists. */
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  const y = fe.grow('child', baba, 'Youngest', 'm', 'Mwendamberi', { born:'1980' });
  const n = fe.grow('child', baba, 'No year', 'm', 'Mwendamberi', {});
  const e = fe.grow('child', baba, 'Eldest', 'm', 'Mwendamberi', { born:'1965' });
  Object.values(fe.getState().unions)[0].children = [y, n, e];

  eq('the row disagrees with the dates', fe.rowsOutOfOrder().length, 1);
  fe.sortAllRowsByAge();

  const row = names(fe, rowOf(fe));
  eq('the undated one is still in the middle, exactly where it was', row[1], 'No year');
  eq('and the dated two swapped around them', [row[0], row[2]], ['Eldest', 'Youngest']);
}

section('a row of entirely undated people is never touched');
// Nothing to check it against, so there is no such thing as it being wrong.
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  const a = fe.grow('child', baba, 'A', 'm', 'Mwendamberi', {});
  const b = fe.grow('child', baba, 'B', 'm', 'Mwendamberi', {});
  eq('not reported', fe.rowsOutOfOrder().length, 0);
  eq('not changed', fe.sortAllRowsByAge(), 0);
  eq('as entered', names(fe, rowOf(fe)), ['A', 'B']);
}

section('one dated person among the undated is not enough to reorder anything');
{
  const fe = loadFrontend();
  const baba = fe.addPerson('Baba', 'm', 'Mwendamberi', '1940', '');
  const a = fe.grow('child', baba, 'A', 'm', 'Mwendamberi', {});
  const dated = fe.grow('child', baba, 'Dated', 'm', 'Mwendamberi', { born:'1970' });
  eq('nothing to compare it with', fe.rowsOutOfOrder().length, 0);
  eq('nothing done', fe.sortAllRowsByAge(), 0);
}

// ── it is an edit like any other ───────────────────────────────────────────
section('it is undoable, because a family may disagree with the dates');
/* The arrows beat the dates by design — that is asserted in sides.test.js.
   This must therefore be a normal, reversible edit and not a migration the
   family cannot argue with. */
{
  const { fe } = oldTree(['Youngest', 'Eldest', 'Middle']);
  const before = names(fe, rowOf(fe));
  fe.sortAllRowsByAge();
  eq('the row was put in order', names(fe, rowOf(fe)), ['Eldest', 'Middle', 'Youngest']);
  check('undo goes back', fe.undo());
  eq('to exactly the row the family had', names(fe, rowOf(fe)), before);
}

section('sorting a row twice does nothing the second time');
{
  const { fe } = oldTree(['Youngest', 'Eldest', 'Middle']);
  eq('first pass fixes it', fe.sortAllRowsByAge(), 1);
  eq('second finds nothing', fe.sortAllRowsByAge(), 0);
}

section('every other family on the deployment is untouched by one family fixing theirs');
// One tree is one state. Stated because "update ALL trees" is what was asked,
// and the honest answer is that each family does their own — there is no
// deployment-wide rewrite of anybody's recorded seniority.
{
  const one = oldTree(['Youngest', 'Eldest', 'Middle']);
  const two = oldTree(['Youngest', 'Eldest', 'Middle']);
  one.fe.sortAllRowsByAge();
  eq('the first is fixed', names(one.fe, rowOf(one.fe)), ['Eldest', 'Middle', 'Youngest']);
  eq('the second is exactly as it was',
     names(two.fe, rowOf(two.fe)), ['Youngest', 'Eldest', 'Middle']);
}

report();
