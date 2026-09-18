// The keeper's own passphrase.
//
// A second key to the admin door, chosen by the person who uses it instead of
// set once in a hosting dashboard and never changed again. See
// migrations/013 for what it is and what it deliberately is not.
//
// EVERYTHING SECRET HERE GOES THROUGH db/access. The scrypt parameters, the
// constant-time comparison and the "a bad stored value reads as no match
// rather than an error" rule are all decided in one place, and a second
// implementation of password checking in a second file is how two of them
// end up disagreeing about something that matters.

const access = require('./access');

/* The shortest passphrase this will accept.
 *
 * A floor, not a grade. This file does not score anybody's choice — the same
 * decision as chosen family passcodes, for the same reason: the person typing
 * it knows things about their situation that a rule in here does not.
 *
 * But a floor there must be, because the failures below it are not judgement
 * calls. Under ten characters, against a door that fronts every family on the
 * deployment, an empty box or a four-letter slip stops being a weak choice and
 * becomes an open door — and the person who made it would have no way of
 * knowing. Ten is low enough that any real passphrase clears it. */
const MIN = 10;

async function current(pool) {
  const { rows } = await pool.query('SELECT passphrase_hash, set_at, set_by FROM keeper');
  return rows[0] || null;
}

/* Is this the keeper's chosen passphrase?
 *
 * False, never a throw, when none is set — the caller then falls through to
 * the environment's key, and a deployment that has never chosen one must
 * behave exactly as it did before this table existed. */
async function check(pool, given) {
  try {
    const row = await current(pool);
    if (!row || !row.passphrase_hash) return false;
    return await access.checkPasscode(given, row.passphrase_hash);
  } catch {
    return false;
  }
}

async function isSet(pool) {
  try { return !!(await current(pool)); } catch { return false; }
}

/* Choose one. Returns { ok } or { ok:false, reason }.
 *
 * Whether the CALLER is allowed to do this is not decided here — it is
 * decided by the route, which requires the passphrase in force before it will
 * call this at all. Keeping the two apart means this function cannot be the
 * place somebody accidentally makes it optional. */
async function set(pool, plain, { by = '' } = {}) {
  const next = String(plain == null ? '' : plain).trim();
  if (!next) return { ok: false, reason: 'empty' };
  if (next.length < MIN) return { ok: false, reason: 'too_short', min: MIN };

  const hash = await access.hashPasscode(next);
  /* One row, replaced. The old hash is not kept: a history of previous
     passphrases is a list of secrets somebody still uses somewhere else, and
     this project has no use for it that outweighs holding it. */
  await pool.query(
    `INSERT INTO keeper (id, passphrase_hash, set_at, set_by)
          VALUES (TRUE, $1, clock_timestamp(), $2)
     ON CONFLICT (id) DO UPDATE
        SET passphrase_hash = EXCLUDED.passphrase_hash,
            set_at          = EXCLUDED.set_at,
            set_by          = EXCLUDED.set_by`,
    [hash, String(by || '').slice(0, 120)]);

  return { ok: true };
}

/* Give it up entirely, so the environment's key is the only one again. The
   way back for a keeper who has forgotten what they chose is to clear this
   from the host and use MW_ADMIN_PASSPHRASE — which is exactly why setting
   one never retires that variable. */
async function clear(pool) {
  await pool.query('DELETE FROM keeper');
  return { ok: true };
}

module.exports = { current, check, isSet, set, clear, MIN };
