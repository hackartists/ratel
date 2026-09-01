//! Task 8 — `#[derive(PostgresEnum)]` 검증.
//!
//! 1) 메타/DDL 단위 검증 (kind/base_name/ddl 라벨·rename/Value::from).
//! 2) 라이브 PostgreSQL 왕복: native enum 타입 컬럼 + `#[postgres(text)]` TEXT 컬럼.
#![allow(dead_code)]

mod common;

use postgres::cond::Cond;
use postgres::ops::{EnumOp, OpLower};
use postgres::sqlx::{Postgres, QueryBuilder, Row};
use postgres::{
    ObjectKind, PostgresEnum, PostgresEnumMeta, PostgresObject, PostgresType, SqlType, Value,
};

/// Cond → 렌더된 SQL 문자열 (바인딩 자리표시자 포함). unit_ops.rs 패턴 재사용.
fn render(c: Cond) -> String {
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new("");
    c.render(&mut qb);
    qb.sql().to_string()
}

// ─────────────────────────── 대상 enum ───────────────────────────

/// native PG enum 타입으로 저장. `Member` 는 rename 라벨.
#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
pub enum TRole {
    Owner,
    Admin,
    #[postgres(rename = "member_x")]
    Member,
}

/// TEXT 컬럼 저장(모드). PG 타입을 만들지 않는다.
#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
#[postgres(text)]
pub enum TColor {
    Red,
    Green,
    #[postgres(rename = "deep_blue")]
    Blue,
}

/// 라벨에 작은따옴표가 든 rename — DDL 이스케이프 검증용.
#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
pub enum TQuote {
    #[postgres(rename = "o'brien")]
    OBrien,
    Plain,
}

/// 직접 `.bind()` Encode 왕복 전용 native enum. `TRole` 와 별도 PG 타입을 써서
/// 두 native 테스트가 병렬로 같은 타입에 `DROP TYPE` 를 걸어 경쟁하지 않도록 격리한다.
#[derive(Debug, Clone, Copy, PartialEq, PostgresEnum)]
pub enum TBind {
    Owner,
    Admin,
    #[postgres(rename = "member_x")]
    Member,
}

/// TEXT 모드 + 단일 catch-all(`Unknown(String)`): 알려진 라벨이 아니면 원문을 흡수.
#[derive(Debug, Clone, PartialEq, PostgresEnum)]
#[postgres(text)]
pub enum TKind {
    Alpha,
    Beta,
    Unknown(String),
}

// ─────────────────────────── 메타/DDL ───────────────────────────

#[test]
fn enum_meta_and_ddl() {
    assert_eq!(TRole::kind(), ObjectKind::Enum);
    assert_eq!(TRole::base_name(), "t_role");

    let create = &TRole::ddl().create[0];
    assert!(
        create.contains("'owner', 'admin', 'member_x'"),
        "got: {create}"
    );
    assert!(create.contains("CREATE TYPE"));
    assert!(create.contains("duplicate_object"));
    assert_eq!(
        TRole::ddl().drop[0],
        format!("DROP TYPE IF EXISTS \"{}\"", TRole::pg_type_name())
    );

    assert_eq!(
        <TRole as PostgresType>::sql_type(),
        SqlType::Enum(TRole::pg_type_name())
    );
    assert!(<TRole as PostgresType>::dependency_ddl().is_some());

    assert_eq!(
        Value::from(TRole::Admin),
        Value::Enum("admin".into(), TRole::pg_type_name())
    );
    assert_eq!(
        Value::from(TRole::Member),
        Value::Enum("member_x".into(), TRole::pg_type_name())
    );
    assert_eq!(TRole::Member.pg_label().as_ref(), "member_x");
}

#[test]
fn text_enum_meta() {
    assert_eq!(TColor::base_name(), "t_color");
    // text 모드 — 스키마 오브젝트 없음.
    assert!(TColor::ddl().create.is_empty());
    assert!(TColor::ddl().drop.is_empty());
    assert_eq!(<TColor as PostgresType>::sql_type(), SqlType::Text);
    assert!(<TColor as PostgresType>::dependency_ddl().is_none());
    assert_eq!(Value::from(TColor::Blue), Value::Text("deep_blue".into()));
    assert_eq!(Value::from(TColor::Red), Value::Text("red".into()));
}

#[test]
fn text_enum_catch_all_meta() {
    // known variant → snake_case label.
    assert_eq!(TKind::Alpha.pg_label().as_ref(), "alpha");
    assert_eq!(Value::from(TKind::Beta), Value::Text("beta".into()));

    // catch-all → the raw inner string, verbatim (this is the label + bound value).
    assert_eq!(
        TKind::Unknown("weird_metric".into()).pg_label().as_ref(),
        "weird_metric"
    );
    assert_eq!(
        Value::from(TKind::Unknown("weird_metric".into())),
        Value::Text("weird_metric".into())
    );

    // still a TEXT column — no schema object emitted.
    assert_eq!(<TKind as PostgresType>::sql_type(), SqlType::Text);
    assert!(TKind::ddl().create.is_empty());
}

/// Finding 1 — CREATE TYPE 라벨 리스트의 작은따옴표는 `''` 로 이스케이프되어야 한다.
#[test]
fn enum_ddl_escapes_single_quotes() {
    let create = &TQuote::ddl().create[0];
    assert!(
        create.contains("'o''brien'"),
        "single quote in enum label must be doubled, got: {create}"
    );
    // 이스케이프 안 된 원문 라벨이 그대로 새 나가지 않아야 한다.
    assert!(
        !create.contains("'o'brien'"),
        "unescaped label must not appear, got: {create}"
    );
}

