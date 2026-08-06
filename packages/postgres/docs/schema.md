# `Schema` — bootstrapping several tables at once

A single `repo.create_table()` handles one entity fine (it creates any enum
type the entity's columns depend on, then the table, then that entity's own
`many_to_many` join tables). But once entities reference each other via
foreign keys, or share a join table across two sides, creation **order**
starts to matter — `postgres::Schema` is a registration-based helper for
that: register entities in FK-dependency order, then create (or drop)
everything with one call.

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum Role {
    #[default]
    Member,
    Admin,
}

/// FK 의존 없음 — 등록 1순위.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_users")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub role: Role,
}

/// `author` 가 `s_users` 를 FK 참조 — `User` 보다 뒤에 등록해야 한다. `status` 도 같은
/// `Role` 을 쓰지만, enum dependency 는 문자열로 dedupe 되어 한 번만 생성된다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_posts")]
pub struct Post {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub author: User,
    pub title: String,
    pub status: Role,
}

/// m2m 은 단방향 선언만으로 충분(조인테이블 이름은 정렬된 base_name 결합이라 어느 쪽만
/// 선언해도 유도된다). 조인테이블은 `s_posts`/`s_users` 양쪽을 FK 로 참조하므로, 두
/// 본 테이블이 이미 만들어진 뒤에 만들어져야 한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_tags")]
pub struct Tag {
    pub id: Uuid,
    pub name: String,
    #[postgres(many_to_many)]
    pub posts: Vec<Post>,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;

    // 등록순 = FK 의존순: User(무의존) → Post(→ s_users) → Tag(조인테이블은 phase 3).
    let schema = Schema::new().register::<User>().register::<Post>().register::<Tag>();

    schema.drop(&pool).await.ok(); // 이전 실행 잔재 정리 — idempotent, 없어도 무해
    schema.create(&pool).await?; // enum → 테이블(등록순) → 조인테이블 순으로 부트스트랩
    schema.create(&pool).await?; // 재실행해도 에러 없음 (idempotent)
    schema.drop(&pool).await?; // 정확히 역순: 조인테이블 → 테이블(역순) → enum
    Ok(())
}
```

## Ordering and idempotency

`create()` runs, across every registered entity:

1. every entity's enum dependencies (`CREATE TYPE`), deduplicated — so `Role`
   above (shared by `User.role` and `Post.status`) is created exactly once
2. every entity's own table, in **registration order**
3. every entity's `many_to_many` join tables, deduplicated by table identity
   (not by the raw `CREATE` text — a join table declared on both sides emits
   different column order per side, so identity is keyed by the table name
   instead)

`drop()` runs the exact reverse: join tables → tables (reverse registration
order) → enum types. Every generated statement is `IF NOT EXISTS` / an
existence-checking `DO` block, so re-running `create()` (or `drop()`) is
always safe — the example above calls `create()` twice and `drop()` once at
the end specifically to demonstrate that.

## Why a lone `create_table()` isn't enough for `many_to_many`

`repo.create_table()` for a single entity still creates that entity's own
join-table DDL, but if the *other* side of the relation doesn't have a table
yet, the join table's `REFERENCES` target doesn't exist and creation fails.
`Schema` solves this by sequencing all base tables (phase 2) before any join
tables (phase 3), regardless of which entity declared the `many_to_many`
field — see [`relations`](relations.md) for the join-table naming rule
itself.

## 버전형 migration

각 서비스는 pool 초기화 뒤 `Schema::from_inventory().migrate(pool)`을 호출한다. 현재
바이너리에 링크된 inventory만 대상으로 누락된 scope별 필드·인덱스·enum 버전을 적용하고
checksum 원장을 기록한다. 원장이 이미 최신이면 조회 두 번으로 반환하며 DDL이나 advisory
lock을 실행하지 않는다. 변경이 있을 때만 모든 서비스가 공유하는 lock을 잡는다.

`Schema::validate_versions()`는 적용 없이 원장만 검사해야 하는 도구·테스트를 위한 API다.
필드 선언법과 지원 범위는 [`migrations`](migrations.md)를 참고한다.

## Related

- [`entity`](entity.md) — `POSTGRES_PREFIX` and identifier normalization (applies to every name `Schema` creates)
- [`relations`](relations.md) — the FK/join-table conventions `Schema` sequences around
- [`enum`](enum.md) — why enum types never need their own `Schema::register`
- [`migrations`](migrations.md) — scope별 버전과 startup migration
