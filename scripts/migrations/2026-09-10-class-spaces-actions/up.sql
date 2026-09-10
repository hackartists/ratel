-- ============================================================================
-- Backfill: 수업 발표 평가 11개 스페이스 — poll 액션 복구 + 스페이스 시작 (UP)
-- ----------------------------------------------------------------------------
-- 공론조사 3개(2026-09-09-team-spaces-backfill)와 같은 유실이 이 11개에도
-- 있었다. DynamoDB→Postgres 마이그레이션에서 `space_polls` 는 넘어왔는데 그것을
-- 감싸는 `space_actions` 행이 사라져서, 스페이스에 표시할 액션이 0개다.
--   확인: 11개 스페이스 = space_actions 0개 / space_polls 12개
--
-- 네 가지를 한다.
--   Part 1  남아 있는 poll 마다 poll 액션을 만든다. 단 status='finish' —
--           이미 지난 수업의 평가라 응답을 다시 받으면 안 되므로 닫힌 상태로
--           생성한다(UI 의 "Close" 를 누른 것과 같은 상태). 리워드는 0/0.
--   Part 2  11개 전부 'Ongoing' + join_anytime 으로 바꾼다. 참여자에게 액션이
--           열리는 조건이 Ongoing 이기 때문이다(features/spaces/pages/actions/
--           access.rs 의 Participant 분기). 나중에 스페이스 확인용으로 쓰기
--           위해 이미 'Finished' 인 2개도 포함한다.
--           `started_at` 이 비어 있으면 지금 시각으로 채우고, 되살리는 것이므로
--           `ended_at` 은 비운다.
--   Part 3  투표 응답(space_poll_user_answers)의 끊어진 space_id 를 되살린다.
--           응답 91건이 남아 있는데 링크가 비어 앱에서 조회되지 않는다.
--   Part 4  응답자를 참여자로 되살리고(분석 리포트가 참여자 기준으로 집계한다)
--           `hot_eligible = false` 로 인기 스페이스에서 뺀다.
--
-- 응답을 다시 받지 못하게 하는 것은 스페이스 상태가 아니라 액션 상태다.
-- 액션이 'finish' 인 한 참여자는 열람만 가능하다.
--
-- 멱등: 이미 있는 액션은 건너뛰고, 상태 변경은 Ongoing 이 아닌 것만 대상.
-- 되돌리기: 같은 디렉터리의 down.sql (원래 상태 9 Open / 2 Finished 로 복원).
-- ============================================================================

\set ON_ERROR_STOP on
BEGIN;

-- 대상 11개 스페이스 (관리자 목록 5~15행)
CREATE TEMP TABLE _targets(space_id text) ON COMMIT DROP;
INSERT INTO _targets VALUES
 ('cb190bc3-b6e3-5552-b059-ed7361b5e6dc'),  -- 웹3.0 25.12.15 1조
 ('92bb6ac6-d639-5982-85e6-7f5c1d2e33b8'),  -- 웹3.0 25.12.1  2조  (원래 Finished)
 ('11316692-974c-52b3-98fe-cf886e5c9e92'),  -- 웹3.0 25.11.17 3조
 ('5cc0c5e4-29ee-5bb8-9efa-6ac50982e865'),  -- 웹3.0 25.10.20 3조
 ('4c3ea4c3-0b25-5fb5-8287-d731eec23536'),  -- 웹3.0 25.10.13 2조  (원래 Finished)
 ('225f7be0-a083-5690-9816-a8c2c955ecb1'),  -- 블록체인 25.12.15 1조
 ('f948ac56-8d18-5b7a-932f-ebff8e3ded16'),  -- 블록체인 25.12.15 2조
 ('48452db0-79ff-591d-8ec1-0a75dcff24d5'),  -- 블록체인 25.12.01 3조
 ('812115b3-f69a-5e0e-8ebb-c8dc82dabbe8'),  -- 블록체인 25.12.01 4조
 ('426e85ad-a041-58bb-9926-fb6b43f2aff4'),  -- 블록체인 25.11.24 5조
 ('b1040947-b894-5328-8e0d-f4493cde3beb');  -- 블록체인 25.11.17 6조

-- Part 1: poll 액션 생성 — 닫힌 상태('finish')로, 리워드 0/0
INSERT INTO space_actions
 (id, space_id, action_id, created_at, updated_at, title, description,
  space_action_type, prerequisite, credits, total_points,
  activity_score, additional_score, status, depends_on)
SELECT gen_random_uuid(), pl.space_id, pl.poll_id,
       (extract(epoch from now())*1000)::bigint,
       (extract(epoch from now())*1000)::bigint,
       coalesce(nullif(pl.title,''), '발표 평가'),
       coalesce(pl.description, ''),
       'poll', false, 0, 0, 0, 0,
       'finish',   -- 응답 못 받도록 닫아둔 상태
       '[]'
FROM space_polls pl
WHERE pl.space_id::text IN (SELECT space_id FROM _targets)
  AND NOT EXISTS (
        SELECT 1 FROM space_actions a
         WHERE a.space_id = pl.space_id::text
           AND a.action_id = pl.poll_id::text);

