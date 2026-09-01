# `#[derive(PostgresEntity)]`

`PostgresEntity` 는 named-field struct 를 테이블로 바꾼다: 컬럼 메타데이터
(`columns()`), row 디코딩(`from_pg_row`), `insert_values()` 매핑, 그리고
`{Name}Query`/`{Name}Update` 빌더 타입(참고: [`query`](query.md),
[`update`](update.md))을 생성한다. 컬럼의 SQL 타입은 매크로에 하드코딩되지
않는다 — 각 필드 타입의 `PostgresType` 구현에서 온다(참고: [`extending`](extending.md)).
그래서 새 스칼라 컬럼 타입을 추가할 때 `postgres-macros` 를 건드릴 필요가 없다.

## PK 규칙

매크로는 필드를 추가할 수 없으므로, primary key 는 struct 안에 명시적으로
선언되어야 한다. `id` 라는 이름의 필드는 자동으로 인식되어 별도 attribute 가
필요 없다:

```rust
use postgres::prelude::*;
use postgres::uuid::Uuid;

// "id" 필드가 있으면 `#[postgres(pk)]` 없이 자동으로 PK 로 인식된다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "d_users")]
pub struct DUser {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
}
```

`id` 필드도 없고 다른 필드에 명시적 `#[postgres(pk)]` attribute 도 없으면,
derive 는 컴파일 타임에 다음 에러로 실패한다:

> PostgresEntity requires a primary key: add #[postgres(pk)] or an `id` field

`Pk = Uuid` 인 경우(흔한 케이스), 엔티티를 `Uuid::nil()` 로 생성해서 넘기면
`insert()` 가 자동으로 `Uuid::now_v7()` 를 채번한다 — 이 크레이트의 모든
예제가 insert 시점에 `id: Uuid::nil()` 로 쓸 수 있는 이유다.

## Struct 레벨 attribute

| attribute | 의미 | 기본값 |
|---|---|---|
| `#[postgres(table = "...")]` | prefix 적용 전의 테이블명 (override 는 복수화하지 않음) | struct 이름의 snake_case 에서 **마지막 세그먼트만 복수화** (`EmailVerification`→`email_verifications`) |
| `#[postgres(crate = "...")]` | 생성된 코드가 사용하는 런타임 crate 경로 | `::postgres` |
| `#[postgres(unique(a, b, …))]` | **복합 UNIQUE** — 나열한 필드들에 `CREATE UNIQUE INDEX` 를 건다 (자연키). 여러 번 붙여 복합 UNIQUE 를 여럿 만들 수 있다 | (없음) |
| `#[postgres(skip_schema)]` | repository/row 매핑만 생성하고 현재 바이너리의 `Schema` inventory에는 등록하지 않음. 다른 서비스 소유 테이블의 read-only mirror 전용 | inventory 등록 |

### 복합 UNIQUE — `#[postgres(unique(a, b, …))]`

컬럼 단위 `#[postgres(unique)]` 이 한 컬럼에 `UNIQUE` 를 걸듯, struct 레벨
`#[postgres(unique(a, b))]` 는 여러 컬럼에 걸친 **복합 유일 제약**을
`CREATE UNIQUE INDEX IF NOT EXISTS "{table}_{cols}_key" ON "{table}" ("a","b")`
로 방출한다 — `(workspace_id, application_number)` 같은 **자연키**를 DB 레벨로
강제하는 데 쓴다. 나열하는 이름은 **필드 이름**이어야 하며(실존하지 않으면 컴파일
에러), 각 필드의 컬럼명으로 해소된다. 컬럼 순서는 선언 순서를 따르고, 여러
`unique(...)` 을 붙여 복합 UNIQUE 를 여럿 만들 수 있다.

```rust
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "patent_records", unique(workspace_id, application_number))]
pub struct PatentRecord {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub application_number: String,
    pub title: String,
}
```

