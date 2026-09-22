/* ── NOBODY GOES IN ON THEIR OWN ──────────────────────────────────────────
 *
 * "To be added to the tree you need to be connected to somebody. You have to
 *  pick someone who you know to be in the tree and connect from them."
 *
 * Said once before — "do not allow someone to start a name that is not
 * linked" — and built then in the page: the welcome field refuses a second
 * name, every bud grows off somebody, and the front door asks a newcomer for
 * one relative before it will write anything down.
 *
 * All three of those are in the browser. The browser is not where the rule
 * lives. A stale tab, a half-finished sync, a second app one day, or simply
 * somebody who knows what a POST is, can hand the write endpoint an addPerson
 * joined to nothing, and the server will take it — which is how this project
 * came to need a room for finding adrift names in the first place.
 *
 * So the rule is kept here, at the door, where it cannot be walked around.
 *
 * WHAT COUNTS AS CONNECTED. A person is in the tree if they share a union
 * with anybody else — as a partner beside another partner, as a child of a
 * marriage, or as a parent of a child. That is the whole of it, and it is
 * deliberately the loosest reading of "connected" that is still a connection:
 * a union with one name in it and nothing else is not a join, it is a name in
 * a box.
 *
 * AND CONNECTED TO SOMEBODY WHO WAS ALREADY THERE. Two new names married to
 * each other and to nobody else are joined to each other and adrift from the
 * family — an island, which is the thing this rule exists to prevent. So the
 * ground is the people the tree already had, and a new name reaches it
 * directly or through other new names in the same batch. A family adding a
 * grandfather, his wife and their four children in one go is one batch, and
 * every one of those six reaches the tree through the others.
 *
 * THE ONE NAME ALLOWED TO STAND ALONE is the first name in an empty tree,
 * because there is nothing for it to be joined to. Every name after it has
 * somebody.
 *
 * WHAT THIS DOES NOT DO. It does not go looking for names that are already
 * adrift — plenty are, entered before any of this existed, and they are found
 * and reconciled in the room built for that. This only refuses to make new
 * ones. A rule that also demanded the past be tidy would refuse a family's
 * correction to a loose name because the name was loose. */

/* Everyone this batch put in the tree who is not joined to it.
 *
 * Runs inside the caller's transaction, on the client that applied the ops,
 * after they have applied and before anything is committed — so what it reads
 * is the tree as the batch would leave it, and refusing rolls the whole batch
 * back rather than leaving half a family behind. */
async function looseAfter(client, treeId, addedIds) {
  const added = [...new Set(addedIds)].filter(Boolean);
  if (!added.length) return [];

  /* Was there a tree before this? Aside records do not count: a family that
     has set everybody aside and is starting again is starting again, and the
     first name they write is the first name in an empty tree. */
  const { rows: before } = await client.query(
    `SELECT count(*)::int AS n FROM people
      WHERE tree_id = $1 AND aside_at IS NULL AND NOT (id = ANY($2::uuid[]))`,
    [treeId, added]);
  const wasEmpty = before[0].n === 0;

  /* Every union any of these people is in, with everyone else in it. One
     query: a chain of new names is a chain of unions each containing a new
     name, so this reaches the whole island without walking anywhere. */
  const { rows } = await client.query(
    `WITH theirs AS (
       SELECT union_id FROM union_partners WHERE person_id = ANY($1::uuid[])
       UNION
       SELECT union_id FROM union_children WHERE person_id = ANY($1::uuid[])
     )
     SELECT t.union_id, m.person_id
       FROM theirs t
       JOIN (SELECT union_id, person_id FROM union_partners
             UNION ALL
             SELECT union_id, person_id FROM union_children) m
         ON m.union_id = t.union_id`,
    [added]);

  const members = new Map();                       // union id -> [person ids]
  for (const r of rows) {
    if (!members.has(r.union_id)) members.set(r.union_id, []);
    members.get(r.union_id).push(r.person_id);
  }

  const isNew = new Set(added);
  const grounded = new Set();

  /* An empty tree's first name is its own ground. Which name: the one the
     family wrote first, which is the order the ops came in. */
  if (wasEmpty) grounded.add(added[0]);

  /* Reaching the ground, one step at a time until nothing more can be
     reached. Small by construction — the unions here are only the ones a
     single batch touched. */
  for (let again = true; again; ) {
    again = false;
    for (const who of members.values()) {
      const standing = who.some(p => !isNew.has(p) || grounded.has(p));
      if (!standing) continue;
      for (const p of who) {
        if (isNew.has(p) && !grounded.has(p)) { grounded.add(p); again = true; }
      }
    }
  }

  return added.filter(id => !grounded.has(id));
}

module.exports = { looseAfter };
