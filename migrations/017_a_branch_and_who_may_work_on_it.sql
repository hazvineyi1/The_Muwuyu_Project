-- 017: a branch of the family, and the people trusted with it.
--
-- "I want to grow my mother's side of the family, Mandaba. I want to give that
--  family access to only grow that aspect without them seeing the full tree,
--  only limited to their part."
--
-- Until now this app has had exactly one wall: the family. You are inside a
-- tree or you are not, and inside it you see everything. That is right for one
-- household and wrong for the thing a tree becomes after a year, which is two
-- or three houses joined by marriages — and the Mandabas have every reason to
-- record their own side and no business reading somebody else's.
--
-- WHAT A BRANCH IS. One person, and the house around them.
--
--   the anchor              Evelyn Mandaba, or her father
--   everybody above them    their parents, and theirs, as far as recorded
--   everybody below those   so: their brothers and sisters, their cousins,
--                           their uncles and aunts — the whole house, not one
--                           line down it
--   and the husbands and    because you cannot record a marriage with half of
--   wives of all of them    it missing
--
-- A HUSBAND OR WIFE IS A WALL, NOT A DOOR. Somebody who married into the
-- Mandabas is visible because their marriage is Mandaba business. Their own
-- parents and their own brothers are not: the walk stops at them. That single
-- rule is what keeps "my mother's side" from quietly meaning "everybody my
-- mother's side has ever married", which after two generations is the tree.
--
-- IT IS COMPUTED, NEVER STORED. The same rule this project holds for kinship
-- terms holds here and for the same reason: a stored membership list is a
-- stale membership list. Somebody adds a Mandaba great-aunt and she is in the
-- branch the moment she is recorded, because the branch is a question asked of
-- the tree rather than a list kept beside it. So this table names the ANCHOR
-- and nothing else about who is in.
--
-- WHY A TABLE AT ALL, then. Because a branch has to be named, made by
-- somebody, given out, and taken back — and none of that is derivable.

CREATE TABLE IF NOT EXISTS branches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tree_id     UUID NOT NULL REFERENCES trees (id) ON DELETE CASCADE,
  -- The person the branch hangs off. Deleting them does not happen in this
  -- app — people are set aside — but a tree can be dropped, and a branch
  -- without its anchor has no meaning.
  anchor_id   UUID NOT NULL REFERENCES people (id) ON DELETE CASCADE,
  -- "the Mandaba side". The family's own words, shown to everybody who works
  -- on it, because "the branch around Evelyn Mandaba" is not what anybody
  -- calls it.
  name        TEXT NOT NULL DEFAULT '',
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  -- Closed rather than deleted, the way everything in this project is, so the
  -- record of who was given what survives the giving back.
  retired_at  TIMESTAMPTZ,
  retired_by  TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS branches_tree_idx ON branches (tree_id, created_at DESC);
CREATE INDEX IF NOT EXISTS branches_anchor_idx ON branches (anchor_id);

COMMENT ON TABLE branches IS
  'A named part of a family tree that can be given out on its own. Who is IN '
  'it is computed from anchor_id every time and never stored.';

-- ---------------------------------------------------------------------------
-- A session, and an invitation, may be tied to one.
--
-- NULL is the whole family, which is what every session and every invitation
-- already in this deployment is and must keep being. A branch session is a
-- narrower thing than a family session, never a wider one: it can only ever
-- be handed out by somebody who already holds the whole family.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS branch_id UUID
  REFERENCES branches (id) ON DELETE CASCADE;
ALTER TABLE invites  ADD COLUMN IF NOT EXISTS branch_id UUID
  REFERENCES branches (id) ON DELETE CASCADE;

COMMENT ON COLUMN sessions.branch_id IS
  'The one branch this session may read and write. NULL means the whole family.';
COMMENT ON COLUMN invites.branch_id IS
  'The branch a link hands out. NULL means the whole family.';

CREATE INDEX IF NOT EXISTS sessions_branch_idx ON sessions (branch_id)
  WHERE branch_id IS NOT NULL;
