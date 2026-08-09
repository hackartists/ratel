# `#[derive(PostgresJson)]`

`PostgresJson` 은 `serde::Serialize + DeserializeOwned + Clone` struct 를
JSONB 컬럼 타입으로 바꾼다. `PostgresEnum` 과 마찬가지로 `PostgresType` 에
직접 꽂히므로, 이 타입의 `PostgresEntity` 필드는 attribute 가 필요 없다 —
엔티티 derive 는 이를 스칼라 컬럼과 똑같이 취급한다:

```rust
use postgres::{ObjectKind, PostgresJson, PostgresObject, PostgresType, SqlType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, PostgresJson)]
pub struct Amount {
    pub currency: String,
    pub value: f64,
}

assert_eq!(Amount::kind(), ObjectKind::Json);
assert_eq!(<Amount as PostgresType>::sql_type(), SqlType::JsonB);

// JSON 은 스키마 오브젝트가 아니다 — CREATE/DROP 문이 없다 (컬럼의 타입일 뿐, DDL 대상 아님).
assert!(Amount::ddl().create.is_empty());
assert!(Amount::ddl().drop.is_empty());
assert!(<Amount as PostgresType>::dependency_ddl().is_none());
```

## JSONB 컬럼 사용 + `JsonOp::Contains`

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;
use serde::{Deserialize, Serialize};
use serde_json::json;

#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct Amount {
    pub currency: String,
    pub value: f64,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub budget: Amount, // JSONB 컬럼 — attribute 불필요
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let repo = User::repository();
    repo.create_table().await?;

    repo.insert(&User {
        id: Uuid::nil(),
        name: "hackartist".into(),
        budget: Amount { currency: "USD".into(), value: 1000.0 },
    })
    .await?;

    // JsonOp::Contains(`@>`) — 부분 문서 매칭. `.filter()` 가 받는 `UserCols` 의 `budget`
    // 컬럼에 `JsonCol::contains` 확장 트레이트가 적용된다.
    let usd_users = repo
        .find(User::query().filter(|u| u.budget.contains(json!({"currency": "USD"}))))
        .await?
        .items;
    assert_eq!(usd_users.len(), 1);
    Ok(())
}
```

## `JsonOp<T>` — v1 연산자 표면

| variant | 의미 |
|---|---|
| `Eq(T)` / `Ne(T)` | 문서 전체 equality/inequality |
| `Contains(serde_json::Value)` | `@>` — 이 컬럼의 문서가 주어진 부분 문서를 포함하는지 |
| `ContainedBy(serde_json::Value)` | `<@` — 이 컬럼의 문서가 주어진 문서에 포함되는지 |

다른 모든 연산자 enum과 마찬가지로, `JsonOp` 도 `And`/`Or` 및 `|`/`&` 문법
설탕(참고: [`query`](query.md))과 조합된다. JSON path 연산자(`->`, `->>`,
`#>>`)는 이후 작업으로 남겨져 있다.

## 제약

JSONB 컬럼 타입은 `T` 또는 `Option<T>` 만 가능하다 — 맨 `Vec<T>` 를 JSONB
배열 컬럼으로 감싸면 이 crate 의 관계 컨테이너 관례(`Vec<T: PostgresEntity>`
필드는 to-many 관계를 의미함, 참고: [`relations`](relations.md))와 충돌한다.
JSON 배열 컬럼을 저장하려면 newtype struct 로 감싸서(`struct
Tags(Vec<String>);`) 그 위에 `PostgresJson` 을 derive 한다.

`#[postgres(type = "JSONB")]` 는 `PostgresJson` 을 derive 할 수 없는 컬럼
타입(직접 소유하지 않는 외부 타입)을 위한 수동 escape hatch 로 여전히
사용 가능하다.

## 관련 문서

- [`entity`](entity.md) — 컬럼 타입이 `PostgresEntity` 에 꽂히는 방식
- [`query`](query.md) — `.filter()` 와 전체 연산자 표면
