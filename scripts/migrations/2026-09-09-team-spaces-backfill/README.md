# 공론조사 3개 스페이스 액션/댓글 링크 복구 (PROD 백필)

DynamoDB→Postgres 마이그레이션 때 아래 3개 스페이스는 **poll/discussion 콘텐츠와
댓글은 넘어왔지만**, 이를 감싸는 `space_actions` 행이 없고 댓글의 `space_id` 가
비어 있어 앱에서 조회되지 않는다. 이 마이그레이션이 그 링크를 복구한다.

| 스페이스 | space_id |
|---|---|
| 공론조사 1차(남성방) | `65c90530-460a-5eaf-bd1a-33b69c3ff063` |
| 공론조사 1차(여성방) | `d6edee9b-3566-5cc0-a9aa-dba00f021f8e` |
| 공론조사 2차(전원) | `7b0c6964-796d-51de-a09b-fccc03984d39` |

## 무엇을 하나

- **up.sql**
  - `space_posts` 토픽마다 `topic_discussion` 액션 생성 (스페이스당 3개)
  - poll 마다 `poll` 액션 생성 (스페이스당 1개)
  - 리워드는 전부 **0/0** (`credits=0`, `total_points=0`)
  - `space_post_comments.space_id` 를 `post_id` 기준으로 백필 (총 413건)
- **down.sql** — up 이 만든 액션 삭제 + 채운 댓글 `space_id` 를 다시 빈 값으로 복원

두 스크립트 모두 트랜잭션(BEGIN/COMMIT) + **멱등**이라 재실행/롤백 모두 안전.

## 실행 방법 (GitHub 버튼)

GitHub → **Actions** → **"PROD backfill · 공론조사 스페이스"** → **Run workflow**

- `direction`: `up`(적용) 또는 `down`(롤백)
- `confirm`: 정확히 `MIGRATE` 입력 (오실행 방지)

워크플로우: [`.github/workflows/prod-backfill-team-spaces.yml`](../../../.github/workflows/prod-backfill-team-spaces.yml)
self-hosted(in-cluster) 러너가 `ratel-prod` 에 일회용 `postgres:16-alpine` 파드를
띄워 클러스터 내부 Postgres(`postgres.infra.svc.cluster.local`)로 SQL 을 흘려보낸다.
버튼이 보이려면 이 파일이 prod 트리거 브랜치(`main`)에 있어야 한다.

## 검증

dev-victor `pgfork`(prod DB 포크) 파드에서 **up → down → up(재적용) → up(멱등)**
왕복 테스트 완료:
- up: 스페이스당 discussion 3 + poll 1 = 12 액션, 댓글 413건 링크
- down: 12 액션 삭제, 413건 복원, 잔여 0
- 재적용/재적용: 중복 없음(INSERT 0)