이 제약을 **원자적으로** 활용하려면
`PostgresRepository::upsert_on(&["workspace_id", "application_number"], &row)` 로
자연키 upsert 한다 — `INSERT … ON CONFLICT (workspace_id, application_number) DO
UPDATE` 로, 같은 키면 기존 행을 in-place 갱신(pk 보존)하고 새 키면 insert 한다.
PK 로 충돌하는 `upsert()` 와 대비된다. (컬럼별 인덱스처럼 별도 `DROP INDEX` 는
내지 않는다 — `DROP TABLE … CASCADE` 가 인덱스도 함께 제거한다.)

## 필드 레벨 attribute

| attribute | 의미 |
|---|---|
| `#[postgres(pk)]` | 이 필드를 primary key 로 지정 |
| `#[postgres(column = "...")]` | 컬럼명 오버라이드 (기본값: 필드명의 snake_case) |
| `#[postgres(type = "...")]` | SQL 타입 오버라이드 (예: `type = "TEXT"`) — 타입이 `PostgresType` 을 구현하지 않은 필드를 위한 escape hatch. 참고: [`extending`](extending.md), 그리고 [`relations`](relations.md) 의 custom `reference_key` 케이스 |
| `#[postgres(unique)]` | `UNIQUE` 제약 추가 |
| `#[postgres(index)]` | 이 컬럼에 `CREATE INDEX` 생성 |
| `#[postgres(version = 1)]` | v0 기준선 이후 해당 버전에서 기존 테이블에 컬럼 추가 |
| `#[postgres(sql_default = "...")]` | 버전형 컬럼의 명시적 DB default SQL |
| `#[postgres(index(version = 2))]` | 기존 컬럼에 지정 버전부터 일반 인덱스 추가 |
| `#[postgres(skip)]` | 컬럼이 아님 — 읽을 때 `Default` 로 채워지는 일시적(transient) 필드 |
| 관계 attribute | `one_to_one` / `many_to_one` / `one_to_many` / `many_to_many` — 참고: [`relations`](relations.md) |

버전은 테이블별로 1부터 연속이어야 하며 struct에는 별도 버전을 쓰지 않는다. `String`,
숫자, `bool` non-null 필드는 안전한 DB default가 자동 생성되고 `Option<T>`는 nullable로
추가된다. unique/FK 등 자동화하지 않는 변경과 runner 사용법은
[`migrations`](migrations.md)를 참고한다.

`#[postgres(unique)]` 의 실전 예 — 다른 엔티티의 관계가 참조할 수 있는
`UNIQUE` 컬럼(참고: [`relations`](relations.md) 의 `owner_email` 케이스):

```rust
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r1_users")]
pub struct RUser {
    pub id: Uuid,
    #[postgres(unique)]
    pub email: String,
    pub name: String,
}
```

## `POSTGRES_PREFIX` — 식별자 정규화

모든 테이블, enum 타입, 조인테이블, 인덱스의 최종 SQL 식별자는
`{POSTGRES_PREFIX}_{base_name}` 이며, snake_case 로 정규화된다(소문자화,
`[^a-z0-9_]` → `_`). `POSTGRES_PREFIX` 는 (서버의 `DYNAMO_TABLE_PREFIX` 와
달리) 컴파일 타임이 아니라 런타임에 한 번 읽히므로, 이 crate 는 빌드 환경에
전혀 커플링되지 않는다. prefix 를 설정하지 않으면 prefix 없이 그대로 사용된다:

```rust
use postgres::ident::{normalize_ident, qualified_with};

assert_eq!(normalize_ident("Asset-Prod-User"), "asset_prod_user");
assert_eq!(qualified_with(Some("asset-prod"), "user"), "asset_prod_user");
assert_eq!(qualified_with(None, "user"), "user");
```

## 관련 문서

- [`query`](query.md) / [`update`](update.md) — 생성되는 query/update 빌더
- [`enum`](enum.md) / [`json`](json.md) — `PostgresEntity` 컬럼에 꽂히는 두 가지 derive
- [`relations`](relations.md) — 외래키와 조인테이블을 struct 필드로 선언하기
- [`schema`](schema.md) — 여러 엔티티의 테이블을 한 번에 부트스트랩하기
- [`migrations`](migrations.md) — 기존 테이블에 새 필드·인덱스를 버전별로 추가하기
