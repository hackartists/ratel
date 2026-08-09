//! Task 8.5 — `#[derive(PostgresJson)]` 검증.
//!
//! 1) 메타 검증 (kind/base_name/sql_type/ddl — JSON 은 스키마 오브젝트가 아니다).
//! 2) 라이브 PostgreSQL 왕복: JSONB 컬럼 insert/select roundtrip (NULL 포함).
//! 3) containment 연산자(`@>`) — `JsonOp::Contains` 를 통한 필터링이 실제로 매칭/불일치를
//!    가른다는 것을 증명 (ops.rs 의 낮춤 경로를 QueryBuilder 로 렌더해 실행).
#![allow(dead_code)]

mod common;

use postgres::cond::Cond;
use postgres::ops::{JsonOp, OpLower};
use postgres::sqlx::{Postgres, QueryBuilder, Row};
use postgres::uuid::Uuid;
use postgres::{
    ObjectKind, PostgresEntity, PostgresJson, PostgresObject, PostgresType, SqlType, Value,
};
use serde::{Deserialize, Serialize};
use serde_json::json;

/// JSONB 컬럼으로 저장할 named-field struct.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, PostgresJson)]
pub struct JAmount {
    pub currency: String,
    pub value: f64,
}

/// M3: 88개 모델 이관에서 반복될 패턴 — bare `Vec<String>` 필드는 컬럼이 될 수 없으므로
/// (entity/model.rs 의 컴파일 에러, `bare_vec_field.rs` ui 테스트 참고),
/// `#[derive(PostgresJson)]` 뉴타입으로 감싸 jsonb 컬럼으로 저장한다.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, PostgresJson)]
pub struct JTags {
    pub items: Vec<String>,
}

/// `Vec<T>` 뉴타입을 엔티티 스칼라 컬럼으로 쓴 예 — raw SQL 이 아니라 `PostgresEntity`
/// 전체 경로(insert_values/from_pg_row)로 jsonb 왕복이 되는지 증명한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "json_tagged")]
pub struct JTagged {
    pub id: Uuid,
    pub tags: JTags,
}

/// 단일 필드 tuple newtype — asset-storage 의 `Vec<String>` bare jsonb 배열과 동일한
/// 표현을 얻기 위한 마이그레이션 패턴. serde 가 단일 필드 tuple struct 를 투명하게
/// 직렬화하므로 `to_value` 결과는 named-field wrapper 없는 bare JSON 배열이다.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, PostgresJson)]
pub struct SourceFileIds(pub Vec<String>);

/// 위 tuple newtype 을 엔티티 스칼라 컬럼으로 쓴 예 — `JTagged` 와 동일한 경로로
/// jsonb 왕복 + 저장된 값의 shape(bare array) 을 검증한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "tuple_json_tagged")]
pub struct TupleJsonTagged {
    pub id: Uuid,
    pub ids: SourceFileIds,
}

/// M3 follow-up positive confirmation: `Option<Tags>` (a PostgresJson newtype wrapping
/// `Vec<T>`) is a valid *nullable* jsonb scalar column — the bare-`Vec`/`Option<Vec<_>>`
/// compile-time diagnostic only fires on an un-annotated `Vec`/`Option<Vec<_>>` field
/// directly; it must not reject a `PostgresJson` newtype just because that newtype
/// happens to wrap a `Vec` internally, nor when that newtype is further wrapped in
/// `Option` for nullability (`Option<T>: PostgresType` blanket impl, entity.rs).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "optional_tuple_json_tagged")]
pub struct OptionalTupleJsonTagged {
    pub id: Uuid,
    pub ids: Option<SourceFileIds>,
}

/// M8-prep: `PostgresJson` 이 enum 도 받는다. asset-storage 는 `OauthProvider` 류의
/// enum 을 jsonb 컬럼으로 저장한다 — unit variant 는 serde 기본(externally tagged)
/// 표현인 bare JSON 문자열(`"Google"`)로 저장된다. 생성 impl 이 `self` 전체를 serde 로
/// 직렬화하므로 tuple newtype 과 동일한 codegen 으로 그대로 통한다.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, PostgresJson)]
pub enum Prov {
    Google,
    Email,
}

