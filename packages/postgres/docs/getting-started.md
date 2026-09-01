# 시작하기 (Getting started)

`postgres` 는 워크스페이스 내부 crate 다(crates.io 에 배포하지 않는 path dependency).
path dependency 로 추가하고, 첫 엔티티를 derive 해 본다.

## 의존성 추가

이 워크스페이스의 다른 crate 에서(예: `server/Cargo.toml`), `packages/postgres` 를
가리키는 path dependency 를 추가한다:

```toml
[dependencies]
postgres = { path = "../packages/postgres" }
```

## PostgreSQL 시작

```bash
make pg          # postgres:16-alpine via docker-compose (packages/postgres/docker-compose.yml), :5432, trust 인증
make stop-pg      # 종료
```

연결 코드(및 `cargo test -p postgres`)는 `DATABASE_URL` 을 읽고, 미설정 시
`postgres://postgres@localhost:5432/postgres` 로 폴백한다 — 정확히 `make pg` 가
띄우는 인스턴스이므로, 로컬 작업에 별도 설정이 필요 없다.

## 첫 엔티티 + CRUD

`#[derive(PostgresEntity)]` 는 primary key 필드가 필요한데, `id` 라는 이름의
필드는 자동으로 인식되어 별도 attribute 가 필요 없다:

```rust,no_run
use postgres::prelude::*;
use postgres::sqlx::postgres::PgPoolOptions;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres@localhost:5432/postgres".into());
    let pool = PgPoolOptions::new().max_connections(4).connect(&url).await?;

    // 프로세스 전역 풀을 한 번 심는다(일차 API) — 이후 `X::repository()` / `Tx::begin()`
    // 은 인자 없이 이 풀을 쓴다. 명시적 풀이 필요하면 `PostgresRepository::new(pool)`.
    postgres::set_global_pool(pool.clone());
    Schema::from_inventory().migrate(&pool).await?;
    let repo = User::repository();

    // insert — nil PK 는 v7 로 채번된다.
    let saved = repo
        .insert(&User {
            id: Uuid::nil(),
            name: "hackartist".into(),
            age: 33,
            agreed: true,
        })
        .await?;
    assert!(!saved.id.is_nil());

    // get — PK 단건 조회.
    let got = repo.get(saved.id).await?.unwrap();
    assert_eq!(got.name, "hackartist");

    // find — 컬럼별 연산자 + 결과 정렬. `find` 는 `Page<T>` 를 반환하며, 조회된 행은
    // `.items`, 전체 개수는 `.total_count` 로 얻는다 (자세한 페이지네이션은 query.md 참조).
    let page = repo
        .find(
            User::query()
                .name(StringOp::StartsWith("hack"))
                .order_by(UserColumn::Age, Order::Desc),
        )
        .await?;
    assert_eq!(page.items.len(), 1);
    assert_eq!(page.total_count, 1);

    // update — 부분 갱신, RETURNING *.
    let updated = repo
        .update(saved.id, User::update().name("hackartist-renamed").age(34))
        .await?;
    assert_eq!(updated.name, "hackartist-renamed");

    // delete.
    repo.delete(saved.id).await?;

    repo.drop_table().await?;
    Ok(())
}
```

이 코드는 [`examples/basic.rs`](../examples/basic.rs) 와 같은 구조다(`cargo run -p
postgres --example basic` 로 실행 가능). 그 예제는 여기서 시작한 walkthrough 를
enum, JSONB, 관계, 트랜잭션까지 확장한다.

## 다음으로

- [`entity`](entity.md) — `PostgresEntity` derive 의 전체 표면(attribute, PK 규칙, `POSTGRES_PREFIX`)
- [`query`](query.md) / [`update`](update.md) — 위에서 사용한, 생성되는 query/update 빌더
- [`relations`](relations.md) — 외래키와 조인테이블을 평범한 struct 필드로 모델링하기
- [`schema`](schema.md) — 서로 연관된 여러 테이블을 `Schema` 로 한 번에 부트스트랩하기
