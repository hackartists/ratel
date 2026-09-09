-- ============================================================================
-- Backfill: 공론조사 3개 스페이스 액션/댓글 링크 복구  (DOWN / 롤백)
-- ----------------------------------------------------------------------------
-- up.sql 이 만든 변경을 되돌린다:
--   Part 1/2: up 이 생성한 topic_discussion + poll 액션 삭제
--   Part 3  : up 이 채운 댓글 space_id 를 다시 빈 문자열('')로 되돌림
--
-- 삭제 대상 액션은 "대상 3개 스페이스 안에서 action_id 가 해당 스페이스의
-- space_posts.post_id 또는 space_polls.poll_id 에 해당하고, 리워드가 0/0 인 행"으로
-- 한정한다. 마이그레이션 이전 이 3개 스페이스에는 액션이 0개였으므로 이 조건에
-- 걸리는 행은 up.sql 이 만든 것뿐이다. (0/0 가드로 혹시 모를 정상 액션 보호)
--
-- 멱등(idempotent): 이미 되돌려졌으면 0건 처리. 여러 번 실행해도 안전.
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _targets(space_id text) ON COMMIT DROP;
INSERT INTO _targets VALUES
 ('65c90530-460a-5eaf-bd1a-33b69c3ff063'),  -- 공론조사 1차(남성방)
 ('d6edee9b-3566-5cc0-a9aa-dba00f021f8e'),  -- 공론조사 1차(여성방)
 ('7b0c6964-796d-51de-a09b-fccc03984d39');  -- 공론조사 2차(전원)

-- Part 1/2 되돌리기: up 이 생성한 topic_discussion 액션 삭제
DELETE FROM space_actions a
WHERE a.space_id IN (SELECT space_id FROM _targets)
  AND a.space_action_type = 'topic_discussion'
  AND a.credits = 0 AND a.total_points = 0
  AND EXISTS (
    SELECT 1 FROM space_posts sp
    WHERE sp.space_id = a.space_id AND sp.post_id = a.action_id
  );

-- Part 2 되돌리기: up 이 생성한 poll 액션 삭제
DELETE FROM space_actions a
WHERE a.space_id IN (SELECT space_id FROM _targets)
  AND a.space_action_type = 'poll'
  AND a.credits = 0 AND a.total_points = 0
  AND EXISTS (
    SELECT 1 FROM space_polls pl
    WHERE pl.space_id = a.space_id AND pl.poll_id = a.action_id
  );

-- Part 3 되돌리기: up 이 채운 댓글 space_id 를 빈 문자열로 복원
-- (마이그레이션 직후 이 댓글들의 space_id 는 비어 있었음 = 스페이스 미연결 상태)
UPDATE space_post_comments c
SET space_id = ''
FROM space_posts sp
WHERE c.post_id = sp.post_id
  AND sp.space_id IN (SELECT space_id FROM _targets)
  AND c.space_id = sp.space_id;

-- 롤백 결과 요약 (남은 액션 수 — 정상이면 0)
SELECT a.space_id, count(*) AS remaining_actions
FROM space_actions a
WHERE a.space_id IN (SELECT space_id FROM _targets)
GROUP BY a.space_id
ORDER BY a.space_id;

COMMIT;
