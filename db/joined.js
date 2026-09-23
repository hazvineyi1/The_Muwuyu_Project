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

/* ── AND WHETHER THEY ARE ALONE OR MERELY APART ──────────────────────────
 *
 * looseAfter answers "did this batch reach the tree". It does not say HOW it
 * failed, and the two ways are different faults with different remedies:
 *
 *   ALONE    a name in no union with anybody. Every one of them needs
 *            joining to somebody.
 *   APART    names joined to each other and to nobody already here — an
 *            island. Joining ONE of them to a relative already in the tree
 *            brings the whole group with it.
 *
 * The refusal said "have nobody on the other end" for both, which for an
 * island is simply untrue — they have each other — and sends a family
 * looking for a missing link on every name instead of on one.
 *
 * Returns true when at least one of them is holding on to somebody, which is
 * what makes the group an island rather than a scatter of lone names. */
async function apartNotAlone(client, loose) {
  const ids = [...new Set(loose)].filter(Boolean);
  if (ids.length < 2) return false;
  const { rows } = await client.query(
    `WITH theirs AS (
       SELECT union_id FROM union_partners WHERE person_id = ANY($1::uuid[])
       UNION
       SELECT union_id FROM union_children WHERE person_id = ANY($1::uuid[])
     )
     SELECT t.union_id, count(*)::int AS n
       FROM theirs t
       JOIN (SELECT union_id, person_id FROM union_partners
             UNION ALL
             SELECT union_id, person_id FROM union_children) m
         ON m.union_id = t.union_id
      GROUP BY t.union_id
     HAVING count(*) > 1
      LIMIT 1`,
    [ids]);
  return rows.length > 0;
}

/* ── AND NOBODY IS EVER CUT LOOSE ─────────────────────────────────────────
 *
 * "3 names are recorded but not joined to anybody yet. This needs to be
 *  impossible."
 *
 * looseAfter above guards the door: a name cannot COME IN on its own. It says
 * so itself — "this only refuses to make new ones" — and that turned out to
 * be half a rule, because a name does not have to arrive adrift to end up
 * adrift. It can be cut loose afterwards, by the very corrections this app
 * offers in one tap: take a marriage out, answer "nobody yet" to whose child,
 * set somebody aside, remove them for good. Every one of those can be the
 * last thread holding somebody to the family, and nothing checked.
 *
 * Worse, the page KNEW. It counted the names it had just set loose and
 * narrated them — "2 names are now joined to nothing, the bar says who" — and
 * then saved anyway. The bar in the screenshot is that sentence's accumulated
 * work.
 *
 * WHAT ADRIFT MEANS, and it is not "in no union with anybody". Two names
 * married to each other and to nobody else are joined to each other and
 * adrift from the family: an island. The page has always read it this way —
 * the bar walks out from whoever is looking — and the server had no opinion
 * at all. So this is reachability.
 *
 * SET ASIDE PEOPLE ARE NOT IN IT AND CANNOT CARRY A CONNECTION. Somebody set
 * aside is off the screen, so a family they were the only link to is off the
 * screen with them, which is exactly what the family would see.
 *
 * THE GROUND IS THE BIGGEST ISLAND. Not the root, which a family may never
 * have marked and may have marked on a twig; not whoever is looking, which
 * the server does not know. The biggest island is the family, and everybody
 * outside it is adrift from it. Ties go to the lowest id so that the answer
 * is the same twice running.
 *
 * WHAT THIS STILL DOES NOT DO, deliberately, and for the same reason as
 * above: it does not demand the past be tidy. Trees already carry names cut
 * loose before this existed. Those are found in the room built for them. This
 * refuses to make the number GROW — it compares the adrift before a batch
 * with the adrift after, so a family correcting one loose name is never
 * refused because the name was loose. */
