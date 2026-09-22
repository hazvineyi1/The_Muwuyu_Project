-- 016: what a merge moved, so that a merge can be taken back.
--
-- "When names are duplicated, merge them."
--
-- Said twice, and the second time after this project had argued against it.
-- So it is being built. What makes it safe to build is not judgement about
-- which pairs to fold — that is the part everybody argues about — it is that
-- folding the wrong pair has to be an ordinary mistake rather than a
-- permanent one.
--
-- A merge already sets the folded record ASIDE rather than deleting it, with
-- merged_into saying where its details went. That is enough to READ a merge
-- back. It is not enough to UNDO one, because by then the folded record's
-- marriages and its place among its parents' children have already moved to
-- the record that stayed, and nothing anywhere says where they came from.
--
-- So the merge writes down what it moved, on the row it folded:
--
--   parentUnion   the union it was a child of, and at which birth order, or
--                 null where it had no parents recorded
--   partnerUnions the marriages it was a partner in, with the position it
--                 held in each
--   filled        the fields that were BLANK on the survivor and were taken
--                 from this record, so they can be blanked again — otherwise
--                 undoing a merge leaves the survivor wearing the other
--                 record's birth year
--   collapsed     marriages that were folded together because both records
--                 were married to the same person. This is the one part an
--                 undo cannot simply reverse, and it is written down so the
--                 app can SAY so rather than quietly restore half a thing.
--
-- JSONB and not four columns, because this is a record of one past act rather
-- than a fact about a person. Nothing queries inside it; it is read whole, by
-- the undo, and by nothing else.
--
-- NULL everywhere it has always been null. Every merge already done on this
-- deployment has no such record and cannot be undone automatically — those
-- stay exactly as they are, readable and hand-fixable, which is what they
-- were before this file existed.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS merged_undo JSONB;

COMMENT ON COLUMN people.merged_undo IS
  'What the merge that folded this record moved, so it can be put back. '
  'NULL for records folded before migration 016, and for records never folded.';