/// Finding 2 — enum 필터 낮춤이 모드 인지형 `From<E> for Value` 를 통과하는지 검증.
/// native enum 은 `::타입` 캐스트를, `#[postgres(text)]` enum 은 캐스트 없는
/// 순수 비교를 만들어야 한다(존재하지 않는 PG 타입으로 캐스트 금지).
#[test]
fn enum_op_lowering_is_mode_aware() {
    // native → Value::Enum → `::타입` 캐스트.
    let native = render(EnumOp::Eq(TRole::Admin).lower("role"));
    let cast = format!("::{}", TRole::pg_type_name());
    assert!(
        native.contains(&cast),
        "native enum filter must emit `{cast}` cast, got: {native}"
    );

    // text → Value::Text → 캐스트 없는 순수 `"col" = $1`.
    let text = render(EnumOp::Eq(TColor::Blue).lower("color"));
    assert_eq!(text, r#""color" = $1"#);
    assert!(
        !text.contains("::"),
        "text enum filter must NOT cast to a PG type, got: {text}"
    );
}

// ─────────────────────────── 라이브 왕복 ───────────────────────────

#[tokio::test]
async fn native_enum_column_roundtrip() {
    let pool = common::pool().await;
    let ty = TRole::pg_type_name();

    // 정리 후 CREATE TYPE (idempotent DO 블록) + CREATE TABLE.
    sqlx::query("DROP TABLE IF EXISTS enum_rt")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&TRole::ddl().drop[0])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&TRole::ddl().create[0])
        .execute(&pool)
        .await
        .unwrap();
    // create 재실행이 duplicate_object 를 삼키는지도 확인.
    sqlx::query(&TRole::ddl().create[0])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&format!("CREATE TABLE enum_rt (id INT, role \"{ty}\")"))
        .execute(&pool)
        .await
        .unwrap();

    // INSERT — Value::Enum 바인딩(라벨 + ::타입 캐스트)을 QueryBuilder 로 통과시킨다.
    let mut qb: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO enum_rt (id, role) VALUES (");
    qb.push_bind(1_i32);
    qb.push(", ");
    Value::from(TRole::Admin).push_bind(&mut qb);
    qb.push(")");
    qb.build().execute(&pool).await.unwrap();

    // rename 라벨도 왕복.
    let mut qb2: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO enum_rt (id, role) VALUES (");
    qb2.push_bind(2_i32);
    qb2.push(", ");
    Value::from(TRole::Member).push_bind(&mut qb2);
    qb2.push(")");
    qb2.build().execute(&pool).await.unwrap();

    // SELECT → Decode 로 variant 복원.
    let row = sqlx::query("SELECT role FROM enum_rt WHERE id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.try_get::<TRole, _>("role").unwrap(), TRole::Admin);

    let row2 = sqlx::query("SELECT role FROM enum_rt WHERE id = 2")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row2.try_get::<TRole, _>("role").unwrap(), TRole::Member);

    // 정리.
    sqlx::query("DROP TABLE enum_rt")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&TRole::ddl().drop[0])
        .execute(&pool)
        .await
        .unwrap();
}

#[tokio::test]
async fn text_enum_column_roundtrip() {
    let pool = common::pool().await;

    sqlx::query("DROP TABLE IF EXISTS enum_txt")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE TABLE enum_txt (id INT, color TEXT)")
        .execute(&pool)
        .await
        .unwrap();

    let mut qb: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO enum_txt (id, color) VALUES (");
    qb.push_bind(1_i32);
    qb.push(", ");
    Value::from(TColor::Blue).push_bind(&mut qb); // Value::Text("deep_blue")
    qb.push(")");
    qb.build().execute(&pool).await.unwrap();

    let row = sqlx::query("SELECT color FROM enum_txt WHERE id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.try_get::<TColor, _>("color").unwrap(), TColor::Blue);

    sqlx::query("DROP TABLE enum_txt")
        .execute(&pool)
        .await
        .unwrap();
}

/// Finding 3 — 생성된 `sqlx::Encode`/`Type` impl 을 통한 직접 `.bind(TBind::…)`.
/// QueryBuilder 의 `Value::Enum` 캐스트 경로가 아니라, raw 바인딩으로 enum 타입
/// 컬럼에 값을 넣고 다시 읽어 Encode/Decode 왕복을 증명한다. 명시 캐스트 없이도
/// 생성된 `Type` 이 named enum 타입을 선언하므로 그대로 통과한다.
#[tokio::test]
async fn native_enum_direct_encode_bind() {
    let pool = common::pool().await;
    let ty = TBind::pg_type_name();

    sqlx::query("DROP TABLE IF EXISTS enum_bind")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&TBind::ddl().create[0])
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&format!("CREATE TABLE enum_bind (id INT, role \"{ty}\")"))
        .execute(&pool)
        .await
        .unwrap();

    // 직접 Encode 바인딩 — 생성된 impl 이 enum 타입 컬럼에 대해 동작함을 증명.
    sqlx::query("INSERT INTO enum_bind (id, role) VALUES ($1, $2)")
        .bind(1_i32)
        .bind(TBind::Admin)
        .execute(&pool)
        .await
        .unwrap();

    // rename 라벨도 raw 바인딩.
    sqlx::query("INSERT INTO enum_bind (id, role) VALUES ($1, $2)")
        .bind(2_i32)
        .bind(TBind::Member)
        .execute(&pool)
        .await
        .unwrap();

    let row = sqlx::query("SELECT role FROM enum_bind WHERE id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.try_get::<TBind, _>("role").unwrap(), TBind::Admin);

    let row2 = sqlx::query("SELECT role FROM enum_bind WHERE id = 2")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row2.try_get::<TBind, _>("role").unwrap(), TBind::Member);

    sqlx::query("DROP TABLE enum_bind")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query(&TBind::ddl().drop[0])
        .execute(&pool)
        .await
        .unwrap();
}
