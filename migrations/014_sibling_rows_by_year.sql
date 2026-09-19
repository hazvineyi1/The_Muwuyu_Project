-- 014: every sibling row on this deployment, put into birth order.
--
-- WHAT THIS IS, SAID PLAINLY. This rewrites recorded data belonging to every
-- family on this deployment, without asking any of them. That is what was
-- asked for, deliberately and after the cost was put in writing, and this
-- file is not going to pretend it is smaller than it is.
--
-- THE COST. A sibling row is not derived — it is the family's own statement
-- of who is senior, and it is what olderThan falls back on when there are no
-- dates. Some of those rows were arranged by hand, with the arrows, by
-- somebody who knew something the birth years do not say. This cannot tell
-- those rows apart from the ones that are merely in the order somebody
-- happened to type them, so it overwrites both.
--
-- WHICH IS WHY IT IS REVERSIBLE. Every row it moves is written to
-- sibling_order_before_014 first, with the position it held. That table is
-- not cleaned up and is not meant to be: it is the only record that these
-- rows were ever arranged differently, and without it this migration would
-- be the one irreversible act in a project whose whole design is that nothing
-- is. The undo is at the bottom of this file, in a comment, ready to run.
--
-- WHAT IT DOES NOT TOUCH, because it cannot:
--
--   ANYBODY WITHOUT A BIRTH YEAR. There is nothing to sort them by. They keep
--   the exact position they hold, and the dated children are rearranged
--   around them among the slots they already occupy. A "forced sort by year"
--   is not a thing that can be done to a person with no year.
--
--   ANYBODY SET ASIDE. They are out of the drawn picture but still in their
--   parents' marriage, and the app already reckons rows without them. Their
--   slot stays where it is so that restoring them puts them back where the
--   family last had them.
--
--   EQUAL YEARS. Two children recorded as born in the same year keep their
--   existing order relative to each other. The sort is stable on the current
--   birth_order for exactly that reason: where the years cannot decide, the
--   family's row still does.
--
-- born_year is the column the database already derives from the free-text
-- `born` field, so this uses the same notion of "what year is that" as every
-- other query here rather than inventing a second one. (It is very slightly
-- broader than the browser's: mw_born_year takes any 1000-2999 run.)

-- ---------------------------------------------------------------------------
-- 1. The way back.

CREATE TABLE IF NOT EXISTS sibling_order_before_014 (
  person_id   UUID PRIMARY KEY,
  union_id    UUID NOT NULL,
  birth_order SMALLINT NOT NULL,
  at          TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ---------------------------------------------------------------------------
-- 2. Work out where each dated child should stand.
--
-- The shape of it: take the slots the dated children of one marriage already
-- occupy, take those same children sorted by year, and deal one into the
-- other. The row's overall shape — including every gap an undated or
-- set-aside sibling is sitting in — is preserved exactly.

CREATE TEMP TABLE mw_014_target ON COMMIT DROP AS
WITH dated AS (
  SELECT uc.union_id, uc.person_id, uc.birth_order, p.born_year
    FROM union_children uc
    JOIN people p ON p.id = uc.person_id
   WHERE p.aside_at IS NULL
     AND p.born_year IS NOT NULL
),
slot AS (
  SELECT union_id, birth_order,
         row_number() OVER (PARTITION BY union_id ORDER BY birth_order) AS n
    FROM dated
),
ranked AS (
  -- Stable: birth_order breaks a tie on the year, so equal years keep the
  -- order the family already had them in.
  SELECT union_id, person_id,
         row_number() OVER (PARTITION BY union_id
                            ORDER BY born_year, birth_order) AS n
    FROM dated
)
SELECT r.union_id, r.person_id, s.birth_order AS new_order
  FROM ranked r
  JOIN slot s ON s.union_id = r.union_id AND s.n = r.n;

-- ---------------------------------------------------------------------------
-- 3. Keep the old positions of everyone actually about to move.
--
-- Only the rows that CHANGE are recorded. A backup of rows that were already
-- right would make the undo below claim to have restored things it never
-- touched, and would make the count in step 5 a lie.

INSERT INTO sibling_order_before_014 (person_id, union_id, birth_order)
SELECT uc.person_id, uc.union_id, uc.birth_order
  FROM union_children uc
  JOIN mw_014_target t ON t.person_id = uc.person_id
 WHERE t.new_order <> uc.birth_order
ON CONFLICT (person_id) DO NOTHING;   -- a re-run must not lose the first record

-- ---------------------------------------------------------------------------
-- 4. Move them.
--
-- union_children_order_unique is DEFERRABLE INITIALLY DEFERRED, which is what
-- makes this a single statement rather than a shuffle through temporary
-- positions: two children swapping slots collide only in the middle of the
-- update, and the constraint is not checked until the transaction commits.

UPDATE union_children uc
   SET birth_order = t.new_order
  FROM mw_014_target t
 WHERE t.person_id = uc.person_id
   AND t.new_order <> uc.birth_order;

-- ---------------------------------------------------------------------------
-- 5. Tell the families' open browsers.
--
-- Without this the migration silently loses. A browser that is open right now
-- holds the tree as it was, polls /changes, is told nothing has happened, and
-- pushes the old order straight back up on its next save. One row per tree
-- that actually moved is enough: the client sees the log has advanced and
-- re-reads the tree.
--
-- It is also the honest place to record it. `changes` is what a family reads
-- to see what happened to their tree, and a rewrite of their sibling rows
-- that left no trace there would be a change nobody could account for.

INSERT INTO changes (tree_id, entity, entity_id, op, payload, by)
SELECT u.tree_id, 'union', NULL, 'reorder',
       jsonb_build_object(
         'migration', '014_sibling_rows_by_year',
         'moved', count(*),
         'why', 'every sibling row on this deployment put into birth order'),
       'the keeper'
  FROM sibling_order_before_014 b
  JOIN unions u ON u.id = b.union_id
 GROUP BY u.tree_id;

-- ---------------------------------------------------------------------------
-- THE UNDO, kept here rather than in anybody's memory.
--
-- Run this to put every moved child back exactly where their family had them.
-- It is deliberately not automatic: restoring is a decision, the same as the
-- move was.
--
--   BEGIN;
--   UPDATE union_children uc
--      SET birth_order = b.birth_order
--     FROM sibling_order_before_014 b
--    WHERE b.person_id = uc.person_id
--      AND b.union_id  = uc.union_id;
--   INSERT INTO changes (tree_id, entity, entity_id, op, payload, by)
--   SELECT u.tree_id, 'union', NULL, 'reorder',
--          jsonb_build_object('migration', '014_sibling_rows_by_year',
--                             'undone', count(*)),
--          'the keeper'
--     FROM sibling_order_before_014 b
--     JOIN unions u ON u.id = b.union_id
--    GROUP BY u.tree_id;
--   COMMIT;
--
-- Do not DELETE FROM sibling_order_before_014 afterwards. Once it is gone the
-- rows can never be put back a second time, and the fact that they were ever
-- moved is gone with it.
