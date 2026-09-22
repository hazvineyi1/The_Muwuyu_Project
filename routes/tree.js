// HTTP surface for the relational tree.
//
// Mounted alongside the old /api/shared blob API, which keeps working until
// the data has actually been moved across.

const express = require('express');
const { applyOps } = require('../db/ops');
const { bootstrap, fullTree, branchTree, branchChanges,
        publicTree, publicPerson, changesSince, search,
        setAsideList } = require('../db/reads');
const { findDuplicates } = require('../db/duplicates');
const duplicates = require('../db/duplicates');
const { findRelatives, linksFor } = require('../db/crosstree');
const { OpError } = require('../db/errors');
const { requireOwnTree, limiter, addressOf, limitKeyOf } = require('../auth');
const access = require('../db/access');
const audit = require('../db/audit');
const branchModule = require('../db/branch');

function sendError(res, e) {
  if (e instanceof OpError) {
    return res.status(e.status).json({
      error: e.code,
      message: e.message,
      ...e.details,
      // A 409 carries the current state so the client can merge rather than
      // clobber. This is the whole reason a stale write is reported instead of
      // being silently applied.
      ...(e.current ? { current: e.current } : {})
    });
  }
  /* An error that already knows what it is and what to say. The access and
     branch layers throw these — a retired branch, a person who is not in this
     family — and they were falling through to "something went wrong", which
     turns an answer somebody could act on into a shrug. */
  if (Number.isInteger(e?.status) && e.status >= 400 && e.status < 500 && e.code) {
    return res.status(e.status).json({ error: e.code, message: e.message });
  }
  // Constraint violations are the database enforcing a rule the caller broke,
  // not the server falling over. Report them as such — in particular the
  // one-set-of-parents primary key, which a racing client can still trip even
  // though applyOps checks for it first.
  const PG = {
    '22P02': [400, 'bad_request', 'That is not a valid id'],
    '23505': [409, 'conflict',    'That link already exists'],
    '23503': [400, 'bad_request', 'That refers to somebody who is not in this tree'],
    '23514': [400, 'bad_request', 'That value is not allowed']
  };
  if (PG[e.code]) {
    const [status, code, message] = PG[e.code];
    return res.status(status).json({ error: code, message, detail: e.detail || e.message });
  }
  console.error('unhandled', e);
  return res.status(500).json({ error: 'internal', message: 'something went wrong' });
}

// Who made a change. Purely for the changes log's `by` column — it is not
// identity and grants nothing. Real access control is the gate, and which
// family you are in is `own` below.
const actorOf = req => String(req.get('x-muti-actor') || req.body?.by || '').slice(0, 120);

/* The family's passcode for removing somebody, as this request carries it.
   A header rather than a field in the batch, so it is never mistaken for
   part of an op and never written into the change log with one. The key is
   what the throttle counts against — the session where there is one, so a
   whole household behind one address is not locked out by one relative's
   typing. See db/passcode.js. */
const passcodeOf = req => String(req.get('x-muti-passcode') || req.body?.passcode || '').slice(0, 64);

/* EVERY ROUTE THAT NAMES A TREE IS GUARDED BY THIS.

   Getting through the gate says you belong to A family. `own` says you belong
   to THIS one. Without it the per-family passcodes would decide who gets in
   and then any signed-in visitor could still ask for /api/tree/<any id>/tree —
   which is the old single deployment-wide passphrase again, wearing a
   passcode's clothes.

   It is applied per route rather than to the whole router because two routes
   here deliberately do not take a tree id (/home, /trees) and one takes a key
   instead (/family/:key); a blanket r.use() would silently do nothing for
   those three and read as though it had covered them. */
const own = requireOwnTree('id');

/* ── THE ONE SIDE OF THE FAMILY THIS SESSION WAS GIVEN, OR ALL OF IT ──────
 *
 * "I want to give that family access to only grow that aspect without them
 *  seeing the full tree, only limited to their part."
 *
 * Resolved on the request rather than trusted from the cookie, so that
 * handing a branch back takes effect the moment it is handed back and not
 * whenever the last relative's session happens to expire.
 *
 * null is the whole family, which is what every session in this deployment
 * already is. A branch session is always NARROWER than a family session and
 * can only ever be made by somebody who holds the whole family. */
async function branchOf(pool, req) {
  const held = await branchModule.forSession(pool, req.muti?.session);
  if (!held) return null;
  if (held.retired) {
    const e = new Error('That part of the family is no longer shared with this link.');
    e.status = 403; e.code = 'branch_retired';
    throw e;
  }
  return held;
}

/* Who is in it, and which marriages it may see — read together because every
   caller needs both and asking twice invites the two to disagree. */
async function reachOf(pool, treeId, held) {
  const members = await branchModule.membersOf(pool, treeId, held.anchorId);
  const unions = await branchModule.unionsOf(pool, treeId, members);
  return { members, unions };
}

/* Starting a family is free to ask for and not free to do: a tree, a scrypt
   hash, a session. Two limits rather than one, and the pair is the point.

   Per SESSION is the one that bites first, and it is set where no person ever
   reaches it. Per ADDRESS is the backstop, set far higher, because forty
   relatives at a gathering share one wifi and each starting their own tree is
   this project working rather than being abused — while somebody who does hold
   a passcode should still not be able to loop sign-in-and-create from one
   machine all afternoon.

   This is the only rate limit on a WRITE in the project, and it is here rather
   than on /ops because ops are what the family came to do. */
