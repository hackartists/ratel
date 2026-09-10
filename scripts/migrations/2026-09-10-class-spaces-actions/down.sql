-- ============================================================================
-- Rollback: 수업 발표 평가 11개 스페이스 — poll 액션 제거 + 상태 복원 (DOWN)
-- ----------------------------------------------------------------------------
-- up.sql 이 만든 것만 되돌린다.
--
--   Part 1  상태를 스페이스별 원래 값으로 복원한다. 9개는 'Open'(started_at /
--           ended_at 모두 비어 있었음), 2개는 'Finished' 였고 그중 하나는
--           started_at / ended_at 을 갖고 있었다. up 이 Ongoing 으로 일괄
--           변경했으므로 여기서 개별 복원한다. `join_anytime` 은 11개 모두
--           원래 false 였으므로 일괄 false 로 되돌린다.
--
--   Part 2  up 이 만든 poll 액션을 지운다. 판별 기준은 up 이 남긴 지문이다:
--           type='poll' + status='finish' + 리워드/점수 전부 0 + depends_on='[]'
--           + created_at = updated_at (생성 이후 아무도 손대지 않음).
--
--           앞선 초안은 "응답이 달린 액션은 보존"으로 막았는데, 그것이 오히려
--           롤백을 막았다. 응답(space_poll_user_answers)은 액션이 아니라 poll 에
--           달리고 이 폴들은 수업 당시의 응답을 이미 갖고 있어서, 12개 중 11개가
--           보존 대상으로 잡혀 down 이 사실상 동작하지 않았다. 응답 행 자체는
--           이 스크립트가 건드리지 않으므로 액션을 지워도 유실되지 않는다.
--
-- 멱등: 여러 번 실행해도 안전.
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _targets(space_id text) ON COMMIT DROP;
INSERT INTO _targets VALUES
 ('cb190bc3-b6e3-5552-b059-ed7361b5e6dc'),
 ('92bb6ac6-d639-5982-85e6-7f5c1d2e33b8'),
 ('11316692-974c-52b3-98fe-cf886e5c9e92'),
 ('5cc0c5e4-29ee-5bb8-9efa-6ac50982e865'),
 ('4c3ea4c3-0b25-5fb5-8287-d731eec23536'),
 ('225f7be0-a083-5690-9816-a8c2c955ecb1'),
 ('f948ac56-8d18-5b7a-932f-ebff8e3ded16'),
 ('48452db0-79ff-591d-8ec1-0a75dcff24d5'),
 ('812115b3-f69a-5e0e-8ebb-c8dc82dabbe8'),
 ('426e85ad-a041-58bb-9926-fb6b43f2aff4'),
 ('b1040947-b894-5328-8e0d-f4493cde3beb');

-- Part 1a: 원래 Open 이던 9개
UPDATE space_commons
   SET status       = 'Open',
       join_anytime = false,   -- 11개 모두 원래 false 였다
       started_at   = NULL,
       ended_at     = NULL,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE id::text IN (SELECT space_id FROM _targets)
   AND id::text NOT IN ('4c3ea4c3-0b25-5fb5-8287-d731eec23536',
                        '92bb6ac6-d639-5982-85e6-7f5c1d2e33b8');

-- Part 1b: 원래 Finished 이던 2개 — 각자의 원래 타임스탬프로
UPDATE space_commons
   SET status       = 'Finished',
       join_anytime = false,
       started_at   = 1760932800000,
       ended_at     = 1761836400000,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE id::text = '4c3ea4c3-0b25-5fb5-8287-d731eec23536';

UPDATE space_commons
   SET status       = 'Finished',
       join_anytime = false,
       started_at   = NULL,
       ended_at     = NULL,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE id::text = '92bb6ac6-d639-5982-85e6-7f5c1d2e33b8';

-- Part 2: up 이 채운 투표 응답의 space_id 를 다시 비운다
--
-- 원래 상태가 빈 문자열이었으므로 그대로 되돌린다. 응답 행 자체는 지우지
-- 않는다 — up 도 링크만 채웠지 데이터를 만들지 않았다.
UPDATE space_poll_user_answers ans
   SET space_id = ''
  FROM space_polls pl
 WHERE pl.poll_id::text = ans.poll_id
   AND pl.space_id::text IN (SELECT space_id FROM _targets)
   AND ans.space_id = pl.space_id::text;

-- Part 3: up 이 복구한 참여자 행 제거 + 카운터/플래그 원복
--
-- up 이 응답자(actor_pk)로부터 만든 행만 지운다. 원래 있던 참여자(생성자,
-- 조교 등)와 이후 직접 참여한 사람은 건드리지 않도록, "응답자이면서 up 이
-- 만든 시각 패턴을 가진" 행으로 좁히는 대신 응답자 집합으로만 제한한다.
DELETE FROM space_participants sp
 WHERE sp.space_pk IN (SELECT 'SPACE#' || space_id FROM _targets)
   AND sp.kind = 'PARTICIPANT'
   AND EXISTS (
         SELECT 1
           FROM space_poll_user_answers ans
           JOIN space_polls pl ON pl.poll_id::text = ans.poll_id
          WHERE 'SPACE#' || pl.space_id::text = sp.space_pk
            AND ans.actor_pk = sp.user_pk)
   -- 스페이스 생성자는 남긴다.
   AND sp.user_pk <> (SELECT sc.user_pk FROM space_commons sc
                       WHERE 'SPACE#' || sc.id::text = sp.space_pk);

UPDATE space_commons sc
   SET participants = (
         SELECT count(*) FROM space_participants sp
          WHERE sp.space_pk = 'SPACE#' || sc.id::text
            AND sp.user_pk <> sc.user_pk),
       hot_eligible = true,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE sc.id::text IN (SELECT space_id FROM _targets);

-- Part 4: up 이 만든 닫힌 poll 액션 제거 (그 이후 수정된 것은 보존)
DELETE FROM space_actions a
 WHERE a.space_id IN (SELECT space_id FROM _targets)
   AND a.space_action_type = 'poll'
   AND a.status = 'finish'
   AND a.prerequisite = false
   AND a.credits = 0
   AND a.total_points = 0
   AND a.activity_score = 0
   AND a.additional_score = 0
   AND a.depends_on = '[]'::jsonb
   AND a.created_at = a.updated_at;

SELECT sc.status, sc.join_anytime, sc.hot_eligible, sc.participants,
       count(DISTINCT a.id)   AS actions_left,
       count(DISTINCT ans.id) AS linked_answers,
       left(coalesce(pp.title, sc.id::text), 26) AS title
  FROM space_commons sc
  LEFT JOIN posts pp ON pp.id = sc.id
  LEFT JOIN space_actions a ON a.space_id = sc.id::text
  LEFT JOIN space_poll_user_answers ans ON ans.space_id = sc.id::text
 WHERE sc.id::text IN (SELECT space_id FROM _targets)
 GROUP BY sc.status, sc.join_anytime, sc.hot_eligible, sc.participants, 7
 ORDER BY 7;

COMMIT;
