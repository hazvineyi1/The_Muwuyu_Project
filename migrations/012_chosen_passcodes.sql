-- 012: a passcode somebody chose.
--
-- WHAT THIS ADDS, and the honest reason for it. Until now a passcode was
-- always generated: handle-xxxxxx-xxxxxx, about 59 bits, unguessable. The
-- keeper could issue one and never choose one, and that was deliberate — a
-- chosen secret is a weak secret, near enough always.
--
-- A family has asked for a passcode they can say out loud. That is a real
-- need and a bad secret at the same time, and both halves of that sentence
-- are true at once. This column exists so the second half is never invisible.
--
-- WHY A COLUMN AND NOT AN INFERENCE. A scrypt hash of "musoni" and a hash of
-- "k7mpq3-w4ndra-pt9vbz" are the same forty bytes of noise. Nothing about the
-- stored value says which one it came from, so nothing in the dashboard could
-- tell the keeper that a family is protected by a word anyone would guess.
-- Without this column that fact is unrecoverable the moment it is set.
--
-- It records HOW the passcode got there, not how good it is — there is no
-- scoring here and there should not be. The keeper is shown the flag and
-- decides; the app does not grade anybody's choice.
--
-- NOTHING IS ENFORCED BY IT. It does not restrict sign-in, does not expire,
-- does not nag. It is set true when a passcode is chosen and false again the
-- moment a generated one replaces it, so it always describes the passcode
-- that is actually in force rather than the history of the family.

ALTER TABLE trees
  ADD COLUMN IF NOT EXISTS passcode_chosen BOOLEAN NOT NULL DEFAULT FALSE;

-- The keeper's "which families are on a word rather than a secret" question,
-- which is the whole reason the column exists. Partial, because the answer is
-- expected to be a short list forever — if it is ever most of the table, that
-- is worth seeing too.
CREATE INDEX IF NOT EXISTS trees_passcode_chosen_idx ON trees (passcode_chosen)
  WHERE passcode_chosen;
