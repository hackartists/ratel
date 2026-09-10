-- Revert the Hot Spaces backfill: drop exactly the four seeded rows.
--
-- Safe to run repeatedly. It removes rows by `space_id`, so if a real fanout
-- has since rewritten one of them, this deletes that row too -- the space then
-- drops out of the Hot tab until its next mutation, which is the same state as
-- before the backfill.

BEGIN;

DELETE FROM hot_spaces
WHERE space_id IN (
  '6b6f21e8-c2d7-5c37-8e43-9222ea146cf0',
  '7b0c6964-796d-51de-a09b-fccc03984d39',
  'd6edee9b-3566-5cc0-a9aa-dba00f021f8e',
  '65c90530-460a-5eaf-bd1a-33b69c3ff063'
);

COMMIT;