async function adriftNow(client, treeId, anchor) {
  /* Oldest first, and is_root carried, because both are needed to settle a
     tie — see the ground below. */
  const { rows: ppl } = await client.query(
    `SELECT id, is_root FROM people
      WHERE tree_id = $1 AND aside_at IS NULL
      ORDER BY created_at, id`, [treeId]);
  const present = ppl.map(r => r.id);
  const rooted = new Set(ppl.filter(r => r.is_root).map(r => r.id));
  const age = new Map(present.map((id, i) => [id, i]));   // 0 is the oldest record
  if (present.length < 2) return { loose: new Set(), ground: new Set(present) };

  const { rows: mem } = await client.query(
    `SELECT m.union_id, m.person_id
       FROM (SELECT union_id, person_id FROM union_partners
             UNION ALL
             SELECT union_id, person_id FROM union_children) m
       JOIN people p ON p.id = m.person_id
      WHERE p.tree_id = $1 AND p.aside_at IS NULL`, [treeId]);

  /* Union-find rather than a walk: one pass over the memberships, no
     recursion to blow a stack on a deep line, and it stays flat on the five
     thousand people the scale suite builds. */
  const up = new Map(present.map(id => [id, id]));
  const find = x => {
    let r = x;
    while (up.get(r) !== r) r = up.get(r);
    while (up.get(x) !== r) { const n = up.get(x); up.set(x, r); x = n; }
    return r;
  };
  const tie = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) up.set(ra, rb); };

  // Everybody in one union is on one island — tie each member to the first.
  const firstIn = new Map();
  for (const r of mem) {
    if (!up.has(r.person_id)) continue;
    const seen = firstIn.get(r.union_id);
    if (seen === undefined) firstIn.set(r.union_id, r.person_id);
    else tie(seen, r.person_id);
  }

  const groups = new Map();                        // island root -> [ids]
  for (const id of present) {
    const root = find(id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(id);
  }

  /* WHICH ISLAND IS THE FAMILY.
   *
   * Recomputing "the biggest one" independently before and after is the
   * mistake this function was first written with, and it is not a small one:
   * take a man out of his marriage and the tree becomes two islands of two,
   * the tie is settled by whichever id happens to sort first, and the app
   * refuses or allows the same act depending on a coin. It also reports the
   * wrong half — "that would leave his father joined to nobody" when what is
   * actually floating off is his wife and child.
   *
   * So the family is carried across: the caller hands in the island the
   * family was on BEFORE the batch, and the ground afterwards is whichever
   * island still holds most of those people. Only the very first call, with
   * nothing to carry, falls back to the biggest. Ties go to the lowest id so
   * that the answer is the same twice running. */
  /* AND WHEN THE TWO HALVES ARE THE SAME SIZE, which a tree torn cleanly down
     the middle always is, the trunk decides. First whichever half holds a
     person the family has MARKED as the furthest they can trace, and then
     whichever holds the oldest record in the tree — the name somebody wrote
     first, which is where the family started.
     Settled by id as a last resort only so the answer is the same twice
     running. Without this the winner was whichever id happened to sort first,
     and the refusal named the wrong half: "that would leave the patriarch
     joined to nobody" when what is actually floating off is a wife and
     child. */
  const scoreOf = ids => {
    let anchored = 0, root = 0, oldest = Infinity, low = null;
    for (const id of ids) {
      if (anchor && anchor.has(id)) anchored++;
      if (rooted.has(id)) root = 1;
      const a = age.get(id);
      if (a < oldest) oldest = a;
      if (low === null || String(id) < low) low = String(id);
    }
    return [anchor ? anchored : ids.length, ids.length, root, -oldest, low];
  };
  const beats = (a, b) => {
    for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] > b[i];
    return a[4] < b[4];                       // lowest id, purely for repeatability
  };
  let ground = null, best = null;
  for (const [root, ids] of groups) {
    const sc = scoreOf(ids);
    if (best === null || beats(sc, best)) { best = sc; ground = root; }
  }

  /* A FAMILY OF ONE IS NOT A FAMILY. Without this, one name out of five
     standing entirely alone would be picked as the ground and the other four
     counted adrift from it — or, worse, a tree torn cleanly in half would
     excuse whichever single name sorted first. If the biggest thing left
     standing is one person, then nobody is joined to anybody and all of them
     are adrift. */
  const on = groups.get(ground) || [];
  if (on.length < 2) return { loose: new Set(present), ground: new Set() };

  const keep = new Set(on);
  const loose = new Set();
  for (const id of present) if (!keep.has(id)) loose.add(id);
  return { loose, ground: keep };
}

/* The ops that can take a thread away. Everything else only ever adds one, so
   the check — two passes over the whole tree — is paid on the rare write and
   never on a family typing names in.

   setAside is in it because somebody set aside is off the screen, and a
   family cut off behind them is off the screen too. mergePeople is in it
   because it moves memberships, and moving is removing somewhere. */
const CUTS = new Set(['removePartner', 'removeChild', 'setAside', 'deletePerson',
                      'mergePeople']);

const mayCut = ops => (ops || []).some(o => o && CUTS.has(o.op));

module.exports = { looseAfter, apartNotAlone, adriftNow, mayCut, CUTS };
