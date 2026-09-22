/* ── ONE SIDE OF A FAMILY, AND WHERE IT STOPS ─────────────────────────────
 *
 * "I want to grow my mother's side of the family, Mandaba. I want to give
 *  that family access to only grow that aspect without them seeing the full
 *  tree, only limited to their part."
 *
 * WHO IS IN A BRANCH. Start at the anchor and take:
 *
 *   1. everybody above them — parents, and theirs, as far as recorded;
 *   2. everybody below all of those — which is what makes it a HOUSE rather
 *      than a line: the anchor's brothers and sisters, their children, the
 *      anchor's uncles and their whole families;
 *   3. the husbands and wives of everybody so far, because a marriage cannot
 *      be recorded with half of it missing.
 *
 * AND A HUSBAND OR WIFE IS A WALL, NOT A DOOR. Somebody who married into the
 * Mandabas is in, and the walk STOPS at them: their own parents and their own
 * brothers are their family's business, not this one's. Without that single
 * rule "my mother's side" means "everybody my mother's side has ever
 * married", which after two generations is the whole tree and the wall is
 * decorative.
 *
 * Said the other way round: the branch is the house the anchor was born into,
 * plus the people who married into that house, and nothing beyond them.
 *
 * COMPUTED, NEVER STORED. The same rule this project holds for kinship terms.
 * A stored list of who is in the Mandaba side is a list that is wrong the
 * moment somebody records a great-aunt — and it would be wrong in the
 * dangerous direction, because being left off it means being invisible to the
 * people who know you. So it is a question asked of the tree every time.
 *
 * IT IS CLOSED UNDER GROWING, which is what makes it usable rather than a
 * cage. Everything a Mandaba would naturally add is already inside: a parent
 * of a Mandaba is an ancestor; a brother is a child of those ancestors; a
 * child is a descendant; a husband is a spouse. There is exactly one thing
 * they cannot do, and it is the right one — they cannot reach sideways into
 * somebody else's house through a marriage. */

/* Everybody in the branch anchored on `anchorId`, as a Set of ids.
 *
 * Reads only what it needs: the parent link and the partner link, walked in
 * rounds. Three queries per round at worst, and a family is shallow — the
 * deepest tree this project has seen is nine generations. */
async function membersOf(client, treeId, anchorId) {
  const inIt = new Set();
  if (!anchorId) return inIt;

  /* 1. UP. Every ancestor of the anchor, through parent links only.
        Spouses are not followed here — a stepfather's parents are not this
        family's ancestors, and nor are a mother-in-law's. */
  const roots = new Set([anchorId]);
  let edge = [anchorId];
  while (edge.length) {
    const { rows } = await client.query(
      `SELECT DISTINCT up.person_id AS parent
         FROM union_children uc
         JOIN union_partners up ON up.union_id = uc.union_id
        WHERE uc.person_id = ANY($1::uuid[])`, [edge]);
    edge = rows.map(r => r.parent).filter(id => !roots.has(id));
    edge.forEach(id => roots.add(id));
  }

  /* 2. DOWN, from every one of them. A house, not a line: this is what puts
        the anchor's brothers, their children and the anchor's uncles in. */
  for (const id of roots) inIt.add(id);
  edge = [...roots];
  while (edge.length) {
    const { rows } = await client.query(
      `SELECT DISTINCT uc.person_id AS child
         FROM union_partners up
         JOIN union_children uc ON uc.union_id = up.union_id
        WHERE up.person_id = ANY($1::uuid[])`, [edge]);
    edge = rows.map(r => r.child).filter(id => !inIt.has(id));
    edge.forEach(id => inIt.add(id));
  }

  /* 3. ACROSS, once. Everybody married to anybody already in — and no
        further, which is the wall. */
  const born = [...inIt];
  if (born.length) {
    const { rows } = await client.query(
      `SELECT DISTINCT other.person_id AS spouse
         FROM union_partners mine
         JOIN union_partners other ON other.union_id = mine.union_id
                                  AND other.person_id <> mine.person_id
        WHERE mine.person_id = ANY($1::uuid[])`, [born]);
    for (const r of rows) inIt.add(r.spouse);
  }

  /* Nobody from another family, whatever the links say. Cross-tree links are
     a separate feature with a separate wall and this one does not open it. */
  if (inIt.size) {
    const { rows } = await client.query(
      'SELECT id FROM people WHERE id = ANY($1::uuid[]) AND tree_id = $2',
      [[...inIt], treeId]);
    const here = new Set(rows.map(r => r.id));
    for (const id of inIt) if (!here.has(id)) inIt.delete(id);
  }
  return inIt;
}

/* The branch a session is held to, or null for the whole family. Reads the
   row every time rather than trusting the cookie: a branch that has been
   retired must stop working the moment it is retired, not when the session
   next expires. */