/// data-carrying variant 를 가진 enum 도 jsonb 로 왕복된다 — `A` 는 `"A"`(문자열),
/// `B(i64)` 는 `{"B": 7}`(오브젝트) 로 직렬화된다.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, PostgresJson)]
pub enum EvtKind {
    A,
    B(i64),
}

/// enum 을 nullable jsonb 스칼라 컬럼(`Option<Prov>` / `Option<EvtKind>`)으로 쓴 엔티티 —
/// `PostgresEntity` 전체 경로(insert_values/from_pg_row)로 jsonb 왕복을 검증한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "enum_json_holder")]
pub struct EnumJsonHolder {
    pub id: Uuid,
    pub provider: Option<Prov>,
    pub evt: Option<EvtKind>,
}

// ─────────────────────────── 메타 ───────────────────────────

#[test]
fn json_meta() {
    assert_eq!(JAmount::kind(), ObjectKind::Json);
    assert_eq!(JAmount::base_name(), "j_amount");
    assert_eq!(<JAmount as PostgresType>::sql_type(), SqlType::JsonB);
    // JSON 은 스키마 오브젝트가 아니다 — CREATE/DROP 문이 없다.
    assert!(JAmount::ddl().create.is_empty());
    assert!(JAmount::ddl().drop.is_empty());
    assert!(<JAmount as PostgresType>::dependency_ddl().is_none());
}

/// M8-prep: enum 이 asset-storage 와 동일한 serde 기본 표현으로 직렬화되는지 —
/// unit variant `Prov::Google` → bare JSON 문자열 `"Google"`, data-carrying
/// `EvtKind::B(7)` → JSON 오브젝트 `{"B": 7}`.
#[test]
fn enum_serializes_with_serde_default_shape() {
    assert_eq!(serde_json::to_value(Prov::Google).unwrap(), json!("Google"));
    assert_eq!(serde_json::to_value(Prov::Email).unwrap(), json!("Email"));
    assert_eq!(serde_json::to_value(EvtKind::A).unwrap(), json!("A"));
    assert_eq!(
        serde_json::to_value(EvtKind::B(7)).unwrap(),
        json!({ "B": 7 })
    );

    // Value::from(enum) 경로도 동일한 jsonb 값을 만든다 (PostgresJson From<Self> for Value).
    assert!(matches!(Value::from(Prov::Google), Value::Json(v) if v == json!("Google")));
}

// ─────────────────────────── 라이브 왕복 ───────────────────────────

