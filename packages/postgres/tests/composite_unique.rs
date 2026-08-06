//! Composite UNIQUE (`#[postgres(unique(a, b))]`) + natural-key upsert (`upsert_on`),
//! proven against a live PostgreSQL roundtrip.
//!
//! - the derive emits a `CREATE UNIQUE INDEX` on `(workspace_id, application_number)`, so a
//!   second `insert` with a *different* surrogate pk but the *same* natural key is rejected
//!   by the DB (not silently duplicated);
//! - `PostgresRepository::upsert_on(&["workspace_id", "application_number"], …)` dedups on
//!   that natural key atomically — same key updates in place (pk preserved, non-key columns
//!   refreshed), a new key inserts.
//!
//! House convention: one `#[tokio::test]` per file so a single table isn't created/dropped
//! concurrently by sibling tests.
#![allow(dead_code)]

mod common;

use postgres::PostgresEntity;
use postgres::uuid::Uuid;

/// Surrogate uuid PK + the natural key `(workspace_id, application_number)` backed by a
/// struct-level composite UNIQUE. Mirrors `PatentRecord`'s shape in miniature.
#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
#[postgres(table = "cu_records", unique(workspace_id, application_number))]
pub struct CuRecord {
    pub id: Uuid,
    #[postgres(index)]
    pub workspace_id: Uuid,
    #[postgres(index)]
    pub application_number: String,
    pub title: String,
    pub fetched_at: i64,
}

#[tokio::test]
async fn composite_unique_and_natural_key_upsert() {
    common::pool().await; // 전역 풀 시딩 (first-wins)
    let repo = CuRecord::repository();
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    let workspace = Uuid::now_v7();

    // ── 1) 첫 insert → 성공, pk 채번 ──
    let first = repo
        .insert(&CuRecord {
            id: Uuid::now_v7(),
            workspace_id: workspace,
            application_number: "10-2024-0000001".into(),
            title: "original".into(),
            fetched_at: 1,
        })
        .await
        .unwrap();
    assert!(!first.id.is_nil());

    // ── 2) 같은 (workspace_id, application_number) 를 *다른* pk 로 insert → 복합 UNIQUE
    //       인덱스 위반으로 거부되어야 한다 (조용한 중복 금지) ──
    let dup = repo
        .insert(&CuRecord {
            id: Uuid::now_v7(), // 다른 surrogate pk
            workspace_id: workspace,
            application_number: "10-2024-0000001".into(), // 같은 자연키
            title: "dup".into(),
            fetched_at: 2,
        })
        .await;
    assert!(
        dup.is_err(),
        "duplicate (workspace_id, application_number) must violate the composite UNIQUE index"
    );
    // 여전히 한 행뿐.
    assert_eq!(repo.find(CuRecord::query()).await.unwrap().total_count, 1);

    // ── 3) upsert_on(자연키) — 같은 키, 바뀐 non-key 컬럼 → in-place 갱신 (pk 보존) ──
    let updated = repo
        .upsert_on(
            &["workspace_id", "application_number"],
            &CuRecord {
                id: Uuid::now_v7(), // 새 후보 pk — 무시되고 기존 id 가 유지돼야 한다
                workspace_id: workspace,
                application_number: "10-2024-0000001".into(),
                title: "refreshed".into(),
                fetched_at: 99,
            },
        )
        .await
        .unwrap();
    assert_eq!(
        updated.id, first.id,
        "natural-key upsert must preserve the existing pk"
    );
    assert_eq!(updated.title, "refreshed");
    assert_eq!(updated.fetched_at, 99);
    assert_eq!(
        repo.find(CuRecord::query()).await.unwrap().total_count,
        1,
        "upsert on an existing natural key must not duplicate the row"
    );

    // ── 4) upsert_on(자연키) — 새로운 키 → insert ──
    let inserted = repo
        .upsert_on(
            &["workspace_id", "application_number"],
            &CuRecord {
                id: Uuid::now_v7(),
                workspace_id: workspace,
                application_number: "10-2024-0000002".into(), // 새 자연키
                title: "second".into(),
                fetched_at: 3,
            },
        )
        .await
        .unwrap();
    assert_ne!(inserted.id, first.id);
    assert_eq!(repo.find(CuRecord::query()).await.unwrap().total_count, 2);

    repo.drop_table().await.unwrap();
}
