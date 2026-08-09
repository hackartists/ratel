mod common;

use postgres::sqlx::Row;
use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresEnum, PostgresObject, Schema};

#[derive(Debug, Default, Clone, Copy, PartialEq, PostgresEnum)]
enum VersionedState {
    #[default]
    Open,
    #[postgres(version = 1)]
    Closed,
    #[postgres(version = 2)]
    Archived,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "versioned_schema_records")]
struct VersionedRecord {
    id: Uuid,
    state: VersionedState,
    searchable: String,
    #[postgres(version = 1)]
    label: String,
    #[postgres(version = 1, sql_default = "'unknown'")]
    category: String,
    #[postgres(version = 2, index)]
    note: Option<String>,
    #[postgres(index(version = 2))]
    external_key: String,
}

#[test]
fn derive_emits_additive_table_and_enum_versions() {
    let enum_ddl = VersionedState::ddl();
    let enum_object = enum_ddl.versioned.expect("native enum metadata");
    assert_eq!(enum_object.scope, "enum:versioned_state");
    assert_eq!(enum_object.migrations.len(), 2);
    assert_eq!(
        enum_object.migrations[0].statements,
        ["ALTER TYPE \"versioned_state\" ADD VALUE IF NOT EXISTS 'closed'"]
    );

    let table_ddl = VersionedRecord::ddl();
    let object = table_ddl.versioned.expect("table metadata");
    assert_eq!(object.scope, "versioned_schema_records");
    assert_eq!(object.migrations.len(), 2);
    assert_eq!(
        object.migrations[0].statements,
        [
            "ALTER TABLE \"versioned_schema_records\" ADD COLUMN IF NOT EXISTS \"label\" TEXT NOT NULL DEFAULT ''",
            "ALTER TABLE \"versioned_schema_records\" ADD COLUMN IF NOT EXISTS \"category\" TEXT NOT NULL DEFAULT 'unknown'",
        ]
    );
    assert_eq!(
        object.migrations[1].statements,
        [
            "ALTER TABLE \"versioned_schema_records\" ADD COLUMN IF NOT EXISTS \"note\" TEXT",
            "CREATE INDEX IF NOT EXISTS \"versioned_schema_records_note_idx\" ON \"versioned_schema_records\"(\"note\")",
            "CREATE INDEX IF NOT EXISTS \"versioned_schema_records_external_key_idx\" ON \"versioned_schema_records\"(\"external_key\")",
        ]
    );
}

#[tokio::test]
async fn runner_upgrades_v0_and_is_idempotent() {
    let pool = common::pool().await;
    let schema = Schema::new().register::<VersionedRecord>();
    let table_name = VersionedRecord::name();
    let enum_name = VersionedState::name();
    let table_scope = table_name.clone();
    let enum_scope = format!("enum:{enum_name}");

    schema.drop(&pool).await.ok();
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS postgres_schema_versions (\
         scope text NOT NULL, version bigint NOT NULL, checksum text NOT NULL, \
         applied_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (scope, version))",
    )
    .execute(&pool)
    .await
    .unwrap();
    sqlx::query("DELETE FROM postgres_schema_versions WHERE scope = $1 OR scope = $2")
        .bind(&table_scope)
        .bind(&enum_scope)
        .execute(&pool)
        .await
        .unwrap();

    // 이미 운영 중인 DB의 v0 상태를 재현한다.
    let enum_baseline = VersionedState::ddl().versioned.unwrap().baseline;
    let table_baseline = VersionedRecord::ddl().versioned.unwrap().baseline;
    for statement in enum_baseline.iter().chain(table_baseline.iter()) {
        sqlx::query(statement).execute(&pool).await.unwrap();
    }

    // 구버전 바이너리가 준비한 명시적 SELECT의 결과 타입은 컬럼 추가 뒤에도 같다.
    let old_select = format!("SELECT id, state, searchable, external_key FROM \"{table_name}\"");
    let mut old_connection = pool.acquire().await.unwrap();
    sqlx::query(&old_select)
        .fetch_all(&mut *old_connection)
        .await
        .unwrap();

    schema
        .migrate_with_advisory_lock(&pool, 9_120_260_723)
        .await
        .unwrap();
    sqlx::query(&old_select)
        .fetch_all(&mut *old_connection)
        .await
        .unwrap();
    drop(old_connection);
    schema
        .migrate_with_advisory_lock(&pool, 9_120_260_723)
        .await
        .unwrap();
    schema.validate_versions(&pool).await.unwrap();

    // 최신 원장은 advisory lock을 잡지 않는 fast path로 끝나야 한다.
    let mut lock_tx = pool.begin().await.unwrap();
    sqlx::query("SELECT pg_advisory_xact_lock($1)")
        .bind(9_120_260_723_i64)
        .execute(&mut *lock_tx)
        .await
        .unwrap();
    tokio::time::timeout(
        std::time::Duration::from_secs(1),
        schema.migrate_with_advisory_lock(&pool, 9_120_260_723),
    )
    .await
    .expect("current schema must not wait for the migration lock")
    .unwrap();
    lock_tx.rollback().await.unwrap();

    let id = Uuid::now_v7();
    sqlx::query(&format!(
        "INSERT INTO \"{table_name}\" (id, state, searchable, external_key) \
         VALUES ($1, 'open', 'search', 'external')"
    ))
    .bind(id)
    .execute(&pool)
    .await
    .unwrap();
    let row = sqlx::query(&format!(
        "SELECT label, category, note FROM \"{table_name}\" WHERE id = $1"
    ))
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(row.try_get::<String, _>("label").unwrap(), "");
    assert_eq!(row.try_get::<String, _>("category").unwrap(), "unknown");
    assert_eq!(row.try_get::<Option<String>, _>("note").unwrap(), None);

    let versions: i64 = sqlx::query_scalar(
        "SELECT count(*)::bigint FROM postgres_schema_versions \
         WHERE scope = $1 OR scope = $2",
    )
    .bind(&table_scope)
    .bind(&enum_scope)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(versions, 6); // enum v0..2 + table v0..2

    sqlx::query(
        "UPDATE postgres_schema_versions SET checksum = 'tampered' \
         WHERE scope = $1 AND version = 1",
    )
    .bind(&table_scope)
    .execute(&pool)
    .await
    .unwrap();
    let error = schema.validate_versions(&pool).await.unwrap_err();
    assert!(error.to_string().contains("checksum mismatch"));

    schema.drop(&pool).await.unwrap();
    sqlx::query("DELETE FROM postgres_schema_versions WHERE scope = $1 OR scope = $2")
        .bind(table_scope)
        .bind(enum_scope)
        .execute(&pool)
        .await
        .unwrap();
}
