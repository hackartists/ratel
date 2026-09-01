# `postgres`

워크스페이스를 위한 derive 우선(derive-first) PostgreSQL 레이어다. `#[derive(PostgresEntity)]` /
`PostgresEnum` / `PostgresJson` 는 **메타데이터만** 생성하며(컬럼, 관계, row 매핑), 실제
SQL 문은 전부 런타임에 `sqlx::QueryBuilder` 가 빌드한다 — 그래서 빌드 자체는 살아있는
데이터베이스에 전혀 의존하지 않는다. 제네릭 `PostgresRepository<T>` 가 그 메타데이터를
바탕으로 모든 엔티티의 CRUD·DDL·트랜잭션을 구동한다.

## 특징

- `#[derive(PostgresEntity)]` / `#[derive(PostgresEnum)]` / `#[derive(PostgresJson)]` — 테이블, 네이티브 PG enum 타입, JSONB struct 컬럼에 각각 대응하는 derive
- 관계는 평범한 필드(`T` / `Option<T>` / `Vec<T>`)로 선언하며, 4가지 cardinality(`one_to_one`, `many_to_one`, `one_to_many`, `many_to_many`) 모두 **관례 기반 기본값**을 가진다 — attribute 는 오버라이드할 때만 필요
- **전역 풀 일차 API** — 부팅 시 `postgres::set_global_pool(pool)` 를 한 번 심으면, 이후 인자 없이 `X::repository()` / `Tx::begin()` 을 쓴다. 명시적 풀 탈출구는 `PostgresRepository::new(pool)` / `Tx::begin_with(&pool)`
- `Tx::begin` + `repo.with_tx(&tx)` 핸들 기반 트랜잭션 — 별도의 `*_with_tx` 메서드 변형이 없고, commit/rollback 없이 `drop` 되면 rollback
- 컬럼별 타입 있는 연산자 enum(`StringOp`/`NumOp`/`BoolOp`/`UuidOp`/`EnumOp`/`JsonOp`), 그리고 컬럼을 넘나드는 `AND`/`OR` 을 위한 `.filter()` column-expression API
- `POSTGRES_PREFIX` — 런타임 테이블/타입명 네임스페이싱(예: 멀티테넌트 또는 브랜치별 스키마)
- v0 기준선 이후의 필드·일반 인덱스·native enum 라벨 추가를 생성하는 scope별 `version` migration

## 빠른 시작

```rust,no_run
use postgres::prelude::*;
use postgres::sqlx::postgres::PgPoolOptions;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid, // "id" 필드 → 자동 PK 인식
    pub name: String,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    // 부팅 시 전역 풀을 심고, 이 바이너리가 소유한 schema를 먼저 적용한다.
    postgres::set_global_pool(pool.clone());
    Schema::from_inventory().migrate(&pool).await?;
    let repo = User::repository();

    repo.insert(&User { id: Uuid::nil(), name: "hackartist".into() }).await?;
    let found = repo.find(User::query().name(StringOp::Eq("hackartist"))).await?;
    assert_eq!(found.items.len(), 1);
    assert_eq!(found.total_count, 1);
    Ok(())
}
```

## 문서

| 문서 | 내용 |
|---|---|
| [`getting-started`](docs/getting-started.md) | workspace 의존 추가, `make pg`, 첫 엔티티와 CRUD |
| [`entity`](docs/entity.md) | `PostgresEntity` derive — pk 규칙, table/column/type/unique/index/skip attrs, `POSTGRES_PREFIX` |
| [`enum`](docs/enum.md) | `PostgresEnum` — native `CREATE TYPE`/`text` 모드, rename, 라벨 이스케이핑 |
| [`json`](docs/json.md) | `PostgresJson` — JSONB 컬럼, `JsonOp` containment |
| [`query`](docs/query.md) | `User::query()`, 연산자 enum + `And`/`Or` combinator, `.filter()`, 다중 정렬·페이지네이션 |
| [`update`](docs/update.md) | `User::update()`, 부분 갱신, `Option` NULL 대입, FK 세터 |
| [`relations`](docs/relations.md) | 4 cardinality, 관례 기본값, eager/lazy 로딩, attach/detach |
| [`transactions`](docs/transactions.md) | `Tx::begin` / `with_tx` / `commit` / `rollback`, drop=rollback |
| [`schema`](docs/schema.md) | `Schema` 헬퍼, 생성 순서, 버전 적용·검증 API |
| [`migrations`](docs/migrations.md) | v0 기준선, `version`/`sql_default`, 인덱스·enum 변경, runner와 지원 범위 |
| [`extending`](docs/extending.md) | `PostgresType` 수동 구현, `SqlType`, 커스텀 타입 |

## 로컬 테스트

```bash
make pg     # postgres:16-alpine via docker-compose (5432, trust 인증) — 리포 루트에서
cargo test -p postgres
```

테스트는 `DATABASE_URL` 을 읽고, 미설정 시 `postgres://postgres@localhost:5432/postgres` 로
폴백한다(`make pg` 가 띄우는 인스턴스와 일치). 종료 시 `make stop-pg`.

이 문서(README)와 `docs/` 의 모든 코드 블록은 `cargo test --doc -p postgres` 로 컴파일
검증된다 — 문서와 실제 API 표면의 드리프트는 CI 가 상시 잡는다.