-- Part 2: 11개 전부 Ongoing + join_anytime 켜기
--
-- `join_anytime` 이 없으면 Ongoing 은 오히려 신규 참여를 막는다. 원래 Open
-- 이던 9개는 누구나 들어올 수 있었는데, 상태만 Ongoing 으로 바꾸면
--   list_actions.rs : Ongoing|Finished => join_anytime
--   access.rs       : Open || (join_anytime && Ongoing)
-- 두 곳이 false 로 걸러서 액션이 아예 조회되지 않는다. 확인용으로 쓰려면
-- 들어갈 수는 있어야 하므로 함께 켠다.
--
-- 응답 차단과는 무관하다 — 그것은 액션의 status='finish' 가 담당한다.
UPDATE space_commons
   SET status       = 'Ongoing',
       join_anytime = true,
       started_at   = coalesce(started_at, (extract(epoch from now())*1000)::bigint),
       ended_at     = NULL,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE id::text IN (SELECT space_id FROM _targets)
   AND (status IS DISTINCT FROM 'Ongoing' OR join_anytime IS DISTINCT FROM true);

-- Part 3: 투표 응답의 space_id 복구
--
-- 응답 자체는 살아 있는데 소속 스페이스 링크가 끊겼다. 이 11개 스페이스 기준
-- space_id 로 세면 0건인데 poll_id 로 조인하면 91건(폴 11개, 26명)이 나온다.
-- 테이블 전체로는 449건 중 253건의 space_id 가 빈 문자열이다.
--
-- 조회 경로가 space_id 를 쓰기 때문에 이대로면 앱에서 안 보인다:
--   space_poll_user_answer.rs 의 find_one / list_by_poll 둘 다
--   `.space_id(StringOp::Eq(..)).poll_id(StringOp::Eq(..))` 로 필터한다.
-- 결과 집계와 중복 응답 판정이 모두 영향을 받는다.
--
-- 공론조사 백필이 space_post_comments 에 대해 한 것과 같은 복구인데, 투표
-- 응답에는 적용되지 않았다. poll_id 로 소속 스페이스를 되찾는다.
UPDATE space_poll_user_answers ans
   SET space_id = pl.space_id::text
  FROM space_polls pl
 WHERE pl.poll_id::text = ans.poll_id
   AND pl.space_id::text IN (SELECT space_id FROM _targets)
   AND (ans.space_id IS NULL OR ans.space_id = '');

-- Part 4: 응답자를 참여자로 복구 + 인기 스페이스에서 제외
--
-- 분석 리포트는 필터가 없으면 "참여자 전원"을 대상으로 집계한다
--   auto_analysis.rs: matched_users = list_participant_user_pks(..)
--                     → if matched_users.contains(&row.actor_pk) { .. }
-- 그런데 이 스페이스들은 참여자 행도 유실돼서, 응답 11~12명 중 참여자로
-- 남은 사람이 0명이다. 그래서 리포트가 "No data yet" 을 띄운다.
-- 응답에 actor_pk 가 남아 있으므로 그것으로 참여자를 되살린다.
--
-- 참여자가 10명을 넘으면 인기 스페이스 자격(MIN_PARTICIPANTS_FOR_HOT)에
-- 걸리는데, 수업 발표 평가는 한 반이 통째로 들어와 숫자만 채울 뿐 외부에는
-- 의미가 없다. `hot_eligible = false` 로 명시적으로 빼둔다 — 제목이나 작성
-- 계정으로 거르는 대신 스페이스 자신이 의사를 갖게 한다.
INSERT INTO space_participants
 (id, space_pk, user_pk, kind, created_at,
  display_name, username, profile_url, user_type, last_activity_at)
SELECT gen_random_uuid(),
       'SPACE#' || pl.space_id::text,
       ans.actor_pk,
       'PARTICIPANT',
       min(ans.created_at),
       coalesce(max(u.display_name), ''),
       coalesce(max(u.username), ''),
       coalesce(max(u.profile_url), ''),
       coalesce(max(u.user_type), 0),
       max(ans.created_at)
  FROM space_poll_user_answers ans
  JOIN space_polls pl ON pl.poll_id::text = ans.poll_id
  LEFT JOIN users u ON 'USER#' || u.id::text = ans.actor_pk
 WHERE pl.space_id::text IN (SELECT space_id FROM _targets)
   AND NOT EXISTS (
         SELECT 1 FROM space_participants sp
          WHERE sp.space_pk = 'SPACE#' || pl.space_id::text
            AND sp.user_pk = ans.actor_pk
            AND sp.kind = 'PARTICIPANT')
 GROUP BY pl.space_id, ans.actor_pk;

-- 카운터를 실제 행 수와 맞춘다 (생성자 행은 카운터에 포함되지 않는다).
UPDATE space_commons sc
   SET participants = (
         SELECT count(*) FROM space_participants sp
          WHERE sp.space_pk = 'SPACE#' || sc.id::text
            AND sp.user_pk <> sc.user_pk),
       hot_eligible = false,
       updated_at   = (extract(epoch from now())*1000)::bigint
 WHERE sc.id::text IN (SELECT space_id FROM _targets);

-- 적용 결과 요약 (로그 확인용)
SELECT sc.status, sc.join_anytime, sc.hot_eligible, sc.participants,
       count(DISTINCT a.id)   AS poll_actions,
       count(DISTINCT ans.id) AS linked_answers,
       left(coalesce(pp.title, sc.id::text), 26) AS title
  FROM space_commons sc
  LEFT JOIN posts pp ON pp.id = sc.id
  LEFT JOIN space_actions a
         ON a.space_id = sc.id::text AND a.space_action_type = 'poll'
  LEFT JOIN space_poll_user_answers ans ON ans.space_id = sc.id::text
 WHERE sc.id::text IN (SELECT space_id FROM _targets)
 GROUP BY sc.status, sc.join_anytime, sc.hot_eligible, sc.participants, 7
 ORDER BY 7;

COMMIT;
