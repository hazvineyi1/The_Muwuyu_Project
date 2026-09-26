-- 019: what the family is not sure of, said out loud.
--
-- "Handle uncertainty explicitly. Hazvina kusimbiswa."
--
-- Every record in this tree is stated as fact. A year somebody read off a
-- gravestone and a year an aunt half-remembers are the same row; a marriage
-- everybody attended and one nobody can quite place are the same union. The
-- app then reads a Shona term off those links and says it in gold on a pod,
-- with no way of knowing that one step of the reasoning was a guess.
--
-- WHICH IS NOT A GAP IN THE DATA, IT IS A GAP IN WHAT CAN BE SAID. A family
-- filling in three generations from memory knows perfectly well which parts
-- they are sure of. There has never been anywhere to put that, so the honest
-- answer — "we think so, nobody has confirmed it" — has to be recorded as
-- certainty or not recorded at all, and both of those are wrong. Families
-- have chosen the second and left people out.
--
-- ON BOTH TABLES, because both kinds of thing can be doubted and they are
-- doubted about different things. A PERSON may be remembered under a name
-- nobody can check, with a year that is somebody's best guess. A UNION is
-- the link itself — whether these two were married, whether this child is
-- theirs — and a doubtful union is what makes every kinship term downstream
-- of it doubtful too. That second one is the whole reason this is a column
-- on unions and not just a note on a card: the engine can follow it.
--
-- NULLABLE, AND THE NULL IS THE POINT, exactly as in migration 018. Three
-- states and they are three different things:
--
--   NULL   nobody has said. Not the same as confirmed — it is this app's
--          own silence, and it is what every record ever entered holds. The
--          tree says nothing about it, which is what it has always done.
--   ''     somebody has marked this as not confirmed and given no reason.
--          An answer, not an absence.
--   text   not confirmed, and this is what is in doubt or who to ask:
--          "Ambuya says 1938, her sister says 1941", "nobody living
--          remembers whether they married or only lived together".
--
-- A NOT NULL DEFAULT '' column cannot tell the first of those from the
-- second, and "we have looked at this and we are not sure" is precisely the
-- thing being recorded.
--
-- NOTHING IS DELETED, HIDDEN OR DERIVED DIFFERENTLY BECAUSE OF IT. An
-- unconfirmed person is in the tree, drawn, counted and related to everybody
-- exactly as before; an unconfirmed union still joins the two people it
-- joins. What changes is only what the app CLAIMS: a word read off a chain
-- with an unconfirmed link in it is shown as not confirmed, and says which
-- link it is. The app has never been willing to say a word nobody said; this
-- is the same rule applied to the links underneath the words.

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS unsure TEXT DEFAULT NULL;

ALTER TABLE unions
  ADD COLUMN IF NOT EXISTS unsure TEXT DEFAULT NULL;
