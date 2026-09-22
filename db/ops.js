// The operations API.
//
// Replaces "PUT the whole tree as one JSON string". A client sends a list of
// small, named operations; they are applied in ONE transaction, all or
// nothing, and each appends a row to the changes log so other clients can sync
// incrementally instead of re-fetching everything.
//
// Why this rather than field PUTs: two relatives editing the tree at the same
// time must both keep their work. With a blob, the second save silently erased
// the first. With ops, two people working on different branches never touch
// the same rows, and two people editing the SAME person is detected and
// reported rather than resolved by whoever happened to save last.

const { ConflictError, badRequest, notFound, cycle } = require('./errors');
const graph = require('./graph');

// Namespace for this app's advisory locks, so a tree lock can never collide
// with the migration lock in db/migrate.js.
const TREE_LOCK_NS = 0x6d75;

// ---------------------------------------------------------------------------
// Version checks
//
// Every op that changes an existing entity may carry `expect`: the updated_at
// the client composed its edit against. If the row has moved on since, we
// refuse and hand back the current state so the client can merge.
//
// `expect` is optional. Omitting it is a deliberate "last write wins" for
// callers that genuinely do not care (the migration script, seeding). The
// client always sends it.

async function checkVersion(client, table, id, expect, label) {
  const { rows } = await client.query(
    `SELECT * FROM ${table} WHERE id = $1`, [id]);
  if (!rows.length) throw notFound(`${label} ${id} does not exist`);
  const row = rows[0];
  if (expect == null) return row;

  const actual = new Date(row.updated_at).toISOString();
  const wanted = new Date(expect).toISOString();
  if (actual !== wanted) {
    throw new ConflictError(
      `${label} ${id} changed since you loaded it`,
      { ...row, updated_at: actual }
    );
  }
  return row;
}

// Union-level edits (partners, children, order) live in side tables, so
// touching them has to bump the union's own updated_at by hand for the version
// check above to mean anything.
/* Put somebody into a marriage as a partner, at the next free place.
 *
 * NOT `ON CONFLICT DO NOTHING`. union_partners carries a DEFERRABLE unique
 * constraint on (union_id, position) so that a reorder can permute positions
 * inside one transaction — and Postgres will not accept a deferrable
 * constraint as an ON CONFLICT arbiter, so a bare DO NOTHING here is not a
 * no-op on a clash, it is an error. The position is read rather than
 * remembered for the same reason: the place this person held before is not
 * necessarily free now. */
async function joinUnionAsPartner(client, unionId, personId){
  const { rows: already } = await client.query(
    'SELECT person_id FROM union_partners WHERE union_id = $1 AND person_id = $2',
    [unionId, personId]);
  if (already.length) return false;
  const { rows } = await client.query(
    'SELECT COALESCE(max(position), -1) + 1 AS next FROM union_partners WHERE union_id = $1',
    [unionId]);
  await client.query(
    'INSERT INTO union_partners (union_id, person_id, position) VALUES ($1, $2, $3)',
    [unionId, personId, rows[0].next]);
  return true;
}

const touchUnion = (client, unionId) =>
  client.query('UPDATE unions SET updated_at = clock_timestamp() WHERE id = $1', [unionId]);

const touchPerson = (client, personId) =>
  client.query('UPDATE people SET updated_at = clock_timestamp() WHERE id = $1', [personId]);

