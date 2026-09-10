-- Hot Spaces backfill.
--
-- `hot_spaces` is a derived cache: one row per Public+Published space with at
-- least 10 participants, written only by `services::space_fanout`. The table
-- was deliberately left out of the DynamoDB -> Postgres ETL (see the comment
-- on `ID_REF_FIELDS` in app/ratel/src/bin/etl_migrate.rs) because the rows can
-- always be recomputed -- but nothing ever recomputed them. `upsert_hot_space`
-- only runs on a space mutation, and all four eligible spaces were last
-- touched before the migration, so the table stayed empty and
-- `/api/hot-spaces` returned `{"items":[]}` on prod and dev alike.
--
-- This seeds those four rows so the tab works now. Every field is derived from
-- the live tables exactly as the fanout derives it, except `rank_key`, which
-- is a literal: it is a base-62 packing of (window, inverted score) that has
-- to match `WindowedRankKey` byte for byte, so the values below were generated
-- by that very type rather than re-implemented in SQL.
--
--   anchor = 1788999322 (unix secs) -- falls in 30-day window 690
--   score  = freshness_units + participants*6 + total_actions*2
--            freshness_units counts hours ELAPSED since the window started, so
--            a later fanout scores higher; 144 units at this anchor.
--
-- Idempotent: upserts on `space_id`, which carries a UNIQUE index. A later real
-- fanout overwrites whatever is here.

BEGIN;

WITH anchor AS (
  SELECT 1788999322::bigint AS secs
),
seed(space_id, rank_key) AS (
  VALUES
    ('6b6f21e8-c2d7-5c37-8e43-9222ea146cf0', 'WzzorzzzzzzzzzzzzzzzzzzjP'),
    ('7b0c6964-796d-51de-a09b-fccc03984d39', 'WzzorzzzzzzzzzzzzzzzzzzsP'),
    ('d6edee9b-3566-5cc0-a9aa-dba00f021f8e', 'WzzorzzzzzzzzzzzzzzzzzzuX'),
    ('65c90530-460a-5eaf-bd1a-33b69c3ff063', 'Wzzorzzzzzzzzzzzzzzzzzzv1')
),
counts AS (
  SELECT
    sc.id AS sid,
    count(a.*) FILTER (WHERE a.space_action_type = 'poll')             AS poll_count,
    count(a.*) FILTER (WHERE a.space_action_type = 'topic_discussion') AS discussion_count,
    count(a.*) FILTER (WHERE a.space_action_type = 'quiz')             AS quiz_count,
    count(a.*) FILTER (WHERE a.space_action_type = 'follow')           AS follow_count
  FROM space_commons sc
  LEFT JOIN space_actions a ON a.space_id = sc.id::text
  WHERE sc.id::text IN (SELECT space_id FROM seed)
  GROUP BY sc.id
)
INSERT INTO hot_spaces (
  id, space_id, created_at, updated_at, rank_pk, rank_key,
  post_id, title, description, logo, author_display_name,
  participants, rewards,
  poll_count, discussion_count, quiz_count, follow_count, total_actions,
  heat, space_created_at
)
SELECT
  gen_random_uuid(),
  sc.id::text,
  (SELECT secs FROM anchor) * 1000,
  (SELECT secs FROM anchor) * 1000,
  'ALL',
  s.rank_key,
  -- A space and its backing post share an id (`space.id == post.id`).
  sc.id::text,
  coalesce(p.title, ''),
  -- Mirrors `extract_description`: drop <img>, then every tag, then bare URLs,
  -- then collapse whitespace.
  btrim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(coalesce(sc.content, ''), '<img[^>]*>', '', 'g'),
      '<[^>]+>', '', 'g'),
    'https?://[^\s]+', '', 'g'),
  '\s+', ' ', 'g')),
  coalesce(sc.logo, ''),
  coalesce(sc.author_display_name, ''),
  sc.participants,
  coalesce(sc.rewards, 0),
  c.poll_count, c.discussion_count, c.quiz_count, c.follow_count,
  c.poll_count + c.discussion_count + c.quiz_count + c.follow_count,
  -- `HotSpaceHeat::from_participants`: >=5000 blazing, >=500 trending, else rising.
  CASE
    WHEN sc.participants >= 5000 THEN 'blazing'::hot_space_heat
    WHEN sc.participants >= 500  THEN 'trending'::hot_space_heat
    ELSE 'rising'::hot_space_heat
  END,
  sc.created_at
FROM seed s
JOIN space_commons sc ON sc.id::text = s.space_id
JOIN counts c ON c.sid = sc.id
LEFT JOIN posts p ON p.id = sc.id
-- Re-assert eligibility at run time; skip a space that stopped qualifying.
WHERE sc.visibility = 'PUBLIC'
  AND sc.publish_state = 'PUBLISHED'
  AND sc.participants >= 10
ON CONFLICT (space_id) DO UPDATE SET
  updated_at          = EXCLUDED.updated_at,
  rank_pk             = EXCLUDED.rank_pk,
  rank_key            = EXCLUDED.rank_key,
  post_id             = EXCLUDED.post_id,
  title               = EXCLUDED.title,
  description         = EXCLUDED.description,
  logo                = EXCLUDED.logo,
  author_display_name = EXCLUDED.author_display_name,
  participants        = EXCLUDED.participants,
  rewards             = EXCLUDED.rewards,
  poll_count          = EXCLUDED.poll_count,
  discussion_count    = EXCLUDED.discussion_count,
  quiz_count          = EXCLUDED.quiz_count,
  follow_count        = EXCLUDED.follow_count,
  total_actions       = EXCLUDED.total_actions,
  heat                = EXCLUDED.heat,
  space_created_at    = EXCLUDED.space_created_at;

COMMIT;