const newFamilyLimit = limiter(20, 60 * 60 * 1000);
const newFamilyPerAddress = limiter(100, 60 * 60 * 1000);

module.exports = function treeRoutes(pool, homeTreeId = null) {
  const r = express.Router();

  /* WHO IS VIEWING, BEFORE ANYTHING IS RECKONED FROM THEM.

     Every Shona term this app produces is reckoned from somebody. Amaiguru
     and Amainini turn on whose mother is older; Tete and Sekuru on which side
     of the family you stand; "my sister's children are my children" on
     whether the person asking is a woman. A tree handed to a session that has
     not said who it is, is a tree that will be described to nobody — which is
     exactly what was happening, because the viewer used to be a line in the
     browser's storage that a new phone answered as blank.

     So the tree is not sent until the session has answered. The refusal
     carries the ONE thing needed to answer it: id and name, and nothing else.
     No dates, no totems, no marriages, no children — a roster is what the
     question needs and the rest is what the answer unlocks.

     Two cases go straight through, and both are the same case: there is
     nobody to be. A family with no people in it yet has just been started by
     whoever is asking, and a deployment with no gate has no session to carry
     an answer. */
  async function viewer(req, res, next) {
    const s = req.muti?.session;
    if (!s || s.scope !== 'family') return next();
    if (s.personId) return next();
    try {
      let held = null;
      if (s.branchId) {
        const b = await branchOf(pool, req);
        if (b) held = { ...b, members: await branchModule.membersOf(pool, s.treeId, b.anchorId) };
      }
      /* NAMES ONLY, AND ONLY NAMES SOMEBODY ACTUALLY TYPED.
       *
       * "What is this also part? These are incorrect — remove all `also`
       *  unless manually added."
       *
       * This used to invent one. Alongside the other-name somebody had
       * written on a card, it worked out each person's own first name with a
       * spouse's surname and offered that too, on the reasoning that a woman
       * recorded under her own house's name — Evelyn Mandaba, in a tree full
       * of Musonis — has been Mai Musoni for thirty years and will type
       * Musoni when a screen asks who she is.
       *
       * The reasoning was sound and the guess was not. It ran on EVERYBODY,
       * so men were handed their wives' surnames: Ben Musoni came back "also
       * Ben Marumahoko", which is not a name he has ever been called and not
       * a name anybody entered. And even where the shape was right it was
       * still a guess, printed in the same grey as the name a relative had
       * actually written down, so the tree appeared to hold a record of
       * something it had only inferred.
       *
       * That is the rule this project keeps everywhere else — kinship words
       * are derived and never stored, and the other-name a person answers to
       * is stored and never derived — and this was the one place it had been
       * broken. A name is a fact about a person, not an inference from who
       * they married. If somebody does go by their spouse's surname, the card
       * has a field for it and a relative can put it there in a second.
       *
       * Nothing was ever written down, so nothing needs undoing: the invented
       * names existed only in this answer and go with this code.
       *
       * Still names and nothing else. The dates, the mitupo, who is married
       * to whom and the rest of the family stay behind the answer. */
      const { rows } = await pool.query(
        `SELECT p.id, p.name, p.also_known_as
           FROM people p
          WHERE p.tree_id = $1 AND p.aside_at IS NULL
            AND ($2::uuid[] IS NULL OR p.id = ANY($2::uuid[]))
          ORDER BY p.name LIMIT 2000`,
        /* AND ONLY THEIR OWN SIDE, where the link that got them in said so.
           The roster is a list of names handed to somebody who has not yet
           said who they are — it is the most tempting thing in this app to
           forget to narrow, and forgetting would hand the whole family to the
           one kind of session that is meant to see least of it. */
        [s.treeId, held ? [...held.members] : null]);
      if (!rows.length) return next();

      const people = rows.map(r => {
        const also = String(r.also_known_as || '').trim();
        return { id: r.id, name: r.name, ...(also ? { also: [also] } : {}) };
      });

      return res.status(428).json({
        error: 'who_are_you',
        message: 'Say who you are in this family. Every word this tree uses is ' +
                 'reckoned from one person, so it has to know which one you are.',
        people
      });
    } catch (e) { return sendError(res, e); }
  }

  /* Which family this visitor is in.

     THE SESSION DECIDES, not the deployment. Before per-family passcodes there
     was one tree and this returned it; now the passcode somebody signed in
     with says which family they are, and this reports that. homeTreeId remains
     the fallback for the one case that has no family session of its own: a
     deployment with no gate at all, run locally to look at. */
  r.get('/home', async (req, res) => {
    /* THE KEEPER IS NOT A FAMILY, and saying so here is the difference
       between a clear sentence and a trap.

       An admin session has no tree — that is the whole point of it, and the
       wall this project keeps between administering families and reading
       them. But this used to fall straight through to homeTreeId, handing
       back a tree the session provably cannot open. The family page then
       asked for it, got the 404 that `own` correctly gives, and showed "the
       tree could not be read" above an invitation to plant the first person
       — so a keeper who typed their passphrase at the family door was one
       name away from creating a tree they did not want, while their real
       family sat there untouched and apparently gone.

       Nothing here refuses anything the gate did not already refuse. It just
       stops pretending there is a tree to go to. */
    if (req.muti?.scope === 'admin') {
      return res.json({
        keeper: true,
        message: 'You are signed in as the keeper of this deployment, not as a ' +
                 'family. The keeper\'s pages are at /admin. To open a family\'s ' +
                 'tree, sign out and sign in with that family\'s passcode.'
      });
    }

    const treeId = req.muti?.treeId || homeTreeId;
    if (!treeId) {
      return res.status(503).json({
        error: 'no_tree', message: 'the server has not finished choosing a tree' });
    }
    try {
      const { rows } = await pool.query(
        'SELECT id, key, name, handle FROM trees WHERE id = $1', [treeId]);
      res.json(rows.length
        ? { treeId: rows[0].id, key: rows[0].key, name: rows[0].name,
            handle: rows[0].handle, via: req.muti?.session?.via || '' }
        : { treeId });
    } catch (e) { sendError(res, e); }
  });

  /* The whole tree, plus the change-log position it was read at.

     The page is an editor, not a viewer: it derives kinship, generations,
     duplicates and layout from the whole graph, and a partial graph gives
     wrong answers rather than missing ones. */
  r.get('/tree/:id/tree', own, viewer, async (req, res) => {
    try {
      /* A BRANCH IS SERVED BY A DIFFERENT FUNCTION, not by this one with a
         flag on it — the same care publicTree is written with, and for the
         same reason: a boolean on a read is one `if` away from handing the
         whole family to somebody holding one side of it, and that mistake
         makes no noise. */
      const held = await branchOf(pool, req);
      if (held) {
        const reach = await reachOf(pool, req.params.id, held);
        return res.json(await branchTree(pool, req.params.id, {
          ...reach, anchorId: held.anchorId, name: held.name || held.anchorName }));
      }
      res.json(await fullTree(pool, req.params.id));
    } catch (e) { sendError(res, e); }
  });

  /* The list of families — ADMIN ONLY, since per-family passcodes.

     It used to be readable by anyone through the gate, on the reasoning that
     names and sizes are not much and opening one still needed its key. That
     reasoning does not survive the passcodes: the whole promise now is that a
     family's existence and size is theirs, and a list of every family on the
     deployment is the one thing that makes a passcode look like a formality.
     The admin's own view of this is /api/admin/families. */
  r.get('/trees', (req, res, next) => {
    if (req.muti?.scope === 'admin') return next();
    return res.status(403).json({
      error: 'not_admin',
      message: 'The families on this deployment are not listed. Open yours with ' +
               'its passcode, or an invitation from somebody in it.'
    });
  }, async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT t.id, t.name, t.created_at,
               (SELECT count(*)::int FROM people p
                 WHERE p.tree_id = t.id AND p.aside_at IS NULL) AS people
          FROM trees t ORDER BY t.created_at`);
      res.json({ trees: rows });
    } catch (e) { sendError(res, e); }
  });

  /* Start a family.

     Three things happen together, and they have to: the tree is made, it is
     given a passcode, and the caller is moved into it. Making a family without
     a passcode would leave a tree nobody could ever open again; making one
     without moving the session would leave the person who started it locked
     out of the family they just started, since their session is scoped to the
     family they were in.

     THE PASSCODE IS IN THIS RESPONSE AND NOWHERE ELSE. It is stored as a
     scrypt hash, so it cannot be read back — by the family, by the admin, or
     by anybody who reaches the database. Losing it means being issued another,
     which is what the admin is for. */
  r.post('/trees', async (req, res) => {
    try {
      const who = limitKeyOf(req), addr = addressOf(req);
      if (newFamilyLimit.tooMany(who) || newFamilyPerAddress.tooMany(addr)) {
        return res.status(429).json({
          error: 'too_many_families',
          message: 'That is several families started in a short time. Try again ' +
                   'in an hour — the ones already started are untouched.'
        });
      }
      newFamilyLimit.note(who); newFamilyPerAddress.note(addr);
      const name = String(req.body?.name || '').trim().slice(0, 200) || 'A family';
      const by = actorOf(req);
      const { rows } = await pool.query(
        `INSERT INTO trees (name, created_by) VALUES ($1, $2)
         RETURNING id, key, name, handle, created_at`, [name, by]);
      const made = rows[0];

      const issued = await access.issuePasscode(pool, made.id, { by });
      const session = await access.createSession(pool, {
        scope: 'family', treeId: made.id, via: 'created',
        passcodeGen: issued.passcode_gen, actor: by,
        ip: audit.clientIp(req), userAgent: audit.uaOf(req)
      });
      res.cookie('muti_gate', session.cookie, {
        httpOnly: true, sameSite: 'lax',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        maxAge: access.SESSION_DAYS * 24 * 60 * 60 * 1000, path: '/'
      });

      await audit.record(pool, audit.from(req, {
        kind: 'family.created', ok: true, treeId: made.id, actor: by,
        sessionId: session.id, detail: { name: made.name, handle: made.handle } }));
      await audit.record(pool, audit.from(req, {
        kind: 'passcode.set', ok: true, treeId: made.id, actor: by,
        sessionId: session.id, detail: { generation: issued.passcode_gen } }));

      res.status(201).json({
        ...made, passcode: issued.passcode,
        notice: 'Write this down now. It is the only time it can be shown, and ' +
                'it is the only way back into this family. Nobody can read it ' +
                'back for you — not even the keeper of this deployment, who can ' +
                'only issue a new one.'
      });
    } catch (e) { sendError(res, e); }
  });

  /* Look a family up by its key.

     THE KEY NO LONGER OPENS ANYTHING. It used to be the credential: hold the
     link, hold the tree. Per-family passcodes replace that, and this is now a
     lookup that answers only for the family the caller is already in — which
     is what the page needs it for, to turn a remembered link into a name.

     A key belonging to somebody else's family gets the same 404 as a key that
     never existed. That is the honest consequence of the change: links shared
     before this are no longer a way in, and an invitation is. */
  r.get('/family/:key', async (req, res) => {
    try {
      const key = String(req.params.key || '');
      const { rows } = await pool.query(
        'SELECT id, name, created_at FROM trees WHERE key = $1', [key]);
      // A FAMILY SESSION, AND ITS OWN FAMILY. An admin is refused here too:
      // the keeper's view of a family is /api/admin/families, which gives sizes
      // and dates and no way into the tree. Two doors onto the same question
      // is how one of them ends up with the weaker rule.
      if (rows.length && !(req.muti?.scope === 'family' && req.muti.treeId === rows[0].id)) {
        rows.length = 0;
      }
      if (!rows.length) {
        // The same answer whether the key never existed or has been changed:
        // anything finer helps somebody work out which keys are real.
        return res.status(404).json({
          error: 'no_such_family',
          message: 'No family answers to that link. It may have been changed, ' +
                   'copied incompletely, or belong to a family you are not in — ' +
                   'a link is no longer a way in; ask them for an invitation.'
        });
      }
      res.json({ treeId: rows[0].id, name: rows[0].name, key });
    } catch (e) { sendError(res, e); }
  });

  /* Change a family's key, locking out everyone holding the old one. A
     deliberate act with a real cost, so it says what the cost is and hands
     back the new link exactly once. */
  r.post('/tree/:id/rotate-key', own, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `UPDATE trees SET key = mw_new_tree_key(), key_set_at = clock_timestamp()
          WHERE id = $1 RETURNING id, key, name`, [req.params.id]);
      if (!rows.length) return res.status(404).json({ error: 'no_such_family' });
      await audit.record(pool, audit.from(req, {
        kind: 'family.key_rotated', ok: true, treeId: req.params.id,
        actor: actorOf(req), sessionId: req.muti?.session?.id }));
      res.json(rows[0]);
    } catch (e) { sendError(res, e); }
  });

  // The write path. An array of operations, applied in one transaction, all or
  // nothing. Returns the new seq and the map of local refs to minted ids.
  r.post('/tree/:id/ops', own, async (req, res) => {
    try {
      const ops = Array.isArray(req.body) ? req.body : req.body?.ops;

      /* NOBODY GOES IN ON THEIR OWN.
       *
       * "To be added to the tree you need to be connected to somebody. You
       *  have to pick someone who you know to be in the tree and connect from
       *  them."
       *
       * The page already refuses this in three places — the welcome field
       * takes one name and only while the tree is empty, every bud grows off
       * somebody, and the front door asks a newcomer for a relative before it
       * writes anything. All three are in a browser, and a rule kept only in
       * a browser is a rule kept only while the browser is the one this
       * project shipped. This is the door every write comes through. */
      /* AND HELD TO ONE SIDE OF THE FAMILY, where the link that got them in
         said so. Checked inside the transaction, before and after, so a
         refusal rolls the whole batch back. See db/branch.js. */
      const held = await branchOf(pool, req);
      const result = await applyOps(pool, req.params.id, ops, actorOf(req),
                                    { everyoneJoined: true,
                                      passcode: passcodeOf(req),
                                      passKey: limitKeyOf(req),
                                      within: held ? { anchorId: held.anchorId } : null });

      /* ── AND IF THAT JUST DOUBLED SOMEBODY, THE TWO BECOME ONE ───────────
       *
       * "When names are duplicated, merge them."
       *
       * Asked for twice. The argument against — three living Garikais in one
       * family is ordinary, because children are named after their
       * grandfathers — is not abandoned; it decides where the line goes. Only
       * the pairs a family would not have to think about are folded: the same
       * spouse, the same child or the same parents with nothing against, or
       * the plain signature of one person written down twice (same name, same
       * birth year, same mutupo, nothing against). Everything else is still
       * offered and still decided by whoever knows. See db/duplicates.js.
       *
       * SCOPED TO WHAT THIS BATCH TOUCHED. A whole-tree scan is a second and
       * a half on five thousand people and would be paid on every keystroke's
       * worth of sync. The question here is the one that was asked: does the
       * name just entered double one already in the family.
       *
       * AND IT NEVER FAILS THE WRITE. The family's edit is already saved and
       * is not going to be rolled back because a tidy-up went wrong.
       */
      let merged = [];
      try {
        const touched = new Set();
        for (const o of (ops || [])){
          if (!o) continue;
          if (o.op === 'addPerson' && o.ref && result?.refs?.[o.ref]) touched.add(result.refs[o.ref]);
          if (o.op === 'updatePerson' && o.id) touched.add(result?.refs?.[o.id] || o.id);
        }
        if (touched.size){
          const pairs = await duplicates.conclusiveFor(pool, req.params.id, [...touched]);
          const done = new Set();
          for (const pair of pairs){
            /* THE OLDER RECORD STAYS. It is the one the family has been
               working against — it is what links, sessions and anybody's open
               screen already name — and the one just typed is the copy. Where
               the newer record carries detail the older one lacks, the merge
               fills it in, so nothing typed is lost by being folded. */
            const [keep, drop] = touched.has(pair.b.id) ? [pair.a, pair.b] : [pair.b, pair.a];
            if (done.has(keep.id) || done.has(drop.id)) continue;
            done.add(keep.id); done.add(drop.id);
            await applyOps(pool, req.params.id, [{
              op:'mergePeople', keepId: keep.id, mergeId: drop.id,
              why: `Folded into ${keep.name} automatically — ${pair.why.join('; ')}. ` +
                   `If they are two different people, this can be undone.`
            }], actorOf(req));
            merged.push({ keep, dropped: drop, why: pair.why });
          }
          if (merged.length) access.forgetTree(req.params.id);
        }
      } catch (e) { /* the family's edit is saved; a tidy-up is not worth losing it */ }
      if (merged.length) result.merged = merged;

      /* ── AND ACROSS THE WALL, THEY ARE SIMPLY TOLD ───────────────────────
       *
       * "If they should have a duplication, they are told that that person is
       *  already added to the family tree and they are through — whoever is
       *  available on their side to see."
       *
       * A family given one side of the tree cannot see the other side, so the
       * commonest duplicate they will make is one they had no way of knowing
       * about: a cousin who married into the other house and was written down
       * there years ago. Folding those where the app is certain already
       * happens above and needs nothing here — a fold is a fold whichever
       * side of a wall it happens on, and the record that stays gains their
       * links, which is what brings that person into view for them.
       *
       * What is left is everything SHORT of certain, which a family working
       * blind will produce far more of than a family that can see. They are
       * told, and told the one thing that is theirs to know: the name. Not
       * whose child that person is, not who they married, not where in the
       * tree they sit — a branch that could ask "is there a Ratidzo?" and be
       * answered with a family would be a branch with a keyhole in its wall.
       * The name alone is enough to send somebody to ask an elder, which is
       * how a family resolves this anyway.
       *
       * ONLY for a session behind a wall. A family that can see the whole
       * tree already has the duplicates room, which says all of this and
       * more, and does not need to be told twice on every save. */
      try {
        if (held && result?.refs){
          const made = Object.values(result.refs);
          const near = made.length
            ? await duplicates.likelyFor(pool, req.params.id, made,
                                         { threshold: duplicates.BEHIND_A_WALL }) : [];
          const folded = new Set(merged.map(m => m.dropped.id));
          const elsewhere = near
            .filter(pair => !folded.has(pair.mine.id))
            .map(pair => ({ name: pair.theirs.name, youWrote: pair.mine.name }));
          if (elsewhere.length){
            result.alreadyHere = elsewhere;
            result.alreadyHereSaid = elsewhere.length === 1
              ? `${elsewhere[0].name} is already in this family tree. If that is ` +
                `who you meant, somebody who can see the whole family can join ` +
                `the two — ask them rather than writing the name again.`
              : `${elsewhere.length} of those names are already in this family ` +
                `tree: ${elsewhere.map(e => e.name).join(', ')}. If those are who ` +
                `you meant, somebody who can see the whole family can join them up.`;
          }
        }
      } catch (e) { /* being told is a kindness, not a guarantee; never fail the write */ }
      /* A merge can move a session's viewer onto the record that stayed (see
         mergePeople). The sessions cache holds who each session is, so it has
         to be told — otherwise the person who just folded away their own
         duplicate goes on being reckoned from a record that is now set aside,
         for as long as the cache lasts. */
      if ((ops || []).some(o => o && o.op === 'mergePeople')) {
        access.forgetTree(req.params.id);
      }
      // WHAT was done, coarsely. The `changes` table already holds every edit
      // in full; recording the detail again here would be two records of one
      // act that can disagree. This says a batch arrived, from where, and of
      // what kinds — which is what makes an edit findable in the record beside
      // the sign-in that preceded it.
      audit.record(pool, audit.from(req, {
        kind: 'tree.ops', ok: true, treeId: req.params.id, actor: actorOf(req),
        sessionId: req.muti?.session?.id,
        detail: { count: Array.isArray(ops) ? ops.length : 0,
                  kinds: [...new Set((ops || []).map(o => o && o.op).filter(Boolean))],
                  seq: result?.seq }
      })).catch(() => {});
      res.json(result);
    } catch (e) { sendError(res, e); }
  });

  /* ── PUTTING YOURSELF IN THE TREE, LINKED ────────────────────────────────
   *
   * "Do not allow someone to start a name that is not linked. If they access
   *  the tree and they are not yet added, they should be instructed to search
   *  for a name they directly link to like a parent or sibling or grandparent
   *  and link themselves appropriately."
   *
   * WHAT WAS THERE BEFORE. The who-are-you panel offered "Add me to the
   * family", which asked for a name in a browser prompt() and posted a bare
   * addPerson. One tap, and a name joined to nothing — the single biggest
   * source of the floating names this project has just spent a week learning
   * to find. It was the app's own front door making them.
   *
   * WHY THIS IS A SERVER ROUTE AND NOT A PANEL. A session that has not said
   * who it is cannot read the tree: it is given a roster of names and nothing
   * else, on purpose, because every word the app produces is reckoned from
   * one person and it will not describe a family to nobody. So the page
   * asking to be joined does not know who is married to whom and MUST NOT
   * learn — handing it the marriages to compose the ops itself would give
   * away the whole family graph to a session that has not yet said it is
   * anybody. It says one sentence, "Chaitezvi is my grandfather", and the
   * server does the joining.
   *
   * WHAT IT WILL NOT DO. There is no way through here that makes an unlinked
   * person. Every relation resolves to a union, and a grandparent takes the
   * parent in between — because a grandchild cannot hang off a grandparent,
   * and asking for the name of the person between them is the honest way to
   * find out, not an obstacle. Where the link cannot be made the answer says
   * which fact is in the way, in a sentence a person can act on.
   *
   * THE ANSWER IS A CLAIM, like every `by` in this project. Somebody with the
   * family's passcode saying they are Sydney's daughter is exactly as
   * authenticated as somebody with the family's passcode saying anything
   * else, and the record says who said it.
   */
  const AS_WORDS = {
    father: 'child', mother: 'child',
    brother: 'sibling', sister: 'sibling',
    son: 'parent', daughter: 'parent',
    husband: 'partner', wife: 'partner',
    grandfather: 'grandparent', grandmother: 'grandparent'
  };

  r.post('/tree/:id/join-me', own, async (req, res) => {
    const client = await pool.connect();
    try {
      const treeId = req.params.id;
      const name = String(req.body?.name || '').trim();
      const sex = ['m', 'f'].includes(req.body?.sex) ? req.body.sex : '';
      const to = String(req.body?.to || '');
      const word = String(req.body?.as || '');
      const kind = AS_WORDS[word];
      const via = req.body?.via || null;

      if (!name) return res.status(400).json({ error:'no_name',
        message:'Say the name the family would write down for you.' });
      if (!kind) return res.status(400).json({ error:'no_relation',
        message:'Say what that person is to you.' });

      const { rows: anchorRows } = await client.query(
        'SELECT id, name FROM people WHERE id = $1 AND tree_id = $2 AND aside_at IS NULL',
        [to, treeId]);
      if (!anchorRows.length) return res.status(404).json({ error:'no_such_person',
        message:'That person is not in this family tree.' });
      const anchor = anchorRows[0];

      const ops = [];
      const mine = { op:'addPerson', ref:'$me', name, sex, by:name };

      // Which union a child of `who` belongs to. The one the family has
      // recorded most about, so a newcomer joining a man with two marriages
      // lands in the one with his children in it rather than an empty one —
      // and the card can move them if that is the wrong marriage.
      const bestUnionOf = async who => {
        const { rows } = await client.query(
          `SELECT u.id, (SELECT count(*) FROM union_children c WHERE c.union_id = u.id) AS kids
             FROM unions u JOIN union_partners up ON up.union_id = u.id
            WHERE up.person_id = $1 ORDER BY kids DESC, u.created_at LIMIT 1`, [who]);
        return rows.length ? rows[0].id : null;
      };
      const parentUnionOf = async who => {
        const { rows } = await client.query(
          'SELECT union_id FROM union_children WHERE person_id = $1', [who]);
        return rows.length ? rows[0].union_id : null;
      };

      if (kind === 'child'){
        const u = await bestUnionOf(anchor.id);
        ops.push(mine);
        if (u) ops.push({ op:'addChild', unionId:u, personId:'$me' });
        else {
          ops.push({ op:'addUnion', ref:'$u' },
                   { op:'addPartner', unionId:'$u', personId:anchor.id },
                   { op:'addChild', unionId:'$u', personId:'$me' });
        }
      }
      else if (kind === 'sibling'){
        const pu = await parentUnionOf(anchor.id);
        ops.push(mine);
        if (pu) ops.push({ op:'addChild', unionId:pu, personId:'$me' });
        else {
          // No parents recorded for them either, so the two simply share
          // whoever theirs turn out to be — which is a union with no partners
          // in it yet, exactly as the page does it.
          ops.push({ op:'addUnion', ref:'$u' },
                   { op:'addChild', unionId:'$u', personId:anchor.id },
                   { op:'addChild', unionId:'$u', personId:'$me' });
        }
      }
      else if (kind === 'parent'){
        const pu = await parentUnionOf(anchor.id);
        if (pu){
          const { rows } = await client.query(
            'SELECT count(*)::int AS n FROM union_partners WHERE union_id = $1', [pu]);
          if (rows[0].n >= 2) return res.status(409).json({ error:'both_parents_known',
            message:`${anchor.name} already has both parents recorded. If one of ` +
                    `them is you, find yourself on the list instead; if one of them ` +
                    `is wrong, somebody in the family can put it right from their card.` });
          ops.push(mine, { op:'addPartner', unionId:pu, personId:'$me' });
        } else {
          ops.push(mine,
                   { op:'addUnion', ref:'$u' },
                   { op:'addPartner', unionId:'$u', personId:'$me' },
                   { op:'addChild', unionId:'$u', personId:anchor.id });
        }
      }
      else if (kind === 'partner'){
        const { rows } = await client.query(
          `SELECT u.id FROM unions u JOIN union_partners up ON up.union_id = u.id
            WHERE up.person_id = $1
              AND (SELECT count(*) FROM union_partners x WHERE x.union_id = u.id) = 1
            ORDER BY u.created_at LIMIT 1`, [anchor.id]);
        ops.push(mine);
        if (rows.length) ops.push({ op:'addPartner', unionId:rows[0].id, personId:'$me' });
        else ops.push({ op:'addUnion', ref:'$u' },
                      { op:'addPartner', unionId:'$u', personId:anchor.id },
                      { op:'addPartner', unionId:'$u', personId:'$me' });
      }
      else if (kind === 'grandparent'){
        /* THE ONE THAT NEEDS A THIRD PERSON. Nobody hangs off a grandparent
           — there is a mother or a father in between, and the tree is wrong
           without them. So the name of that person is asked for rather than
           the link being fudged, and both go in together. */
        /* AND IF THAT PERSON IS ALREADY HERE, PICKED RATHER THAN RETYPED.
         *
         * "You have to pick someone who you know to be in the tree and
         *  connect from them."
         *
         * The same sentence applies twice in this branch, and it used to
         * apply only once. Somebody joining on beside their grandfather was
         * asked for the parent in between as free text, and that text was
         * always written down as a NEW person — so a grandson whose father is
         * already in the tree put his father in a second time, on his way to
         * saying who he was. The app's own front door made a duplicate out of
         * a man it was already looking at.
         *
         * So the page offers the roster here too, and hands back an id when
         * somebody picks off it. A typed name still makes a new record,
         * because sometimes the parent genuinely is not here yet. */
        const viaId = String(via?.id || '').trim();
        let viaRef = '$via';
        if (viaId){
          const { rows } = await client.query(
            'SELECT id FROM people WHERE id = $1 AND tree_id = $2 AND aside_at IS NULL',
            [viaId, treeId]);
          if (!rows.length) return res.status(404).json({ error:'no_such_person',
            message:'The one in between is not in this family tree.' });
          if (rows[0].id === anchor.id) return res.status(400).json({ error:'need_the_one_between',
            message:`${anchor.name} cannot be the one in between as well. Name your ` +
                    `mother or father, who is between you and them.` });
          viaRef = rows[0].id;
        }
        const viaName = String(via?.name || '').trim();
        if (!viaId && !viaName) return res.status(400).json({ error:'need_the_one_between',
          message:`Nobody hangs off a grandparent directly — your mother or ` +
                  `father is between you and ${anchor.name}. Say their name and ` +
                  `both of you go in together.` });
        const viaSex = ['m', 'f'].includes(via?.sex) ? via.sex : '';

        if (!viaId){
          const u = await bestUnionOf(anchor.id);
          ops.push({ op:'addPerson', ref:'$via', name:viaName, sex:viaSex, by:name });
          if (u) ops.push({ op:'addChild', unionId:u, personId:'$via' });
          else ops.push({ op:'addUnion', ref:'$gu' },
                        { op:'addPartner', unionId:'$gu', personId:anchor.id },
                        { op:'addChild', unionId:'$gu', personId:'$via' });
        }
        /* A parent already in the tree keeps whatever parents the family gave
           them. Re-hanging them under the anchor here would overwrite that,
           and the anchor being their parent is what the person answering just
           said, not something to re-record on top of what is already there. */

        /* And into their marriage if they already have one with room in it,
           rather than inventing a second. A newcomer joining beside their
           grandfather should land among their brothers and sisters. */
        let intoUnion = null;
        if (viaId) intoUnion = await bestUnionOf(viaRef);
        ops.push(mine);
        if (intoUnion) ops.push({ op:'addChild', unionId:intoUnion, personId:'$me' });
        else ops.push({ op:'addUnion', ref:'$pu' },
                      { op:'addPartner', unionId:'$pu', personId:viaRef },
                      { op:'addChild', unionId:'$pu', personId:'$me' });
      }

      /* The same rule, on the door a newcomer comes through. This route
         composes its own ops and every branch above joins somebody to the
         anchor, so this should never fire — which is exactly why it is here.
         The one door in this app whose whole job is "do not let a name in on
         its own" should be the one that proves it. */
      const result = await applyOps(pool, treeId, ops, name || actorOf(req),
                                    { everyoneJoined: true });
      const meIdMade = result?.refs?.['$me'] || null;
      audit.record(pool, audit.from(req, {
        kind: 'tree.join_me', ok: true, treeId, actor: name,
        sessionId: req.muti?.session?.id,
        detail: { as: word, to: anchor.id, made: meIdMade, viaMade: result?.refs?.['$via'] || null }
      })).catch(() => {});

      res.status(201).json({
        id: meIdMade,
        via: result?.refs?.['$via'] || null,
        seq: result?.seq,
        // Said back, so nobody has to guess what the app did with their answer.
        recorded: `${name} is recorded as ${anchor.name}'s ` +
                  (kind === 'child' ? (sex === 'f' ? 'daughter' : sex === 'm' ? 'son' : 'child')
                 : kind === 'sibling' ? (sex === 'f' ? 'sister' : sex === 'm' ? 'brother' : 'brother or sister')
                 : kind === 'parent' ? (sex === 'f' ? 'mother' : sex === 'm' ? 'father' : 'parent')
                 : kind === 'partner' ? (sex === 'f' ? 'wife' : sex === 'm' ? 'husband' : 'partner')
                 : `grandchild, through ${String(via?.name || '').trim()}`) + '.'
      });
    } catch (e) { sendError(res, e); }
    finally { client.release(); }
  });

  // The neighbourhood around one person, not the whole tree. This is the call
  // that has to stay fast as the tree grows — the client shows one corner of
  // the family, so it should load one corner of the family.
  r.get('/tree/:id/bootstrap', own, async (req, res) => {
    try {
      const held = await branchOf(pool, req);
      if (held) {
        const reach = await reachOf(pool, req.params.id, held);
        return res.json(await branchTree(pool, req.params.id, {
          ...reach, anchorId: held.anchorId, name: held.name || held.anchorName }));
      }
      res.json(await bootstrap(pool, req.params.id, {
        focus: req.query.focus || null,
        depth: req.query.depth ?? 3
      }));
    } catch (e) { sendError(res, e); }
  });

  // Incremental sync. The client holds a seq and asks for what it is missing,
  // rather than re-fetching a tree it already mostly has.
  r.get('/tree/:id/changes', own, async (req, res) => {
    try {
      const held = await branchOf(pool, req);
      if (held) {
        const reach = await reachOf(pool, req.params.id, held);
        return res.json(await branchChanges(pool, req.params.id, req.query.since,
                                            req.query.limit, reach));
      }
      res.json(await changesSince(pool, req.params.id, req.query.since, req.query.limit));
    } catch (e) { sendError(res, e); }
  });

  r.get('/tree/:id/search', own, async (req, res) => {
    try {
      const found = await search(pool, req.params.id, req.query.q, { limit: req.query.limit });
      const held = await branchOf(pool, req);
      if (!held) return res.json(found);
      /* Searching is reading. A branch that could find somebody by name would
         be a branch that could enumerate the family one guess at a time, and
         the family context each hit carries names their parents and their
         children as well. */
      const { members } = await reachOf(pool, req.params.id, held);
      res.json({ ...found, results: (found.results || []).filter(h => members.has(h.id)) });
    } catch (e) { sendError(res, e); }
  });

  // Duplicate candidates. Runs on the server, on demand — never inside a
  // render. The old client scored every person against every other one on
  // every frame, which at 3,000 people is 4.5 million comparisons per frame.
  r.get('/tree/:id/duplicates', own, async (req, res) => {
    try {
      res.json(await findDuplicates(pool, req.params.id, {
        threshold: req.query.threshold ? Number(req.query.threshold) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      }));
    } catch (e) { sendError(res, e); }
  });

  /* Who is currently set aside — the whole of it with no query, or just the
     entries one person recorded when ?recordedBy= is given.

     ?recordedBy=<name> is the notice feed: "entries of yours that somebody
     has taken out of the tree, and why". It is a plain read of live state, so
     it is always current and never needs marking as seen. */
  r.get('/tree/:id/set-aside', own, async (req, res) => {
    try {
      const recordedBy = req.query.recordedBy;
      res.json(await setAsideList(pool, req.params.id,
        recordedBy === undefined ? {} : { recordedBy: String(recordedBy) }));
    } catch (e) { sendError(res, e); }
  });

  /* Families this one may share an ancestor with.
 
     Computed on demand and never stored: it is derived from names, totems and
     dates that change as families record more, so a stored match would be a
     stored answer going stale. What gets stored is a human's decision about
     one, which does not. */
  r.get('/tree/:id/relatives', own, async (req, res) => {
    try {
      res.json(await findRelatives(pool, req.params.id, {
        threshold: req.query.threshold ? Number(req.query.threshold) : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined
      }));
    } catch (e) { sendError(res, e); }
  });

  /* Links already proposed, confirmed or rejected, from this tree's side. */
  r.get('/tree/:id/links', own, async (req, res) => {
    try {
      const status = req.query.status ? String(req.query.status) : null;
      res.json({ treeId: req.params.id, links: await linksFor(pool, req.params.id, status) });
    } catch (e) { sendError(res, e); }
  });

  return r;
};

/* The world's view: ancestors, and any living person who has chosen to be
   published. Mounted on its own router so it can live OUTSIDE the passphrase
   gate — a public record behind a passphrase is not a public record.
 
   Nothing here takes a family key, and nothing here can reach a private
   person: it calls publicTree/publicPerson, which have no parameter that
   would let them. */
module.exports.publicRoutes = function publicRoutes(pool) {
  const r = express.Router();

  // No `own` here, and there must never be one. This router is mounted OUTSIDE
  // the gate: it is the world's view, and the world has no session to own a
  // family with. What keeps it safe is not a guard but what it calls —
  // publicTree and publicPerson have no parameter that could return a private
  // person.
  r.get('/tree/:id', async (req, res) => {
    try { res.json(await publicTree(pool, req.params.id)); }
    catch (e) { sendError(res, e); }
  });

  r.get('/person/:id', async (req, res) => {
    try {
      const found = await publicPerson(pool, req.params.id);
      // The same answer for "private" and "no such person". Anything else
      // confirms that somebody exists, which is half of what was being kept
      // back.
      if (!found) return res.status(404).json({ error: 'not_found' });
      res.json(found);
    } catch (e) { sendError(res, e); }
  });

  return r;
};