async function logChange(client, treeId, entity, entityId, op, payload, by) {
  await client.query(
    `INSERT INTO changes (tree_id, entity, entity_id, op, payload, by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [treeId, entity, entityId, op, JSON.stringify(payload ?? {}), by || '']
  );
}

// ---------------------------------------------------------------------------
// The cycle guard.
//
// The frontend's canLink() refuses four things: making somebody their own
// ancestor, their own descendant, giving them a second set of parents, or
// re-recording someone who is already a parent. Those are data-integrity
// rules, not UI niceties, so they are enforced here. The client keeps its own
// copy purely as a fast path that avoids a round trip.
//
// This is only sound because the whole batch holds the tree's advisory lock:
// without it, two concurrent addChild calls could each independently verify
// "no cycle" and together create one.

async function guardAddChild(client, unionId, personId) {
  const partners = await graph.partnersOf(client, unionId);

  if (partners.includes(personId)) {
    throw cycle('A person cannot be a child of a union they are a partner in');
  }

  // Adding P as a child of U makes U's partners P's parents. That is a cycle
  // if any of those partners is P's own descendant.
  const below = await graph.descendantsOf(client, personId);
  const offender = partners.find(p => below.has(p));
  if (offender) {
    throw cycle(
      'That would make someone their own ancestor',
      { personId, wouldBeParent: offender }
    );
  }

  // At most one set of parents. The primary key on union_children.person_id
  // enforces this absolutely; checking first only buys a clearer message.
  const existing = await graph.parentUnionOf(client, personId);
  if (existing && existing !== unionId) {
    throw cycle(
      'That person already has a recorded set of parents',
      { personId, parentUnionId: existing }
    );
  }
}

async function guardAddPartner(client, unionId, personId) {
  const children = await graph.childrenOf(client, unionId);

  if (children.includes(personId)) {
    throw cycle('A person cannot be a partner in the union they are a child of');
  }

  // Adding P as a partner of U makes P a parent of U's children. That is a
  // cycle if any of those children is already P's ancestor.
  const above = await graph.ancestorsOf(client, personId);
  const offender = children.find(c => above.has(c));
  if (offender) {
    throw cycle(
      'That would make someone their own descendant',
      { personId, wouldBeChild: offender }
    );
  }
}

// ---------------------------------------------------------------------------
// Local references.
//
// A batch routinely creates a person and immediately links them ("add my
// grandmother, then record her as my father's mother"). IDs are minted by the
// database, so the client names new rows with a local ref — "$1" — and refers
// to it later in the same batch. The response returns the ref -> id map.
//
// The client does NOT mint ids itself, and that is deliberate: two relatives
// editing at once would both mint "p47". Client-side sequential ids collide
// under exactly the concurrency this rewrite exists to fix.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function makeResolver(refs) {
  return function resolve(value, what) {
    if (value == null) return null;
    if (typeof value === 'string' && value.startsWith('$')) {
      if (!refs.has(value)) {
        throw badRequest(`${what}: unknown local reference ${value}`);
      }
      return refs.get(value);
    }
    // Check the shape here rather than letting Postgres reject it. A bad id is
    // a caller mistake (400), and left to the driver it surfaces as an opaque
    // 22P02 that reads like a server fault.
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      throw badRequest(`${what}: expected an id or a local reference, got ${JSON.stringify(value)}`);
    }
    return value;
  };
}

// ---------------------------------------------------------------------------

const PERSON_FIELDS = ['name', 'also_known_as', 'sex', 'totem', 'born', 'died', 'added_by'];

const HANDLERS = {
  async addPerson(ctx, op) {
    const { client, treeId, actor } = ctx;
    const { rows } = await client.query(
      `INSERT INTO people (tree_id, name, also_known_as, sex, totem, born, died,
                           added_by, legacy_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [treeId, op.name ?? '', op.alsoKnownAs ?? '', op.sex ?? '', op.totem ?? '',
       op.born ?? '', op.died ?? '', op.addedBy ?? actor ?? '', op.legacyId ?? null]
    );
    const person = rows[0];
    if (op.ref) ctx.refs.set(op.ref, person.id);
    await logChange(client, treeId, 'person', person.id, 'addPerson', op, actor);
    return { ref: op.ref, id: person.id };
  },

  async updatePerson(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'updatePerson.id');
    await checkVersion(client, 'people', id, op.expect, 'person');

    const sets = [], vals = [];
    for (const f of PERSON_FIELDS) {
      const key = f === 'added_by' ? 'addedBy'
                : f === 'also_known_as' ? 'alsoKnownAs' : f;
      if (op[key] !== undefined) { vals.push(op[key]); sets.push(`${f} = $${vals.length}`); }
    }
    if (!sets.length) return { id };
    vals.push(id);
    await client.query(
      `UPDATE people SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    await logChange(client, treeId, 'person', id, 'updatePerson', op, actor);
    return { id };
  },

  async addUnion(ctx, op) {
    const { client, treeId, actor } = ctx;
    const { rows } = await client.query(
      'INSERT INTO unions (tree_id, legacy_id) VALUES ($1, $2) RETURNING *',
      [treeId, op.legacyId ?? null]);
    const union = rows[0];
    if (op.ref) ctx.refs.set(op.ref, union.id);
    await logChange(client, treeId, 'union', union.id, 'addUnion', op, actor);
    return { ref: op.ref, id: union.id };
  },

  async addPartner(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'addPartner.unionId');
    const personId = resolve(op.personId, 'addPartner.personId');
    await checkVersion(client, 'unions', unionId, op.expect, 'union');

    const existing = await graph.partnersOf(client, unionId);
    if (existing.includes(personId)) return { unionId, personId, already: true };

    await guardAddPartner(client, unionId, personId);

    // A union normally has two partners, sometimes one (a parent whose spouse
    // is unknown), occasionally none. Nothing requires two.
    const position = op.position ?? existing.length;
    await client.query(
      `INSERT INTO union_partners (union_id, person_id, position) VALUES ($1, $2, $3)`,
      [unionId, personId, position]);
    await touchUnion(client, unionId);
    await logChange(client, treeId, 'union', unionId, 'addPartner', op, actor);
    return { unionId, personId };
  },

  async removePartner(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'removePartner.unionId');
    const personId = resolve(op.personId, 'removePartner.personId');
    await checkVersion(client, 'unions', unionId, op.expect, 'union');
    await client.query(
      'DELETE FROM union_partners WHERE union_id = $1 AND person_id = $2',
      [unionId, personId]);
    await touchUnion(client, unionId);
    await logChange(client, treeId, 'union', unionId, 'removePartner', op, actor);
    return { unionId, personId };
  },

  /* HOW THE TWO ARE JOINED. See migration 015.

     A closed set, checked here as well as by the constraint, so that a bad
     value is a refused op with a name on it rather than a database error
     surfacing as "something went wrong". '' clears it back to not-said,
     which somebody who marked the wrong union has to be able to do. */
  async setBond(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'setBond.unionId');
    const bond = String(op.bond ?? '');
    if (!['', 'married', 'together', 'parted'].includes(bond)) {
      throw badRequest(`setBond: ${JSON.stringify(op.bond)} is not one of married, ` +
        `together, parted, or empty for not said`, { op: 'setBond', bond: op.bond });
    }
    await checkVersion(client, 'unions', unionId, op.expect, 'union');
    await client.query('UPDATE unions SET bond = $2 WHERE id = $1', [unionId, bond]);
    await touchUnion(client, unionId);
    await logChange(client, treeId, 'union', unionId, 'setBond', op, actor);
    return { unionId, bond };
  },

  async addChild(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'addChild.unionId');
    const personId = resolve(op.personId, 'addChild.personId');
    await checkVersion(client, 'unions', unionId, op.expect, 'union');

    const existing = await graph.childrenOf(client, unionId);
    if (existing.includes(personId)) return { unionId, personId, already: true };

    await guardAddChild(client, unionId, personId);

    // Appended last unless placed explicitly. union_children is eldest-first,
    // and that order is real information — it decides the seniority terms
    // (Mukoma / Munin'ina) when birth years are missing.
    const birthOrder = op.birthOrder ?? existing.length;
    if (op.birthOrder != null) {
      // Make room. The unique constraint is deferred, so the shifted rows may
      // transiently collide within this statement without tripping.
      await client.query(
        `UPDATE union_children SET birth_order = birth_order + 1
          WHERE union_id = $1 AND birth_order >= $2`, [unionId, birthOrder]);
    }
    await client.query(
      `INSERT INTO union_children (union_id, person_id, birth_order) VALUES ($1, $2, $3)`,
      [unionId, personId, birthOrder]);
    await touchUnion(client, unionId);
    await touchPerson(client, personId);
    await logChange(client, treeId, 'union', unionId, 'addChild', op, actor);
    return { unionId, personId, birthOrder };
  },

  async removeChild(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'removeChild.unionId');
    const personId = resolve(op.personId, 'removeChild.personId');
    await checkVersion(client, 'unions', unionId, op.expect, 'union');
    await client.query(
      'DELETE FROM union_children WHERE union_id = $1 AND person_id = $2',
      [unionId, personId]);
    await touchUnion(client, unionId);
    await logChange(client, treeId, 'union', unionId, 'removeChild', op, actor);
    return { unionId, personId };
  },

  async reorderChildren(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const unionId = resolve(op.unionId, 'reorderChildren.unionId');
    await checkVersion(client, 'unions', unionId, op.expect, 'union');

    const ordered = (op.orderedIds || []).map(id => resolve(id, 'reorderChildren.orderedIds'));
    const current = await graph.childrenOf(client, unionId);

    // Must be a permutation of exactly the current children. Anything else is
    // a stale client working from a list that has since gained or lost a
    // sibling, and silently applying it would drop somebody's birth order.
    const same = ordered.length === current.length &&
                 new Set(ordered).size === ordered.length &&
                 current.every(id => ordered.includes(id));
    if (!same) {
      throw new ConflictError(
        'The sibling list has changed since you loaded it',
        { unionId, children: current }
      );
    }

    for (let i = 0; i < ordered.length; i++) {
      await client.query(
        'UPDATE union_children SET birth_order = $1 WHERE person_id = $2', [i, ordered[i]]);
    }
    await touchUnion(client, unionId);
    await logChange(client, treeId, 'union', unionId, 'reorderChildren', op, actor);
    return { unionId, orderedIds: ordered };
  },

  /* Mark, or unmark, somebody as the furthest back this line has been traced.
 
     A tree has as many of these as it has lines: one relative traces their
     father's people to 1890 and stops, another traces their mother's to 1920
     and stops, and both statements are true at once. This used to clear every
     other root before setting one, which quietly erased one family's work
     whenever another family recorded theirs. */
  async setRoot(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const personId = resolve(op.personId ?? op.id, 'setRoot.personId');
    await checkVersion(client, 'people', personId, op.expect, 'person');
    const root = op.root === undefined ? true : !!op.root;
    await client.query('UPDATE people SET is_root = $2 WHERE id = $1', [personId, root]);
    await logChange(client, treeId, 'person', personId, 'setRoot', { personId, root }, actor);
    return { personId, root };
  },

  async dismissDuplicate(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    let a = resolve(op.aId, 'dismissDuplicate.aId');
    let b = resolve(op.bId, 'dismissDuplicate.bId');
    if (a === b) throw badRequest('Cannot dismiss a person against themselves');
    // Canonical order, matching the CHECK on the table. A dismissal recorded
    // one way round must suppress the pair scanned the other way round.
    if (a > b) [a, b] = [b, a];
    await client.query(
      `INSERT INTO not_duplicates (tree_id, a_id, b_id, by) VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`, [treeId, a, b, actor || '']);
    await logChange(client, treeId, 'person', a, 'dismissDuplicate', { aId: a, bId: b }, actor);
    return { aId: a, bId: b };
  },

  /* A word the family has supplied for a relationship the app could not name.
     Keyed on the SHAPE of the relationship, not on the pair — see
     migrations/004 for why that distinction is what makes storing it safe. */
  async teachTerm(ctx, op) {
    const { client, treeId, actor } = ctx;
    const shape = String(op.shape || '').trim();
    const term = String(op.term || '').trim();
    if (!shape) throw badRequest('teachTerm needs the shape of the relationship');
    if (!term) throw badRequest('teachTerm needs a term');
    await client.query(
      `INSERT INTO kin_terms (tree_id, shape, term, note, by) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (tree_id, shape) DO UPDATE SET
         term = EXCLUDED.term, note = EXCLUDED.note,
         by = EXCLUDED.by, at = clock_timestamp()`,
      [treeId, shape, term, String(op.note || '').trim(), op.by || actor || '']);
    await logChange(client, treeId, 'term', null, 'teachTerm', { shape, term }, actor);
    return { shape, term };
  },

  async forgetTerm(ctx, op) {
    const { client, treeId, actor } = ctx;
    const shape = String(op.shape || '').trim();
    if (!shape) throw badRequest('forgetTerm needs the shape of the relationship');
    await client.query('DELETE FROM kin_terms WHERE tree_id = $1 AND shape = $2',
                       [treeId, shape]);
    await logChange(client, treeId, 'term', null, 'forgetTerm', { shape }, actor);
    return { shape };
  },

  /* Publish a person, or keep them out of the public record.
 
     Not the same act as setting somebody aside. Aside is about the FAMILY's
     tree — the record leaves the picture their relatives work on. This is
     about the WORLD: a private person is fully present to their family and
     absent from anything published. Confusing the two would either hide
     somebody from their own relatives or publish somebody the family had
     quietly withdrawn.
 
     `visibility: null` clears the choice and returns the person to the
     default — public if dead, private if living. */
  async setVisibility(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'setVisibility.id');
    const v = op.visibility === null || op.visibility === undefined ? null
            : String(op.visibility);
    if (v !== null && v !== 'public' && v !== 'private') {
      throw badRequest("setVisibility.visibility must be 'public', 'private', or null to clear it");
    }
    await checkVersion(client, 'people', id, op.expect, 'person');
    await client.query(
      // $2 is cast explicitly: it appears inside a CASE, where Postgres has
      // nothing else to infer a type from and refuses the statement outright.
      `UPDATE people SET visibility = $2::text, visibility_by = $3,
                         visibility_at = CASE WHEN $2::text IS NULL
                                              THEN NULL ELSE clock_timestamp() END
        WHERE id = $1`, [id, v, v === null ? '' : (actor || '')]);
    // Recorded like every other change, so a person who finds themselves
    // published can see who published them and when.
    await logChange(client, treeId, 'person', id, 'setVisibility', { id, visibility: v }, actor);
    return { id, visibility: v };
  },

  /* Take somebody out of the tree everybody sees, without destroying them.
     The first way a person leaves the visible tree, the reversible one, and
     the one to reach for. deletePerson below is the other, and it will not
     touch anybody who has not been through here first.

     The reason is required, and required twice over: the database CHECK
     refuses a set-aside without one, and this refuses it before the database
     has to, so the caller gets a sentence rather than a constraint name. The
     person who entered this record is owed an explanation, and the reason is
     what the notice they see is made of. */
  async setAside(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'setAside.id');
    const why = (op.why ?? '').trim();
    if (!why) {
      throw badRequest('setAside: a reason is required — whoever recorded this person is told why');
    }
    const person = await checkVersion(client, 'people', id, op.expect, 'person');
    // Already aside is not an error, but it must not quietly rewrite the
    // reason and the name attached to the first one. That first notice is
    // what its author was told; overwriting it would edit their history.
    if (person.aside_at) return { id, alreadyAside: true };

    // Where the details went, when this set-aside is a merge. Optional, and
    // resolved like any other id so a merge inside one batch can name a
    // person created in that same batch.
    const into = op.mergedInto ? resolve(op.mergedInto, 'setAside.mergedInto') : null;
    await client.query(
      `UPDATE people SET aside_at = clock_timestamp(), aside_by = $2, aside_why = $3,
                         merged_into = $4
        WHERE id = $1`, [id, actor || '', why, into === id ? null : into]);
    await logChange(client, treeId, 'person', id, 'setAside',
                    { id, why, mergedInto: into, addedBy: person.added_by }, actor);
    return { id, why, notify: person.added_by };
  },

  /* Bring somebody back into the visible tree. Deliberately open to anyone,
     and deliberately needs no reason: putting a record back is not the act
     that needs justifying. */
  async restore(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'restore.id');
    const person = await checkVersion(client, 'people', id, op.expect, 'person');
    if (!person.aside_at) return { id, alreadyPresent: true };

    await client.query(
      `UPDATE people SET aside_at = NULL, aside_by = '', aside_why = '', merged_into = NULL
        WHERE id = $1`, [id]);
    await logChange(client, treeId, 'person', id, 'restore',
                    { id, wasAsideBy: person.aside_by, wasWhy: person.aside_why }, actor);
    return { id };
  },

  /* ── TAKING A MERGE BACK ─────────────────────────────────────────────────
   *
   * "When names are duplicated, merge them."
   *
   * What makes it safe to do that automatically is not being clever about
   * which pairs to fold. It is that folding the wrong pair is an ordinary
   * mistake rather than a permanent one. This is that: the folded record
   * comes back as its own person, with the marriages and the place among its
   * parents' children that it held before, read off what the merge wrote
   * down. See migration 016.
   *
   * AND THE PAIR IS REMEMBERED AS TWO DIFFERENT PEOPLE, so that the scan
   * that folded them does not fold them again five seconds later. That is the
   * difference between an undo and an argument with the app.
   *
   * WHAT IT CANNOT PUT BACK, and says so rather than pretending: two
   * marriages to the same person that the merge collapsed into one. Those
   * children are now in one marriage and the app does not know which of them
   * came from which, so it leaves them and reports what it left.
   */
  async splitPeople(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'splitPeople.id');
    const person = await checkVersion(client, 'people', id, op.expect, 'person');
    if (!person.merged_into) {
      throw badRequest('That record was not folded into another one', { id });
    }
    const keepId = person.merged_into;
    const undo = person.merged_undo || null;

    // Everything the record wore of its own comes back first, so that a
    // half-finished restore is a record present with no links rather than a
    // record absent with its links already moved.
    await client.query(
      `UPDATE people SET aside_at = NULL, aside_by = '', aside_why = '',
                         merged_into = NULL, merged_undo = NULL
        WHERE id = $1`, [id]);

    const put = { parents:false, marriages:0, blanked:[] };
    if (undo){
      if (undo.parentUnion){
        /* Only where the survivor is not standing in that place. Where the
           folded record HAD parents and the survivor did not, the merge moved
           that membership across; putting it back means taking it off the
           survivor, because one person has one set of parents and so does the
           other. */
        const { rows } = await client.query(
          'SELECT person_id FROM union_children WHERE union_id = $1 AND person_id = $2',
          [undo.parentUnion.unionId, keepId]);
        if (rows.length){
          await client.query(
            'UPDATE union_children SET person_id = $1 WHERE union_id = $2 AND person_id = $3',
            [id, undo.parentUnion.unionId, keepId]);
          put.parents = true;
        } else {
          const { rows: mine } = await client.query(
            'SELECT person_id FROM union_children WHERE person_id = $1', [id]);
          if (!mine.length){
            await client.query(
              `INSERT INTO union_children (union_id, person_id, birth_order)
               VALUES ($1, $2, $3) ON CONFLICT (person_id) DO NOTHING`,
              [undo.parentUnion.unionId, id, undo.parentUnion.birthOrder ?? 0]);
            put.parents = true;
          }
        }
      }
      /* A MARRIAGE THE MERGE FOLDED AWAY IS BUILT AGAIN, with the children
         that came from it and no others.

         Two records of one man, each recorded with an unnamed wife, leave
         two marriages with an identical partner list once the merge has
         moved one onto the other — so the merge folds them into one. Undoing
         that by simply handing the surviving marriage back would hand over
         the OTHER record's children with it, which is how taking back a fold
         once gave one man's son to another man's record. */
      const rebuilt = new Map();
      for (const c of (undo.collapsed || [])){
        const { rows: made } = await client.query(
          'INSERT INTO unions (tree_id) VALUES ($1) RETURNING id', [treeId]);
        const fresh = made[0].id;
        rebuilt.set(c.dropped, fresh);
        let at = 0;
        for (const kid of (c.children || [])){
          await client.query(
            `UPDATE union_children SET union_id = $1, birth_order = $2
              WHERE person_id = $3 AND union_id = $4`, [fresh, at++, kid, c.kept]);
        }
        await touchUnion(client, c.kept);
      }

      for (const m of (undo.partnerUnions || [])){
        const standIn = rebuilt.get(m.unionId);
        if (standIn){
          await joinUnionAsPartner(client, standIn, id);
          put.marriages++;
          await touchUnion(client, standIn);
          continue;
        }
        // A union that is simply gone, and was not one this merge folded:
        // there is nothing to rejoin, and inventing one would invent a marriage.
        const { rows: alive } = await client.query(
          'SELECT id FROM unions WHERE id = $1 AND tree_id = $2', [m.unionId, treeId]);
        if (!alive.length) continue;
        const { rows: sitting } = await client.query(
          'SELECT person_id FROM union_partners WHERE union_id = $1 AND person_id = $2',
          [m.unionId, keepId]);
        if (sitting.length){
          await client.query(
            'UPDATE union_partners SET person_id = $1 WHERE union_id = $2 AND person_id = $3',
            [id, m.unionId, keepId]);
        } else {
          await joinUnionAsPartner(client, m.unionId, id);
        }
        put.marriages++;
        await touchUnion(client, m.unionId);
      }
      /* The survivor gives back what it only ever had from this record. A
         merge fills the survivor's BLANK fields from the one it folds; an
         undo that left them would leave the survivor wearing the other
         person's birth year for good. */
      const fields = Object.keys(undo.filled || {})
        .filter(f => ['name', 'sex', 'totem', 'born', 'died', 'added_by'].includes(f));
      if (fields.length){
        const { rows } = await client.query(
          `SELECT ${fields.join(', ')} FROM people WHERE id = $1`, [keepId]);
        const blank = fields.filter(f => rows.length && rows[0][f] === undo.filled[f]);
        if (blank.length){
          await client.query(
            `UPDATE people SET ${blank.map(f => `${f} = ''`).join(', ')} WHERE id = $1`,
            [keepId]);
          put.blanked = blank;
        }
      }
    }

    // So the scan that folded them does not fold them again. An undo that
    // has to be repeated every few seconds is an argument, not an undo.
    let a = id, b = keepId;
    if (a > b) [a, b] = [b, a];
    await client.query(
      `INSERT INTO not_duplicates (tree_id, a_id, b_id, by) VALUES ($1,$2,$3,$4)
       ON CONFLICT DO NOTHING`, [treeId, a, b, actor || '']);

    await touchPerson(client, id);
    await touchPerson(client, keepId);
    await logChange(client, treeId, 'person', id, 'splitPeople',
                    { id, keepId, put, couldNotUndo: (undo && undo.collapsed) || [] }, actor);
    return { id, keepId, put,
             collapsedMarriages: ((undo && undo.collapsed) || []).length,
             hadRecord: !!undo };
  },

  /* Take somebody out of this tree for good.
  
     THE RULE THIS BREAKS, and why it is now written differently. Everything
     around it used to say "there is no delete, here or anywhere else in this
     API", and that was the right default: a family tree is a record, records
     are wrong before they are right, and a person removed in a moment of
     tidying cannot be got back. setAside exists so that taking somebody out
     of the picture costs nothing and can be undone by anyone.
  
     But a family that entered a person by mistake — the same grandmother
     typed twice, a name from the wrong household, somebody who asked not to
     be in it — is entitled to have that gone rather than merely hidden, and
     "set aside" is not that. So the delete exists, and everything below is
     about making it the second half of a deliberate act rather than the first
     half of an accident.
  
     THEY MUST BE SET ASIDE FIRST. The same shape as deleting a whole family,
     for the same reason: two separate decisions, minutes or days apart, and
     the first one is free to undo. Nobody deletes a person from the tree in
     one tap.
  
     WHAT GOES WITH THEM. Every foreign key pointing at people is CASCADE or
     SET NULL, so their place in their parents' marriage and in any marriage
     of their own goes with the row, and no session or invitation that named
     them is left dangling. A marriage with nobody left in it at all is
     removed too — that is not a marriage, it is the hole where one person
     used to be. A marriage that still has a partner or a child is kept: it is
     somebody else's record as much as theirs.
  
     WHAT STAYS. One line in the change log saying a person of that name was
     removed, by whom. That is the only trace, and it is deliberate: the
     family's own log is how they find out why somebody is no longer in the
     tree, and a deletion that left no account of itself would be
     indistinguishable from a bug. */
  async deletePerson(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const id = resolve(op.id, 'deletePerson.id');
    const person = await checkVersion(client, 'people', id, op.expect, 'person');

    if (!person.aside_at) {
      throw badRequest('deletePerson: set them aside first. Deleting is the ' +
                       'second half of a deliberate act, never the first.');
    }

    /* Read the marriages they belong to BEFORE the cascade removes the rows
       that say so — afterwards there is no way to find them. */
    const { rows: touched } = await client.query(
      `SELECT union_id FROM union_partners WHERE person_id = $1
        UNION
       SELECT union_id FROM union_children WHERE person_id = $1`, [id]);

    await client.query('DELETE FROM people WHERE id = $1', [id]);

    let unionsRemoved = 0;
    for (const t of touched) {
      const { rows } = await client.query(
        `SELECT (SELECT count(*) FROM union_partners WHERE union_id = $1) AS partners,
                (SELECT count(*) FROM union_children WHERE union_id = $1) AS children`,
        [t.union_id]);
      if (Number(rows[0].partners) === 0 && Number(rows[0].children) === 0) {
        await client.query('DELETE FROM unions WHERE id = $1', [t.union_id]);
        unionsRemoved++;
      }
    }

    await logChange(client, treeId, 'person', id, 'deletePerson',
                    { id, name: person.name, wasAsideWhy: person.aside_why,
                      unionsRemoved }, actor);
    return { id, unionsRemoved };
  },

  /* Say that a person in this tree and a person in another tree are the same
     ancestor.

     This does NOT merge anything. Two families finding a shared grandfather
     does not make them one record under one owner — each keeps their own
     tree, their own version of him, and their own memory of him. The link
     says "your Rufaro and our Rufaro are the same man" and stops there.
     Anything stronger would be one family's records being absorbed into
     another's on the strength of a name and a date. */
  async proposeLink(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const mine = resolve(op.personId, 'proposeLink.personId');
    const theirs = String(op.otherPersonId || '');
    if (!UUID_RE.test(theirs)) {
      throw badRequest('proposeLink.otherPersonId: expected the id of a person in another tree');
    }
    if (mine === theirs) throw badRequest('A person cannot be linked to themselves');

    const { rows } = await client.query(
      'SELECT id, tree_id FROM people WHERE id = ANY($1::uuid[])', [[mine, theirs]]);
    const other = rows.find(r => r.id === theirs);
    if (!other) throw badRequest('proposeLink.otherPersonId: no such person');
    if (other.tree_id === treeId) {
      // Within one tree the answer is mergePeople, which folds the records
      // together. Across trees nothing is folded. Confusing the two would
      // silently do the wrong one.
      throw badRequest('Those are both in this tree — that is a duplicate to merge, not a link');
    }

    // One row per pair whichever family proposes it, matching the CHECK.
    const [a, b] = [mine, theirs].sort();
    const [aTree, bTree] = a === mine ? [treeId, other.tree_id] : [other.tree_id, treeId];

    const { rows: [row] } = await client.query(
      `INSERT INTO tree_links (a_person, b_person, a_tree, b_tree, status, score, why, proposed_by)
       VALUES ($1,$2,$3,$4,'proposed',$5,$6,$7)
       ON CONFLICT (a_person, b_person) DO UPDATE SET
         status = CASE WHEN tree_links.status = 'rejected' THEN 'proposed'
                       ELSE tree_links.status END,
         score = EXCLUDED.score
       RETURNING id, status`,
      [a, b, aTree, bTree, op.score ?? null, String(op.why || '').slice(0, 500), actor || '']);

    await logChange(client, treeId, 'link', mine, 'proposeLink',
                    { personId: mine, otherPersonId: theirs, linkId: row.id }, actor);
    return { linkId: row.id, status: row.status, personId: mine, otherPersonId: theirs };
  },

  /* Agree, or disagree, with a proposed link. A rejection is KEPT rather than
     deleted: without it the same suggestion returns on every scan for ever,
     and the work somebody did judging it is thrown away each time. */
  async decideLink(ctx, op) {
    const { client, treeId, actor } = ctx;
    const linkId = String(op.linkId || '');
    if (!UUID_RE.test(linkId)) throw badRequest('decideLink.linkId: expected an id');
    const status = op.status === 'confirmed' ? 'confirmed'
                 : op.status === 'rejected'  ? 'rejected' : null;
    if (!status) throw badRequest("decideLink.status must be 'confirmed' or 'rejected'");

    const { rows } = await client.query(
      'SELECT a_tree, b_tree FROM tree_links WHERE id = $1', [linkId]);
    if (!rows.length) throw notFound(`link ${linkId} does not exist`);
    // Only the two families concerned get a say in whether they are related.
    if (rows[0].a_tree !== treeId && rows[0].b_tree !== treeId) {
      throw badRequest('That link is between two other families');
    }

    await client.query(
      `UPDATE tree_links SET status = $2, decided_by = $3, decided_at = clock_timestamp()
        WHERE id = $1`, [linkId, status, actor || '']);
    await logChange(client, treeId, 'link', null, 'decideLink', { linkId, status }, actor);
    return { linkId, status };
  },

  async mergePeople(ctx, op) {
    const { client, treeId, actor, resolve } = ctx;
    const keepId = resolve(op.keepId, 'mergePeople.keepId');
    const mergeId = resolve(op.mergeId, 'mergePeople.mergeId');
    if (keepId === mergeId) throw badRequest('Cannot merge a person into themselves');

    const keep = await checkVersion(client, 'people', keepId, op.expectKeep, 'person');
    const merge = await checkVersion(client, 'people', mergeId, op.expectMerge, 'person');

    // Merging two people who are each other's ancestor would build a cycle.
    const below = await graph.descendantsOf(client, mergeId);
    const above = await graph.ancestorsOf(client, mergeId);
    if (below.has(keepId) || above.has(keepId)) {
      throw cycle('Those two are recorded as ancestor and descendant of each other',
                  { keepId, mergeId });
    }

    // Parent unions: if both have one and they differ, this is not a merge we
    // can decide. Two different sets of parents is a genuine disagreement
    // about who somebody is, and guessing would destroy one branch.
    const keepParent = await graph.parentUnionOf(client, keepId);
    const mergeParent = await graph.parentUnionOf(client, mergeId);
    if (keepParent && mergeParent && keepParent !== mergeParent) {
      throw cycle(
        'Those two records have different parents — resolve that before merging',
        { keepId, keepParentUnion: keepParent, mergeId, mergeParentUnion: mergeParent });
    }
    /* WHAT THIS MERGE IS ABOUT TO MOVE, written down before it moves.
       See migration 016. Without it a merge can be read back but not taken
       back, because by the end of this function nothing anywhere says where
       the folded record's marriages and its place among its parents' children
       came from. */
    const undo = { parentUnion:null, partnerUnions:[], filled:{}, collapsed:[] };
    if (mergeParent){
      const { rows } = await client.query(
        'SELECT union_id, birth_order FROM union_children WHERE person_id = $1', [mergeId]);
      if (rows.length) undo.parentUnion = { unionId: rows[0].union_id,
                                            birthOrder: rows[0].birth_order };
    }
    {
      const { rows } = await client.query(
        'SELECT union_id, position FROM union_partners WHERE person_id = $1', [mergeId]);
      undo.partnerUnions = rows.map(r => ({ unionId: r.union_id, position: r.position }));
    }

    if (!keepParent && mergeParent) {
      await client.query(
        'UPDATE union_children SET person_id = $1 WHERE person_id = $2', [keepId, mergeId]);
    } else if (mergeParent) {
      await client.query('DELETE FROM union_children WHERE person_id = $1', [mergeId]);
    }

    // Partner memberships move across, except where that would duplicate one
    // the kept person already holds.
    await client.query(
      `DELETE FROM union_partners WHERE person_id = $1
        AND union_id IN (SELECT union_id FROM union_partners WHERE person_id = $2)`,
      [mergeId, keepId]);
    await client.query(
      'UPDATE union_partners SET person_id = $1 WHERE person_id = $2', [keepId, mergeId]);

    // Blank fields on the kept record are filled from the one being absorbed —
    // the duplicate often carries the detail the survivor is missing.
    const filled = {};
    for (const f of ['name', 'sex', 'totem', 'born', 'died', 'added_by']) {
      if (!keep[f] && merge[f]) filled[f] = merge[f];
    }
    undo.filled = { ...filled };
    if (Object.keys(filled).length) {
      const sets = Object.keys(filled).map((f, i) => `${f} = $${i + 1}`);
      await client.query(
        `UPDATE people SET ${sets.join(', ')} WHERE id = $${sets.length + 1}`,
        [...Object.values(filled), keepId]);
    }
    if (merge.is_root && !keep.is_root) {
      await client.query('UPDATE people SET is_root = true WHERE id = $1', [keepId]);
    }

    // Dismissals naming the absorbed record now name the survivor. Re-canonicalise
    // (a < b) and drop any that collapsed into self-pairs or existing rows.
    const { rows: dismissals } = await client.query(
      'SELECT a_id, b_id FROM not_duplicates WHERE tree_id = $1 AND (a_id = $2 OR b_id = $2)',
      [treeId, mergeId]);
    await client.query(
      'DELETE FROM not_duplicates WHERE tree_id = $1 AND (a_id = $2 OR b_id = $2)',
      [treeId, mergeId]);
    for (const d of dismissals) {
      let a = d.a_id === mergeId ? keepId : d.a_id;
      let b = d.b_id === mergeId ? keepId : d.b_id;
      if (a === b) continue;
      if (a > b) [a, b] = [b, a];
      await client.query(
        `INSERT INTO not_duplicates (tree_id, a_id, b_id, by) VALUES ($1,$2,$3,$4)
         ON CONFLICT DO NOTHING`, [treeId, a, b, actor || '']);
    }

    // The folded record is SET ASIDE, not deleted. It keeps its name, its
    // dates and whoever entered it, and merged_into says where its details
    // went — so a merge somebody disagrees with can be read back and undone,
    // rather than only discovered as an absence.
    /* WHY, in the record itself, and in particular whether a person chose it
       or the app did. A family reading back a merge they do not remember
       making has to be able to tell those two apart. */
    const why = op.why
      ? String(op.why)
      : `Folded into ${keep.name || 'another record'} as the same person.`;
    await client.query(
      `UPDATE people
          SET aside_at = clock_timestamp(), aside_by = $2,
              aside_why = $3, merged_into = $4, merged_undo = $5::jsonb
        WHERE id = $1`,
      [mergeId, actor || '', why, keepId, JSON.stringify(undo)]);

    // Merging two records for one person can leave two unions with an
    // identical partner set — the same marriage, recorded twice. Fold them
    // together, moving children into the survivor. Children must move BEFORE
    // the empty union is dropped: union_children.union_id is RESTRICT
    // precisely so that a union with children can never vanish under them.
    const collapsed = await collapseDuplicateUnions(client, treeId, keepId);
    if (collapsed && collapsed.length){
      // The one part an undo cannot simply reverse: two marriages to the same
      // person, folded into one. Written down so the app can SAY so rather
      // than quietly put half a thing back.
      undo.collapsed = collapsed;
      await client.query('UPDATE people SET merged_undo = $2::jsonb WHERE id = $1',
                         [mergeId, JSON.stringify(undo)]);
    }

    /* A SESSION VIEWING AS THE FOLDED RECORD FOLLOWS THE ONE THAT STAYED.

       Sessions carry who is viewing, and every term the app produces is
       reckoned from that person. Without this, tidying away your own duplicate
       leaves you signed in as a record that has just been set aside: the app
       asks who you are again, in the middle of the one act that was supposed
       to be housekeeping. It is the same person — that is what a merge
       asserts — so the session says so too.

       In this transaction, so a merge that rolls back does not move anybody. */
    const { rowCount: moved } = await client.query(
      `UPDATE sessions SET person_id = $2
        WHERE person_id = $1 AND revoked_at IS NULL`, [mergeId, keepId]);

    await touchPerson(client, keepId);
    await logChange(client, treeId, 'person', keepId, 'mergePeople',
                    { keepId, mergeId, filled, collapsedUnions: collapsed,
                      sessionsMoved: moved }, actor);
    return { keepId, mergeId, filled, collapsedUnions: collapsed,
             sessionsMoved: moved };
  }
};

// Unions sharing an identical partner set are the same marriage recorded
// twice. Only called after a merge, and only for unions touching the survivor.
async function collapseDuplicateUnions(client, treeId, personId) {
  const { rows } = await client.query(`
    SELECT u.id,
           COALESCE(array_agg(up.person_id ORDER BY up.person_id)
                    FILTER (WHERE up.person_id IS NOT NULL), '{}') AS partners
      FROM unions u
      LEFT JOIN union_partners up ON up.union_id = u.id
     WHERE u.tree_id = $1
       AND u.id IN (SELECT union_id FROM union_partners WHERE person_id = $2)
     GROUP BY u.id`, [treeId, personId]);

  const byKey = new Map();
  const collapsed = [];
  for (const r of rows) {
    // A union with no partners is not "the same marriage" as another with no
    // partners — it is an unknown pair of parents. Never fold those together.
    if (!r.partners.length) continue;
    const key = r.partners.join('|');
    if (!byKey.has(key)) { byKey.set(key, r.id); continue; }

    const keepUnion = byKey.get(key);
    const dropUnion = r.id;
    /* WHICH CHILDREN CAME FROM THE MARRIAGE THAT IS ABOUT TO GO, read before
       it goes. Without this an undo of the merge cannot tell them apart from
       the children the surviving marriage already had — and the first time
       that happened, taking back a fold handed one man's son to another
       man's record. See ops.splitPeople and migration 016. */
    const { rows: moving } = await client.query(
      'SELECT person_id FROM union_children WHERE union_id = $1 ORDER BY birth_order',
      [dropUnion]);
    const { rows: [{ n }] } = await client.query(
      'SELECT count(*)::int AS n FROM union_children WHERE union_id = $1', [keepUnion]);
    await client.query(
      `UPDATE union_children SET union_id = $1,
              birth_order = birth_order + $2 WHERE union_id = $3`,
      [keepUnion, n, dropUnion]);
    await client.query('DELETE FROM union_partners WHERE union_id = $1', [dropUnion]);
    await client.query('DELETE FROM unions WHERE id = $1', [dropUnion]);
    collapsed.push({ kept: keepUnion, dropped: dropUnion,
                     children: moving.map(x => x.person_id) });
  }
  return collapsed;
}

// ---------------------------------------------------------------------------

async function applyOps(pool, treeId, ops, actor = '') {
  if (!Array.isArray(ops)) throw badRequest('ops must be an array');
  if (!ops.length) throw badRequest('ops is empty');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Serialise all writes to this tree.
    //
    // This is doing three jobs at once, and it is worth being explicit because
    // it looks like it is only doing the first:
    //
    //   1. It makes the cycle guard sound. Two concurrent addChild calls could
    //      otherwise each verify "no cycle" independently and together create
    //      one.
    //   2. It makes changes.seq gapless FOR THIS TREE. A bare BIGSERIAL does
    //      not give you that: sequence values can be handed out in one order
    //      and committed in another, so a client polling ?since=N can
    //      permanently miss a row that was assigned a lower seq but committed
    //      later. That is silent data loss in the sync path.
    //   3. It removes read-modify-write races inside a batch (making room in
    //      birth_order, appending at the end of a partner list).
    //
    // At family-scale write volume — a handful of people editing a tree — the
    // contention cost is nil. The lock is released when the transaction ends,
    // whether it commits or rolls back.
    await client.query('SELECT pg_advisory_xact_lock($1, hashtext($2))',
                       [TREE_LOCK_NS, treeId]);

    const { rowCount } = await client.query('SELECT 1 FROM trees WHERE id = $1', [treeId]);
    if (!rowCount) throw notFound(`tree ${treeId} does not exist`);

    const refs = new Map();
    const ctx = { client, treeId, actor, refs, resolve: makeResolver(refs) };

    const results = [];
    for (const [i, op] of ops.entries()) {
      const handler = HANDLERS[op?.op];
      if (!handler) throw badRequest(`ops[${i}]: unknown operation ${JSON.stringify(op?.op)}`);
      try {
        results.push({ op: op.op, ...(await handler(ctx, op)) });
      } catch (e) {
        if (e.status) { e.details = { ...e.details, opIndex: i, op: op.op }; }
        throw e;
      }
    }

    const { rows } = await client.query(
      'SELECT COALESCE(max(seq), 0)::bigint AS seq FROM changes WHERE tree_id = $1', [treeId]);

    await client.query('COMMIT');
    return {
      seq: Number(rows[0].seq),
      refs: Object.fromEntries(refs),
      results
    };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { applyOps, HANDLERS };