#[tokio::test]
async fn jsonb_column_roundtrip_with_null() {
    let pool = common::pool().await;

    sqlx::query("DROP TABLE IF EXISTS json_rt")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE TABLE json_rt (id INT, amount JSONB, memo JSONB)")
        .execute(&pool)
        .await
        .unwrap();

    let amount = JAmount {
        currency: "USD".into(),
        value: 1.5,
    };

    let mut qb: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO json_rt (id, amount, memo) VALUES (");
    qb.push_bind(1_i32);
    qb.push(", ");
    Value::from(amount.clone()).push_bind(&mut qb);
    qb.push(", ");
    Value::from(Option::<JAmount>::None).push_bind(&mut qb);
    qb.push(")");
    qb.build().execute(&pool).await.unwrap();

    let row = sqlx::query("SELECT amount, memo FROM json_rt WHERE id = 1")
        .fetch_one(&pool)
        .await
        .unwrap();
    assert_eq!(row.try_get::<JAmount, _>("amount").unwrap(), amount);
    assert_eq!(row.try_get::<Option<JAmount>, _>("memo").unwrap(), None);

    sqlx::query("DROP TABLE json_rt")
        .execute(&pool)
        .await
        .unwrap();
}

/// M3 positive confirmation: a `Vec<String>` field wrapped in a `#[derive(PostgresJson)]`
/// newtype (`JTags`) still works as a normal entity scalar column — insert through the
/// repository, read back, and confirm equality (the newtype path is unaffected by the
/// bare-`Vec<_>` compile error added for M3).
#[tokio::test]
async fn jsonb_vec_newtype_column_roundtrip() {
    // 다중 #[tokio::test] 바이너리 — 각 테스트는 자기 런타임에 묶인 풀을 써야 하므로
    // (프로세스 전역 풀은 첫 런타임에 고정된다) 명시적 풀 escape hatch 를 쓴다.
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<JTagged>::new(pool);

    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    let created = repo
        .insert(&JTagged {
            id: Uuid::nil(),
            tags: JTags {
                items: vec!["a".into(), "b".into()],
            },
        })
        .await
        .unwrap();

    let fetched = repo.get(created.id).await.unwrap().expect("row exists");
    assert_eq!(fetched.tags.items, vec!["a".to_string(), "b".to_string()]);

    repo.drop_table().await.ok();
}

/// Tuple newtype 이 asset-storage 와 동일하게 bare JSON 배열로 직렬화되는지 —
/// named-field wrapper(`{"0": [...]}` 등) 없이 `["a","b"]` 그 자체여야 한다.
#[test]
fn tuple_newtype_serializes_as_bare_json_array() {
    let ids = SourceFileIds(vec!["a".to_string(), "b".to_string()]);
    assert_eq!(serde_json::to_value(&ids).unwrap(), json!(["a", "b"]));
}

/// Tuple newtype 을 엔티티 스칼라 컬럼(jsonb)으로 왕복 — `JTagged` 와 동일한
/// `PostgresEntity` 경로(insert_values/from_pg_row)로 값이 보존되고, DB 에 실제로
/// 저장된 값이 named-field wrapper 없는 bare JSON 배열인지까지 확인한다.
#[tokio::test]
async fn tuple_newtype_jsonb_column_roundtrip_is_bare_array() {
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<TupleJsonTagged>::new(pool.clone());

    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    let created = repo
        .insert(&TupleJsonTagged {
            id: Uuid::nil(),
            ids: SourceFileIds(vec!["a".to_string(), "b".to_string()]),
        })
        .await
        .unwrap();

    let fetched = repo.get(created.id).await.unwrap().expect("row exists");
    assert_eq!(
        fetched.ids,
        SourceFileIds(vec!["a".to_string(), "b".to_string()])
    );

    // 저장된 jsonb 값 자체가 bare array 인지 — named-field wrapper 가 아님을 증명.
    let row = sqlx::query(
        "SELECT jsonb_typeof(ids) AS kind, ids::text AS raw FROM tuple_json_tagged WHERE id = $1",
    )
    .bind(created.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let kind: String = row.try_get("kind").unwrap();
    assert_eq!(kind, "array");
    let raw: String = row.try_get("raw").unwrap();
    let parsed: serde_json::Value = serde_json::from_str(&raw).unwrap();
    assert_eq!(parsed, json!(["a", "b"]));

    repo.drop_table().await.ok();
}

/// `Option<Tags>` roundtrips through the full `PostgresEntity` repository path for both
/// `Some` and `None` — proving the nullable jsonb newtype column is unaffected by the
/// bare-`Vec`/`Option<Vec<_>>` diagnostic.
#[tokio::test]
async fn optional_jsonb_tuple_newtype_column_roundtrip() {
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<OptionalTupleJsonTagged>::new(pool);

    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    let with_value = repo
        .insert(&OptionalTupleJsonTagged {
            id: Uuid::nil(),
            ids: Some(SourceFileIds(vec!["a".into(), "b".into()])),
        })
        .await
        .unwrap();
    let fetched = repo.get(with_value.id).await.unwrap().expect("row exists");
    assert_eq!(
        fetched.ids,
        Some(SourceFileIds(vec!["a".to_string(), "b".to_string()]))
    );

    let without_value = repo
        .insert(&OptionalTupleJsonTagged {
            id: Uuid::from_u128(1),
            ids: None,
        })
        .await
        .unwrap();
    let fetched_none = repo
        .get(without_value.id)
        .await
        .unwrap()
        .expect("row exists");
    assert_eq!(fetched_none.ids, None);

    repo.drop_table().await.ok();
}

#[tokio::test]
async fn jsonb_containment_operator_filters_rows() {
    let pool = common::pool().await;

    sqlx::query("DROP TABLE IF EXISTS json_contain")
        .execute(&pool)
        .await
        .unwrap();
    sqlx::query("CREATE TABLE json_contain (id INT, amount JSONB)")
        .execute(&pool)
        .await
        .unwrap();

    let amount = JAmount {
        currency: "USD".into(),
        value: 1.5,
    };
    let mut qb: QueryBuilder<Postgres> =
        QueryBuilder::new("INSERT INTO json_contain (id, amount) VALUES (");
    qb.push_bind(1_i32);
    qb.push(", ");
    Value::from(amount).push_bind(&mut qb);
    qb.push(")");
    qb.build().execute(&pool).await.unwrap();

    // 매칭 containment → 1건. ops.rs 의 `JsonOp::Contains` → `Cond` 낮춤 경로를 그대로
    // QueryBuilder SELECT 에 렌더해 연산자 표면을 end-to-end 로 증명한다.
    let matching: Cond = JsonOp::<JAmount>::Contains(json!({"currency": "USD"})).lower("amount");
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new("SELECT id FROM json_contain WHERE ");
    matching.render(&mut qb);
    let rows = qb.build().fetch_all(&pool).await.unwrap();
    assert_eq!(rows.len(), 1);

    // 불일치 containment → 0건.
    let non_matching: Cond =
        JsonOp::<JAmount>::Contains(json!({"currency": "KRW"})).lower("amount");
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new("SELECT id FROM json_contain WHERE ");
    non_matching.render(&mut qb);
    let rows = qb.build().fetch_all(&pool).await.unwrap();
    assert!(rows.is_empty());

    sqlx::query("DROP TABLE json_contain")
        .execute(&pool)
        .await
        .unwrap();
}

/// M8-prep: enum jsonb 컬럼이 `PostgresEntity` 전체 경로로 왕복되는지 —
/// unit variant, data-carrying variant, NULL 모두. 저장된 jsonb 의 `jsonb_typeof` 도
/// 확인한다 (`Prov::Google` → "string", `EvtKind::B(9)` → "object").
#[tokio::test]
async fn enum_jsonb_column_roundtrip() {
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<EnumJsonHolder>::new(pool.clone());

    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // ── unit variant + data-carrying variant ──
    let created = repo
        .insert(&EnumJsonHolder {
            id: Uuid::nil(),
            provider: Some(Prov::Google),
            evt: Some(EvtKind::B(9)),
        })
        .await
        .unwrap();
    let fetched = repo.get(created.id).await.unwrap().expect("row exists");
    assert_eq!(fetched.provider, Some(Prov::Google));
    assert_eq!(fetched.evt, Some(EvtKind::B(9)));

    // 저장된 jsonb 표현: unit → string, data-carrying → object.
    let row = sqlx::query(
        "SELECT jsonb_typeof(provider) AS p, jsonb_typeof(evt) AS e, provider::text AS praw \
         FROM enum_json_holder WHERE id = $1",
    )
    .bind(created.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row.try_get::<String, _>("p").unwrap(), "string");
    assert_eq!(row.try_get::<String, _>("e").unwrap(), "object");
    let praw: String = row.try_get("praw").unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&praw).unwrap(),
        json!("Google")
    );

    // ── NULL enum 컬럼 ──
    let with_null = repo
        .insert(&EnumJsonHolder {
            id: Uuid::from_u128(1),
            provider: None,
            evt: None,
        })
        .await
        .unwrap();
    let fetched_null = repo.get(with_null.id).await.unwrap().expect("row exists");
    assert_eq!(fetched_null.provider, None);
    assert_eq!(fetched_null.evt, None);

    repo.drop_table().await.ok();
}
