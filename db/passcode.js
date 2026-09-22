/* ── THE PASSCODE ON A DELETION ────────────────────────────────────────────
 *
 * "Deletion of a person should require a passcode. Edits can be made to dates
 *  and relationships but deletions can only be done with the passcode."
 *
 * The line it draws is between correcting the record and shortening it.
 * Getting a year wrong, spelling a name the way one branch spells it, saying
 * that two people were married after all — those are the work, they happen
 * all day, and every one of them is reversible from the change log. Removing
 * a person is the one act in this app that takes something out of the family
 * record and does not put it back, and it is the one act a relative can
 * perform by accident with a single tap.
 *
 * WHY THE CODE IS NOT IN THIS FILE. This repository is public. A passcode
 * written into it is a passcode published, so the code lives in the
 * deployment's own environment (MW_DELETE_PASSCODE) and nowhere else — the
 * same rule the keeper's passphrase already follows. The consequence is
 * deliberate: a deployment that has not been given one cannot delete anybody
 * at all. Failing shut is the right way round for an act that cannot be
 * undone; the worst a missing variable can do is make the family ask their
 * keeper, rather than quietly making deletion free.
 *
 * WHY THERE IS A THROTTLE. A family passcode is short by design — it has to
 * be repeatable over the phone to an aunt. Short means guessable, and four
 * digits is ten thousand guesses, which is seconds of automated trying. So
 * three tries are free and every wrong one after that costs a wait that
 * doubles, which turns ten thousand guesses into weeks without ever getting
 * in the way of somebody who has simply mistyped.
 *
 * The counter is in memory. That is honest about what this is: one small
 * app on one machine. It resets on a redeploy, which a patient attacker
 * could wait for — but they would have to wait for a deploy per three
 * guesses, which is a worse rate than the throttle gives them anyway.
 */

const crypto = require('crypto');

const FREE = 3;                       // mistypes that cost nothing
const STEP = 30 * 1000;               // the first wait after those
const CAP  = 15 * 60 * 1000;          // and the longest it ever gets

const tries = new Map();              // key → { wrong, until }

/* Configured, or not. Read every time rather than once at boot: a keeper who
   sets the variable should not have to redeploy to be believed. */
const theCode = () => String(process.env.MW_DELETE_PASSCODE || '').trim();

const set = () => theCode().length > 0;

/* Same-length compare, so the answer does not leak how much of a guess was
   right. Padded because timingSafeEqual throws on a length mismatch, which
   would leak the length by throwing. */
function same(a, b){
  const n = Math.max(a.length, b.length, 1);
  const pad = s => Buffer.concat([Buffer.from(s, 'utf8'), Buffer.alloc(n)], n);
  return crypto.timingSafeEqual(pad(a), pad(b)) && a.length === b.length;
}

/* How long this key still has to wait, in ms. Zero when it may try now. */
function waiting(key, now){
  const t = tries.get(key);
  if (!t || !t.until) return 0;
  return Math.max(0, t.until - now);
}

/* THE ONE ANSWER BOTH DOORS GIVE. The page asks before it removes anybody
   from the screen, and the write path asks again before it removes anybody
   from Postgres — the first is a courtesy so a wrong code costs nothing, the
   second is the gate. Sharing this function is what keeps the courtesy from
   drifting away from the gate. */
function check(key, given, now = Date.now()){
  if (!set()) return { ok:false, reason:'unset' };

  const waitMs = waiting(key, now);
  if (waitMs) return { ok:false, reason:'wait', waitMs };

  if (same(String(given == null ? '' : given).trim(), theCode())){
    tries.delete(key);
    return { ok:true };
  }

  const t = tries.get(key) || { wrong:0, until:0 };
  t.wrong++;
  t.until = t.wrong > FREE
    ? now + Math.min(CAP, STEP * Math.pow(2, t.wrong - FREE - 1))
    : 0;
  tries.set(key, t);
  return { ok:false, reason:'wrong', waitMs: Math.max(0, t.until - now) };
}

/* Only for the tests, which must not wait fifteen minutes to prove that the
   wait works. */
function forget(key){ if (key == null) tries.clear(); else tries.delete(key); }

module.exports = { check, set, forget, FREE, STEP, CAP };
