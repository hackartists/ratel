-- ============================================================================
-- Backfill: 공론조사 3개 스페이스 액션/댓글 링크 복구  (UP / 적용)
-- ----------------------------------------------------------------------------
-- 대상 3개 스페이스는 DynamoDB→Postgres 마이그레이션 과정에서
--   (1) poll / discussion 콘텐츠는 넘어왔으나 이를 감싸는 space_actions 행이 없고
--   (2) 댓글(space_post_comments)의 space_id 가 비어 있어 스페이스에서 조회되지 않음
-- 이 스크립트는 (1) topic_discussion + poll 액션을 생성하고 (2) 댓글 space_id 를 채운다.
-- 리워드는 전부 0/0 (credits=0, total_points=0).
--
-- 멱등(idempotent): 이미 있는 액션/채워진 댓글은 건너뛴다. 여러 번 실행해도 안전.
-- 되돌리기: 같은 디렉터리의 down.sql 참조.
-- 사전 검증(dev-victor fork): 남성방 기준 9 discussion + 3 poll 액션, 413 댓글 백필 확인.
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- 대상 3개 스페이스
CREATE TEMP TABLE _targets(space_id text) ON COMMIT DROP;
INSERT INTO _targets VALUES
 ('65c90530-460a-5eaf-bd1a-33b69c3ff063'),  -- 공론조사 1차(남성방)
 ('d6edee9b-3566-5cc0-a9aa-dba00f021f8e'),  -- 공론조사 1차(여성방)
 ('7b0c6964-796d-51de-a09b-fccc03984d39');  -- 공론조사 2차(전원)

-- Part 1: 토론(topic_discussion) 액션 — space_posts 토픽마다, 리워드 0/0
INSERT INTO space_actions
 (id, space_id, action_id, created_at, updated_at, title, description,
  space_action_type, prerequisite, credits, total_points, activity_score, additional_score, status, depends_on)
SELECT gen_random_uuid(), sp.space_id, sp.post_id,
       (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint,
       sp.title, coalesce(sp.html_contents,''),
       'topic_discussion', false, 0, 0, 0, 0, 'ongoing', '[]'
FROM space_posts sp
WHERE sp.space_id IN (SELECT space_id FROM _targets)
  AND NOT EXISTS (SELECT 1 FROM space_actions a WHERE a.space_id=sp.space_id AND a.action_id=sp.post_id);

-- Part 2: 투표(poll) 액션 — 스페이스당 poll, 리워드 0/0
INSERT INTO space_actions
 (id, space_id, action_id, created_at, updated_at, title, description,
  space_action_type, prerequisite, credits, total_points, activity_score, additional_score, status, depends_on)
SELECT gen_random_uuid(), pl.space_id, pl.poll_id,
       (extract(epoch from now())*1000)::bigint, (extract(epoch from now())*1000)::bigint,
       coalesce(nullif(pl.title,''),'설문조사'), coalesce(pl.description,''),
       'poll', false, 0, 0, 0, 0, 'ongoing', '[]'
FROM space_polls pl
WHERE pl.space_id IN (SELECT space_id FROM _targets)
  AND NOT EXISTS (SELECT 1 FROM space_actions a WHERE a.space_id=pl.space_id AND a.action_id=pl.poll_id);

-- Part 3: 댓글 space_id 백필 (post_id 로 소속 스페이스 연결)
UPDATE space_post_comments c
SET space_id = sp.space_id
FROM space_posts sp
WHERE c.post_id = sp.post_id
  AND sp.space_id IN (SELECT space_id FROM _targets)
  AND (c.space_id IS NULL OR c.space_id = '');

-- 적용 결과 요약 출력 (로그 확인용)
SELECT a.space_id,
       count(*) FILTER (WHERE a.space_action_type = 'topic_discussion') AS discussion_actions,
       count(*) FILTER (WHERE a.space_action_type = 'poll')             AS poll_actions
FROM space_actions a
WHERE a.space_id IN (SELECT space_id FROM _targets)
GROUP BY a.space_id
ORDER BY a.space_id;

COMMIT;
