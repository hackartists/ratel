# Extending — custom column types and query operators

`postgres-macros` never hardcodes a Rust-type-to-SQL-type mapping. Every
column's SQL type, nullability, and dependency DDL come from the field
type's own `PostgresType` implementation, and the derive macro just calls
into it (`<T as PostgresType>::sql_type()`, and so on) — the same path used
internally by `#[derive(PostgresEntity)]` itself:

```rust
use postgres::{ColumnDef, PostgresType, SqlType};
use postgres::uuid::Uuid;

// 실제로 `#[derive(PostgresEntity)]` 가 내부적으로 만드는 것과 동일한 모양 — 컬럼의
// SQL 타입은 매크로가 하드코딩하지 않고, 필드 타입의 `PostgresType::sql_type` 함수
// 포인터를 그대로 담는다(`tests/manual_entity.rs` 의 손으로 쓴 참조 구현에서 발췌).
static ID_COLUMN: ColumnDef = ColumnDef {
    name: "id",
    sql_type: <Uuid as PostgresType>::sql_type,
    nullable: false,
    unique: false,
    index: false,
    version: 0,
    index_version: 0,
    default_sql: || None,
    primary_key: true,
};

assert_eq!((ID_COLUMN.sql_type)(), SqlType::Uuid);
```

## Implementing `PostgresType` for a new scalar

```rust
pub trait PostgresTypeSketch {
    type Op;
    fn sql_type() -> postgres::SqlType;
    fn nullable() -> bool { false }
    fn migration_default_sql() -> Option<&'static str> { None }
    fn dependency_ddl() -> Option<postgres::Ddl> { None }
}
```

The real trait (`postgres::PostgresType`) has this exact shape. Giving a new
Rust type column status means implementing it — here is the same shape the
crate's own built-in `f64` implementation uses (`src/entity.rs`), applied to
a new type:

```rust
use postgres::ops::NumOp;
use postgres::{PostgresType, SqlType};

/// 새 스칼라 타입 — `sql_type()`(과 연관 `Op`)만 있으면 컬럼 자격을 얻는다.
pub struct Meters(pub f64);

impl PostgresType for Meters {
    type Op = NumOp<f64>;
    fn sql_type() -> SqlType {
        SqlType::DoublePrecision
    }
    // `nullable()`/`dependency_ddl()` 은 기본값(false / None)으로 충분하다.
}

assert_eq!(<Meters as PostgresType>::sql_type(), SqlType::DoublePrecision);
assert!(!<Meters as PostgresType>::nullable());
```

To actually bind as a column value (not just declare a DDL type), a real
custom type also needs `sqlx::Type<Postgres>` + `Encode`/`Decode` — the two
built-in derives that add new column types, `PostgresEnum` and
`PostgresJson`, generate exactly that wiring for you (native-enum or
JSONB-via-serde respectively; see [`enum`](enum.md), [`json`](json.md)).
`dependency_ddl()` is how a type says "create this before any table using me
as a column" — `PostgresEnum`'s implementation returns `Some(CREATE TYPE
...)`; the default (`None`) is right for anything that needs no such
preamble (plain scalars, `PostgresJson`).

## `Value` — the dynamic bind value

Every column value that crosses into a `sqlx::QueryBuilder` is first lowered
to `postgres::Value`, a small enum (`Text`/`I16`/`I32`/`I64`/`F32`/`F64`/
`Bool`/`Uuid`/`Timestamp`/`Enum(label, type_name)`/`Json`/`Null`) with a
single `push_bind` that knows how to bind each variant — including the
`::{type}` cast a native enum value needs. `init_pk` is the one PK-specific
helper built on top of it — a nil `Uuid` becomes a fresh v7, anything else
passes through unchanged (what every `insert_values()` implementation, hand
written or derived, calls for the PK column):

```rust
use postgres::uuid::Uuid;
use postgres::{Value, init_pk};

assert_eq!(Value::from(41_i64), Value::I64(41));

let generated = init_pk(Uuid::nil().into());
assert_ne!(generated, Value::Uuid(Uuid::nil())); // nil → v7 로 채번

let existing = Uuid::now_v7();
assert_eq!(init_pk(existing.into()), Value::Uuid(existing)); // nil 이 아니면 그대로 통과
```

## Extension traits — `Col<T>` and the `*Col` families

`.filter(|cols| ...)` (see [`query`](query.md)) works because the generated
`{Name}Cols` struct's fields are `Col<FieldType>`, and a family of small
extension traits (`StringCol`/`OrdCol<V>`/`BoolCol`/`UuidCol`/`EnumCol<E>`/
`JsonCol<J>`) are blanket-implemented over `Col<T>` keyed by `T::Op` — e.g.
`BoolCol` is implemented for any `Col<T> where T: PostgresType<Op = BoolOp>`,
so it applies to `bool` and `Option<bool>` columns alike, without the macro
needing to know either type by name. Adding a new operator family (a future
`RangeOp`, say) follows the same two-piece shape used by every existing one:
the `Op` enum + its `OpLower` lowering to `Cond` in `ops.rs`, and a `*Col`
trait blanket-implemented the same way `BoolCol`/`OrdCol` are in `col.rs`.

## Related

- [`entity`](entity.md) — where `PostgresType` plugs into the entity derive
- [`enum`](enum.md) / [`json`](json.md) — the two derives that add new column types today
- [`query`](query.md) — the operator/`Col` surface this underpins
