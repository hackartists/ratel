# 버전형 스키마 변경

`PostgresEntity`와 native `PostgresEnum`은 현재 DB 상태를 **v0 기준선**으로 보고,
그 뒤의 안전한 추가형 변경을 숫자 버전으로 생성한다. 버전은 DB 전체가 아니라
각 테이블과 enum scope별로 관리한다. struct에 별도 최신 버전을 적지 않으며,
필드·인덱스·enum 라벨에 선언된 가장 큰 숫자가 그 scope의 최신 버전이다.

## 필드 추가

```rust
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "documents")]
pub struct Document {
    // version이 없는 기존 필드는 v0 기준선이다.
    pub id: Uuid,
    pub title: String,

    // String은 DEFAULT ''가 자동 생성된다.
    #[postgres(version = 1)]
    pub memo: String,

    // 도메인 기본값을 명시할 수도 있다.
    #[postgres(version = 1, sql_default = "'pending'")]
    pub status: String,

    // Option<T>는 nullable 컬럼이며 기본값이 필요 없다.
    #[postgres(version = 2)]
    pub external_ref: Option<String>,
}
```

기존 테이블에는 다음 순서로 적용된다.

```sql
-- table:documents / version 1
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "memo" TEXT NOT NULL DEFAULT '';
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'pending';

-- table:documents / version 2
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "external_ref" TEXT;
```

자동 DB 기본값은 `String = ''`, 정수·실수 `= 0`, `bool = FALSE`다. UUID,
시간, enum, JSON과 도메인 타입의 non-null 필드는 의미를 추측하지 않으므로
`sql_default`가 필요하다. 생성된 default는 이전 서버의 INSERT도 수용하기 위해
유지된다.

새 nullable scalar FK 컬럼도 함께 추가할 수 있다.

```rust
#[postgres(version = 1, references = "users(id)")]
pub owner_id: Option<Uuid>,
```

기존 행은 `NULL`이므로 제약을 만족한다. 관계 객체 필드 자체나 기존 컬럼에 FK를
사후 추가·변경하는 것은 지원하지 않는다.

버전은 1부터 연속이어야 한다. 이미 배포된 버전의 선언을 수정하면 원장의 checksum과
달라져 migration과 서버 시작이 실패한다. 새 변경은 다음 번호로 추가한다.

## 인덱스 추가

```rust
// 새 컬럼과 인덱스를 같은 버전에 추가한다.
#[postgres(version = 1, index)]
pub source_id: Option<String>,

// v0부터 있던 컬럼에 v2에서 일반 인덱스만 추가한다.
#[postgres(index(version = 2))]
pub workspace_id: Uuid,

// 컬럼은 v1, 인덱스는 v2에 추가할 수도 있다.
#[postgres(version = 1, index(version = 2))]
pub reference: Option<String>,
```

인덱스 DDL은 항상 컬럼 추가 뒤에 실행된다. `unique`는 기존 데이터의 중복과
구버전 `ON CONFLICT` 의미를 모델만 보고 판단할 수 없어서 버전형 필드에 허용하지
않는다. v0의 기존 unique 선언은 최신 기준선의 일부로 그대로 유지된다.

## native enum 라벨 추가

```rust
#[derive(Debug, Default, Clone, Copy, PartialEq, PostgresEnum)]
pub enum Status {
    #[default]
    Pending, // v0
    #[postgres(version = 1)]
    Ready,
}
```

기존 타입에는 `ALTER TYPE "status" ADD VALUE IF NOT EXISTS 'ready'`가 적용된다.
TEXT enum에는 DB 타입이 없으므로 `version`을 사용할 수 없다. enum 라벨 삭제,
이름 변경, 순서 변경은 자동화 범위가 아니다. variant는 v0부터 버전 오름차순으로
선언해야 fresh DB와 upgrade DB의 enum 정렬 순서가 같다.

## 실행과 원장

runner는 `postgres_schema_versions(scope, version, checksum, applied_at)`에 각
테이블과 enum의 v0 및 후속 버전을 기록한다.

```rust
let pool = postgres::sqlx::postgres::PgPoolOptions::new()
    .connect(&database_url)
    .await?;
postgres::set_global_pool(pool.clone());
postgres::Schema::from_inventory().migrate(&pool).await?;
```

Postgres 엔티티를 소유한 각 프로세스가 pool 초기화 뒤, 요청이나 worker 처리를 시작하기
전에 호출한다. inventory는 바이너리별이므로 app-server와 각 `server-app`은 자기 모델만
적용한다. 모든 프로세스가 같은 advisory lock과 원장을 공유해 동시에 시작해도 한 번만
적용된다.

원장이 최신이면 조회 두 번으로 즉시 반환하고 DDL과 lock을 실행하지 않는다. 누락된 버전이
있을 때만 lock을 잡고 적용하며, 실패한 프로세스는 시작하지 않는다. 별도 migration binary,
Make target, ECS migration container는 두지 않는다.

원장이 없는 기존 DB는 **현재 모델과 이미 일치하는 v0**라는 전제로 등록한다. 과거
스냅샷을 업그레이드하거나 catalog 차이를 자동 복구하지 않는다. 빈 DB는 최신 전체
DDL을 먼저 생성한 뒤 모든 버전을 기록한다.

## 지원하지 않는 변경

- 컬럼 rename·delete·타입 변경
- 기존 컬럼의 nullability/default 변경과 데이터 backfill
- unique 추가·삭제·교체
- 기존 컬럼의 FK 추가와 FK 삭제·동작 변경
- enum 라벨 rename·delete
- 조인테이블 구조 변경

이 변경들은 데이터 의미와 배포 호환성 검토가 필요하다. 현재 구현에는 이를 위한 명시적
migration 체계를 포함하지 않으므로 자동 실행하지 않는다. 버전형 필드를 처음 운영에
사용하기 전에 명시적 컬럼 조회를 포함한 현재 v0 릴리스가 먼저 배포돼 있어야 한다.
