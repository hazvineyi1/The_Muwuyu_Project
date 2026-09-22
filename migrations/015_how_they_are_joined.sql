-- 015: how two people are joined, when it is not simply "married".
--
-- "Some people have children with partners but were never married, others are
--  married and others are divorced and others are deceased."
--
-- Every union in this project has meant one thing: married. The word is on
-- the pod, in the kinship term, and in the sentence the app says when one is
-- made. For a great many families that is wrong in both directions — a couple
-- who never married are recorded as husband and wife, and a couple who parted
-- twenty years ago are recorded as though they had not.
--
-- ONE COLUMN, AND WHAT IT IS ALLOWED TO SAY:
--
--   ''          nobody has said. This is the default and it is what every
--               union already recorded becomes, because nobody HAS said —
--               they were entered when the app had only one kind of join.
--               Defaulting them to 'married' would put words in the mouths
--               of every family on this deployment.
--   'married'   they married.
--   'together'  they have children together and did not marry. Said plainly,
--               because the alternative is the app calling a woman somebody's
--               wife when her family does not.
--   'parted'    it ended. Divorce and separation are one value on purpose:
--               a customary marriage that ended is not a decree absolute,
--               most families do not draw the line the courts draw, and an
--               app that demanded they pick would be asking them to file
--               their own lives under somebody else's law.
--
-- WHAT IS NOT HERE, AND WHY. There is no 'widowed'. Whether a partner has
-- died is already recorded, on the person, in `died` — and this project
-- derives what it can derive rather than storing a second copy that can
-- disagree with the first. A stored 'widowed' would be a fact about a
-- marriage that goes stale the moment somebody corrects a date, and it would
-- have to be maintained by hand on the day a family is least able to. So the
-- app reads it off the people, every time, the way it reads every kinship
-- term.
--
-- NOTHING IS REWRITTEN. Unlike 014, this migration changes not one recorded
-- fact: it adds a column whose default is silence, and every union that
-- exists keeps meaning exactly what it meant. What changes is that a family
-- can now say something the app had no way of hearing.

ALTER TABLE unions
  ADD COLUMN IF NOT EXISTS bond TEXT NOT NULL DEFAULT '';

-- The set is closed on purpose. A free-text status would drift into forty
-- spellings of "divorced" across one deployment, and nothing derived from it
-- could be trusted. A family with a word of their own for this teaches it the
-- way they teach every other word — against the shape, in their own lexicon,
-- which is where a family's own words live in this project.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unions_bond_known'
  ) THEN
    ALTER TABLE unions
      ADD CONSTRAINT unions_bond_known
      CHECK (bond IN ('', 'married', 'together', 'parted'));
  END IF;
END $$;

COMMENT ON COLUMN unions.bond IS
  'How the two are joined: married, together (never married), parted, or '''' '
  'for not said. Widowhood is NOT here — it is derived from people.died.';