async function forSession(pool, session) {
  if (!session || !session.branchId) return null;
  const { rows } = await pool.query(
    `SELECT b.id, b.tree_id, b.anchor_id, b.name, b.retired_at, p.name AS anchor_name
       FROM branches b JOIN people p ON p.id = b.anchor_id
      WHERE b.id = $1`, [session.branchId]);
  if (!rows.length) return null;
  const b = rows[0];
  if (b.retired_at) return { ...b, retired: true };
  if (session.treeId && b.tree_id !== session.treeId) return { ...b, retired: true };
  return { id: b.id, treeId: b.tree_id, anchorId: b.anchor_id, name: b.name,
           anchorName: b.anchor_name, retired: false };
}

async function create(pool, treeId, { anchorId, name = '', by = '' } = {}) {
  const { rows: who } = await pool.query(
    'SELECT id, name FROM people WHERE id = $1 AND tree_id = $2 AND aside_at IS NULL',
    [anchorId, treeId]);
  if (!who.length) {
    const e = new Error('That person is not in this family.');
    e.status = 400; e.code = 'not_in_family';
    throw e;
  }
  const { rows } = await pool.query(
    `INSERT INTO branches (tree_id, anchor_id, name, created_by)
     VALUES ($1, $2, $3, $4)
     RETURNING id, tree_id, anchor_id, name, created_by, created_at`,
    [treeId, anchorId, String(name || '').slice(0, 120), String(by || '').slice(0, 120)]);
  return { ...rows[0], anchorName: who[0].name };
}

async function list(pool, treeId, { includeRetired = false } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id, b.anchor_id, b.name, b.created_by, b.created_at,
            b.retired_at, b.retired_by, p.name AS anchor_name,
            (SELECT count(*)::int FROM invites i
              WHERE i.branch_id = b.id AND i.revoked_at IS NULL
                AND i.expires_at > clock_timestamp() AND i.uses < i.max_uses) AS open_links
       FROM branches b JOIN people p ON p.id = b.anchor_id
      WHERE b.tree_id = $1 ${includeRetired ? '' : 'AND b.retired_at IS NULL'}
      ORDER BY b.created_at DESC LIMIT 100`, [treeId]);
  return rows;
}

/* Giving it back. Every session and every link held to this branch stops
   working, because a branch nobody may use any more is one nobody may use any
   more — not one that lapses when the last cookie does. */
async function retire(pool, branchId, { treeId = null, by = '' } = {}) {
  const { rows } = await pool.query(
    `UPDATE branches SET retired_at = clock_timestamp(), retired_by = $2
      WHERE id = $1 AND retired_at IS NULL
        ${treeId ? 'AND tree_id = $3' : ''}
      RETURNING id, name`,
    treeId ? [branchId, String(by || '').slice(0, 120), treeId]
           : [branchId, String(by || '').slice(0, 120)]);
  if (!rows.length) return null;
  await pool.query(
    `UPDATE sessions SET revoked_at = clock_timestamp(), revoked_by = $2
      WHERE branch_id = $1 AND revoked_at IS NULL`,
    [branchId, String(by || '').slice(0, 120)]);
  await pool.query(
    `UPDATE invites SET revoked_at = clock_timestamp(), revoked_by = $2
      WHERE branch_id = $1 AND revoked_at IS NULL`,
    [branchId, String(by || '').slice(0, 120)]);
  return rows[0];
}

/* The marriages a branch may see: the ones every single person in is inside
 * the branch.
 *
 * ALL, NOT ANY, and that is the whole care of it. Somebody who married into
 * the Mandabas is a Mandaba's business and is in the branch. Their OTHER
 * marriage, to somebody outside it, is not — and a union shown because it has
 * one member in it would name that outsider, which is exactly the leak the
 * wall exists to stop. So a union with a foot on both sides is not shown at
 * all, and the branch sees a man whose second marriage it does not know
 * about, which is the correct amount for it to know. */
async function unionsOf(client, treeId, members) {
  const ids = [...members];
  if (!ids.length) return new Set();
  const { rows } = await client.query(
    `SELECT u.id
       FROM unions u
      WHERE u.tree_id = $1
        AND NOT EXISTS (
          SELECT 1 FROM union_partners up
           WHERE up.union_id = u.id AND NOT (up.person_id = ANY($2::uuid[])))
        AND NOT EXISTS (
          SELECT 1 FROM union_children uc
           WHERE uc.union_id = u.id AND NOT (uc.person_id = ANY($2::uuid[])))
        AND EXISTS (
          SELECT 1 FROM union_partners up WHERE up.union_id = u.id
          UNION ALL
          SELECT 1 FROM union_children uc WHERE uc.union_id = u.id)`,
    [treeId, ids]);
  return new Set(rows.map(r => r.id));
}

/* Every id a batch of ops names that is not a $ref — the records it is about
 * to touch. Read off the values rather than named field by field on purpose:
 * a new op with a new id field would otherwise be invisible to the wall, and
 * a wall that only knows about the ops written before it is not a wall. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function idsNamedBy(ops) {
  const found = new Set();
  const walk = v => {
    if (typeof v === 'string') { if (UUID.test(v)) found.add(v.toLowerCase()); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') { Object.values(v).forEach(walk); }
  };
  walk(ops);
  return found;
}

module.exports = { membersOf, unionsOf, idsNamedBy, forSession, create, list, retire };
