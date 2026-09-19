// 014: every sibling row on the deployment, forced into birth order.
//
// This rewrites recorded data belonging to every family, without asking any
// of them. It was asked for after the cost was put in writing, and what this
// file exists to prove is that the cost is exactly what was described and no
// larger:
//
//   * only people with a birth year move
//   * set-aside people are not disturbed
//   * equal years keep the order the family had
//   * every moved row is recorded first, so the undo really works
//   * families' open browsers are told, or the migration silently loses
//
// It runs the migration by hand against a database migrated to 013, because
// the ordinary suite starts from an empty database where there is nothing to
// re-sort and the migration would prove nothing.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { check, eq, section, report } = require('./helpers');

const M = d => fs.readFileSync(path.join(__dirname, '..', 'migrations', d), 'utf8');
const upTo = n => fs.readdirSync(path.join(__dirname, '..', 'migrations'))
  .filter(f => f.endsWith('.sql') && Number(f.slice(0, 3)) <= n).sort();

(async () => {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  const db = new Client({ connectionString: url });
  await db.connect();

  // Everything up to 013 — the deployment as it stood before this change.
  for (const f of upTo(13)) await db.query(M(f));

  const tree = async name => (await db.query(
    `INSERT INTO trees (name) VALUES ($1) RETURNING id`, [name])).rows[0].id;
  const person = async (t, name, born) => (await db.query(
    `INSERT INTO people (tree_id, name, born) VALUES ($1, $2, $3) RETURNING id`,
    [t, name, born || ''])).rows[0].id;
  const union = async t => (await db.query(
    `INSERT INTO unions (tree_id) VALUES ($1) RETURNING id`, [t])).rows[0].id;
  const child = async (u, p, order) => db.query(
    `INSERT INTO union_children (person_id, union_id, birth_order) VALUES ($1, $2, $3)`,
    [p, u, order]);
  const rowOf = async u => (await db.query(
    `SELECT p.name FROM union_children uc JOIN people p ON p.id = uc.person_id
      WHERE uc.union_id = $1 ORDER BY uc.birth_order`, [u])).rows.map(r => r.name);

  // ── one family typed in backwards ────────────────────────────────────────
  const t1 = await tree('the Musoni family');
  const u1 = await union(t1);
  await child(u1, await person(t1, 'Youngest', '1980'), 0);
  await child(u1, await person(t1, 'Eldest', '1965'), 1);
  await child(u1, await person(t1, 'Middle', '1972'), 2);

  // ── one family with gaps in it ───────────────────────────────────────────
  const t2 = await tree('the Moyo family');
  const u2 = await union(t2);
  await child(u2, await person(t2, 'Late', '1990'), 0);
  await child(u2, await person(t2, 'No year', ''), 1);
  const asideId = await person(t2, 'Set aside, 1930', '1930');
  await child(u2, asideId, 2);
  await child(u2, await person(t2, 'Early', '1970'), 3);
  await db.query(`UPDATE people SET aside_at = clock_timestamp(), aside_by = 'x',
                  aside_why = 'testing' WHERE id = $1`, [asideId]);

  // ── one family already right, which must not be touched at all ───────────
  const t3 = await tree('the Nyoni family');
  const u3 = await union(t3);
  await child(u3, await person(t3, 'First', '1960'), 0);
  await child(u3, await person(t3, 'Second', '1964'), 1);

  // ── one family where the years cannot decide ─────────────────────────────
  const t4 = await tree('the Chirwa family');
  const u4 = await union(t4);
  await child(u4, await person(t4, 'Twin A', '1975'), 0);
  await child(u4, await person(t4, 'Twin B', '1975'), 1);

  const before3 = await rowOf(u3);
  const before4 = await rowOf(u4);

  // ── and now the forced sort ──────────────────────────────────────────────
  await db.query('BEGIN');
  await db.query(M('014_sibling_rows_by_year.sql'));
  await db.query('COMMIT');

  section('A ROW TYPED IN BACKWARDS IS PUT RIGHT');
  eq('oldest first', await rowOf(u1), ['Eldest', 'Middle', 'Youngest']);

  section('NOBODY WITHOUT A YEAR MOVES, AND NEITHER DOES ANYBODY SET ASIDE');
  /* The two exclusions the migration promised. The dated pair swap with each
     other; the undated person and the set-aside person keep the exact slots
     they held, so the row closes back up around them unchanged. */
  const row2 = await rowOf(u2);
  eq('the dated two swapped', [row2[0], row2[3]], ['Early', 'Late']);
  eq('the undated one has not moved', row2[1], 'No year');
  eq('nor has the set-aside one', row2[2], 'Set aside, 1930');
  check('even though its year would have put it first',
        row2[0] !== 'Set aside, 1930', row2.join(' | '));

  section('a row already in birth order is left completely alone');
  eq('unchanged', await rowOf(u3), before3);

  section('EQUAL YEARS KEEP THE ORDER THE FAMILY HAD');
  // Where the years cannot decide, the row still does. A sort that reshuffled
  // twins would be destroying the only information there is about them.
  eq('untouched', await rowOf(u4), before4);

  // ── the way back ─────────────────────────────────────────────────────────
  section('EVERY MOVED ROW WAS RECORDED BEFORE IT MOVED');
  /* Five: all three of the first family (each one lands in a different slot),
     and the two dated children of the second who swap around the undated and
     the set-aside pair sitting between them. */
  const kept = await db.query(`SELECT count(*)::int AS n FROM sibling_order_before_014`);
  eq('five people moved, five recorded', kept.rows[0].n, 5);

  section('and rows that did NOT move were not recorded');
  // Otherwise the undo would claim to restore things it never touched.
  const strays = await db.query(
    `SELECT count(*)::int AS n FROM sibling_order_before_014 b
      JOIN union_children uc ON uc.person_id = b.person_id
     WHERE uc.union_id IN ($1, $2)`, [u3, u4]);
  eq('none from the untouched families', strays.rows[0].n, 0);

  section('THE UNDO PUTS EVERY FAMILY BACK EXACTLY AS THEY WERE');
  /* The property that makes this defensible at all. If this fails, the
     migration is the one irreversible act in a project whose whole design is
     that nothing is. */
  await db.query(`
    UPDATE union_children uc SET birth_order = b.birth_order
      FROM sibling_order_before_014 b
     WHERE b.person_id = uc.person_id AND b.union_id = uc.union_id`);
  eq('the first family is back as typed', await rowOf(u1),
     ['Youngest', 'Eldest', 'Middle']);
  eq('and so is the second', await rowOf(u2),
     ['Late', 'No year', 'Set aside, 1930', 'Early']);

  // ── the families are told ────────────────────────────────────────────────
  section('EVERY AFFECTED FAMILY HAS A CHANGE LOGGED, AND NO OTHER FAMILY DOES');
  /* Without this the migration silently loses: a browser open right now holds
     the old tree, is told nothing happened, and pushes the old order back up
     on its next save. */
  const logged = await db.query(
    `SELECT tree_id, payload FROM changes WHERE payload->>'migration' = $1`,
    ['014_sibling_rows_by_year']);
  const trees = logged.rows.map(r => r.tree_id).sort();
  eq('two families moved, two told', trees.length, 2);
  eq('and they are the right two', trees, [t1, t2].sort());
  check('the entry says how many people moved',
        logged.rows.every(r => Number(r.payload.moved) > 0),
        JSON.stringify(logged.rows.map(r => r.payload)));

  // ── running it again ─────────────────────────────────────────────────────
  section('applying it a second time does nothing and loses nothing');
  // The runner records it in schema_migrations so it will not re-run, but a
  // migration in this project must survive being run by hand anyway.
  await db.query('BEGIN');
  await db.query(M('014_sibling_rows_by_year.sql'));
  await db.query('COMMIT');
  const after = await db.query(`SELECT count(*)::int AS n FROM sibling_order_before_014`);
  eq('the original record of where everyone stood is intact', after.rows[0].n, 5);

  await db.end();
  report();
})();
