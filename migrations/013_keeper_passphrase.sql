-- 013: a passphrase the keeper chose.
--
-- THE GAP THIS FILLS. The keeper's door has one key and it lives in
-- MW_ADMIN_PASSPHRASE — an environment variable. Changing it means opening
-- the hosting dashboard, editing a variable, and waiting for the service to
-- redeploy. That is fine for a deployment secret set once and forgotten. It
-- is wrong for the thing a person types every time they sign in, because the
-- practical consequence is that nobody ever changes it: not when it has been
-- read over somebody's shoulder, not when a helper who had it stops helping,
-- and not when it was weak to begin with.
--
-- So the keeper can set their own, from inside the pages the passphrase opens.
--
-- TWO KEYS, ONE DOOR, AND THE DIFFERENCE MATTERS.
--
--   MW_ADMIN_PASSPHRASE is the DEPLOYMENT's key. It is what turns the
--   keeper's pages on at all — with it unset the admin surface is not
--   mounted, which is the existing fail-closed behaviour and stays exactly as
--   it is. Whoever controls the environment controls the deployment; that was
--   already true and nothing here changes it.
--
--   The row below is the KEEPER's key. A second secret that opens the same
--   door, chosen by the person who uses it, changeable without a deploy.
--
-- Setting one does NOT retire the other, and the dashboard says so where the
-- box is. Pretending otherwise would be the worse lie: the environment
-- variable would go on working while the keeper believed they had replaced
-- it. To retire it, clear it in the host — and know that clearing it turns
-- the admin pages off entirely, which is the point of it being the
-- deployment's key rather than a spare.
--
-- STORED THE SAME WAY AS EVERY OTHER SECRET HERE: a scrypt hash with its own
-- salt, through the same hashPasscode used for family passcodes. The database
-- holds enough to CHECK it and never enough to PRESENT it. There is no
-- endpoint that reads it back and there must never be one.

-- One row, forever. The CHECK is what makes it a singleton: `id` can only be
-- TRUE, and TRUE is the primary key, so a second row cannot be inserted even
-- by a mistake in code that has forgotten this table is meant to hold one.
CREATE TABLE IF NOT EXISTS keeper (
  id              BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  passphrase_hash TEXT        NOT NULL,
  set_at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  -- Self-claimed, like every other actor in this project. With one shared
  -- keeper's door it is the only thing distinguishing two people who use it,
  -- and the audit line beside it does the rest.
  set_by          TEXT        NOT NULL DEFAULT ''
);

-- Nothing is inserted. An empty table means "no keeper's key set yet", which
-- is the correct state for every deployment until somebody chooses one, and
-- it is what makes the environment variable the only key until then.
