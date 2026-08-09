# `#[derive(PostgresEnum)]`

`PostgresEnum` 은 unit-only Rust enum 을 쿼리 가능한 컬럼 타입으로 바꾼다.
기본적으로 네이티브 `CREATE TYPE ... AS ENUM (...)` 으로 저장하며, 컬럼으로
사용하는 crate 는 그 타입에 대해 더 이상 신경 쓸 필요가 없다 — 소유 테이블의
`create_table()`(또는 [`Schema`](schema.md))이 컬럼 의존성으로서 PG 타입을
먼저 자동으로 만들어 준다.

```rust
use postgres::{ObjectKind, PostgresEnum, PostgresEnumMeta, PostgresObject, PostgresType, SqlType, Value};

#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
pub enum Role {
    Owner,
    Admin,
    #[postgres(rename = "member_x")]
    Member,
}

assert_eq!(Role::kind(), ObjectKind::Enum);
assert_eq!(Role::base_name(), "role");
assert_eq!(<Role as PostgresType>::sql_type(), SqlType::Enum(Role::pg_type_name()));
assert!(<Role as PostgresType>::dependency_ddl().is_some()); // → CREATE TYPE, run before any table referencing it

// 라벨은 variant명 snake_case 가 기본값, `#[postgres(rename = "...")]` 로 오버라이드.
// (pg_label 은 `Cow<'static, str>` — unit 은 무할당 Borrowed, catch-all 은 Owned.)
assert_eq!(Role::Member.pg_label().as_ref(), "member_x");
assert_eq!(Value::from(Role::Admin), Value::Enum("admin".into(), Role::pg_type_name()));

let create = &Role::ddl().create[0];
assert!(create.contains("'owner', 'admin', 'member_x'"));
assert!(create.contains("CREATE TYPE"));
```

네이티브(기본) 모드는 unit variant 만 지원된다 — 데이터를 담는 variant(`Member(i32)`)는
컴파일 에러다(`CREATE TYPE … AS ENUM` 은 고정 라벨 집합이라 임의 값을 담을 수 없다).
단 **TEXT 모드**(`#[postgres(text)]`)에 한해 **단일 catch-all 뉴타입 변형**을 허용한다 — 아래
[open enum](#open-enum--단일-catch-all-변형) 참고.

## 기존 native enum에 라벨 추가

버전이 없는 라벨은 v0 기준선이고 새 라벨에는 scope별 연속 버전을 붙인다.

```rust
use postgres::PostgresEnum;

#[derive(Debug, Default, Clone, Copy, PartialEq, PostgresEnum)]
pub enum Status {
    #[default]
    Pending,
    #[postgres(version = 1)]
    Ready,
}
```

migration runner는 기존 타입에 `ALTER TYPE ... ADD VALUE IF NOT EXISTS`를 실행한다.
TEXT 모드에는 `version`을 사용할 수 없다. 자세한 실행 계약은
[`migrations`](migrations.md)를 참고한다.

## `#[postgres(text)]` — TEXT 저장 opt-out

네이티브 PG 타입 대신 `TEXT` 로 저장하면 스키마 오브젝트 생성 자체를 완전히
건너뛴다(실행하거나 drop 할 `CREATE TYPE` 이 없다):

```rust
use postgres::{PostgresEnum, PostgresObject, PostgresType, SqlType, Value};

#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
#[postgres(text)]
pub enum Color {
    Red,
    Green,
    #[postgres(rename = "deep_blue")]
    Blue,
}

assert_eq!(<Color as PostgresType>::sql_type(), SqlType::Text);
assert!(Color::ddl().create.is_empty()); // text 모드는 스키마 오브젝트를 만들지 않는다
assert_eq!(Value::from(Color::Blue), Value::Text("deep_blue".into()));
```

## open enum — 단일 catch-all 변형

TEXT 모드에서는 **단일 catch-all 뉴타입 변형**(예: `Unknown(String)`)을 하나 둘 수 있다.
알려진 라벨이 아니면 원문 문자열을 그대로 담아 흡수하므로, 이 빌드가 모르는 값을 받아도
거부하지 않고 보존한다(open enum). native 모드에는 쓸 수 없다(`CREATE TYPE` 이 고정
라벨이라).

이 매크로는 **DB 컬럼 코덱만** 만든다 — `Display`/`FromStr`/serde 는 생성하지 않으니, 필요하면
`strum`(Display/FromStr) + `serde_with`(SerializeDisplay/DeserializeFromStr) 로 따로 붙인다.

```rust
use postgres::{PostgresEnum, PostgresEnumMeta, PostgresType, SqlType, Value};

#[derive(Debug, Clone, PartialEq, PostgresEnum)]
#[postgres(text)]
pub enum MetricKind {
    CompletenessScore,
    FileCount,
    Unknown(String), // catch-all — 알려지지 않은 라벨을 원문 그대로 흡수
}

// 알려진 변형 → snake_case 라벨.
assert_eq!(MetricKind::FileCount.pg_label().as_ref(), "file_count");
// catch-all → 담긴 원문이 곧 라벨(= 저장/바인딩되는 TEXT 값).
assert_eq!(
    MetricKind::Unknown("brand_new".into()).pg_label().as_ref(),
    "brand_new"
);
assert_eq!(
    Value::from(MetricKind::Unknown("brand_new".into())),
    Value::Text("brand_new".into())
);
assert_eq!(<MetricKind as PostgresType>::sql_type(), SqlType::Text);
```

- catch-all 은 **최대 하나**, **단일 `String` 필드**여야 한다.
- Decode 시 알려진 라벨이 아니면 catch-all 로, catch-all 이 없으면 `unknown … label` 에러다.

## 라벨 이스케이핑

Rename 라벨은 `CREATE TYPE` 문에 렌더링될 때 이스케이프되므로, 라벨에
작은따옴표가 포함되어도 안전하다:

```rust
use postgres::{PostgresEnum, PostgresObject};

#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
pub enum Quote {
    #[postgres(rename = "o'brien")]
    OBrien,
    Plain,
}

let create = &Quote::ddl().create[0];
assert!(create.contains("'o''brien'")); // single quote doubled per PG string-literal escaping
```

## enum 컬럼 사용하기

`PostgresEntity` 의 enum 필드는 attribute 가 필요 없다 — 엔티티 derive 가
다른 컬럼과 마찬가지로 `PostgresType` 에서 `sql_type()`/`dependency_ddl()`
을 그대로 가져오고, enum 의 연산자(`EnumOp<E>`)는 `{Entity}::query()` 에서
바로 쓸 수 있다:

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum Role {
    #[default]
    Owner,
    Admin,
    Member,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_users")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub role: Role,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let repo = User::repository();

    repo.create_table().await?; // Role 의 CREATE TYPE 을 테이블보다 먼저 실행

    repo.insert(&User { id: Uuid::nil(), name: "hackartist".into(), role: Role::Owner })
        .await?;

    // enum 컬럼 직접 연산자 진입점.
    let owners = repo.find(User::query().role(EnumOp::Eq(Role::Owner))).await?.items;
    assert_eq!(owners.len(), 1);
    Ok(())
}
```

## 관련 문서

- [`entity`](entity.md) — 컬럼 타입이 `PostgresEntity` 에 꽂히는 방식
- [`query`](query.md) — `EnumOp` 연산자 표면 전체
- [`schema`](schema.md) — enum 타입이 별도 등록을 필요로 하지 않는 이유
- [`migrations`](migrations.md) — native enum 라벨의 버전형 추가
