//! M2 — `PostgresRepository::upsert` (`INSERT … ON CONFLICT (pk) DO UPDATE SET … RETURNING <columns>`).
//!
//! 한 테스트 함수에 시나리오를 몰아넣는 하우스 컨벤션(`crud.rs` 등)을 따른다 — 파일당
//! 여러 `#[tokio::test]` 가 같은 테이블을 동시에 create/drop 하면 경합이 생긴다.
#![allow(dead_code)]

mod common;

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, Tx};

/// pk + 두 개의 non-pk 컬럼짜리 단순 엔티티 — 전용 테이블(`up_users`)로 격리.
#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
#[postgres(table = "up_users")]
pub struct UpUser {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
}

#[tokio::test]
async fn upsert_roundtrip() {
    common::pool().await; // 전역 풀 시딩 (first-wins)
    let repo = UpUser::repository();
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // ── upsert 새 엔티티(nil pk) → 삽입, pk 채번 ──
    let saved = repo
        .upsert(&UpUser {
            id: Uuid::nil(),
            name: "alice".into(),
            age: 20,
        })
        .await
        .unwrap();
    assert!(!saved.id.is_nil());
    assert_eq!(saved.name, "alice");
    assert_eq!(saved.age, 20);
    let got = repo.get(saved.id).await.unwrap().unwrap();
    assert_eq!(got.name, "alice");

    // ── 같은 pk, 바뀐 non-pk 필드로 재-upsert → UPDATE, 신규 행 아님 ──
    let updated = repo
        .upsert(&UpUser {
            id: saved.id,
            name: "alice-changed".into(),
            age: 21,
        })
        .await
        .unwrap();
    assert_eq!(updated.id, saved.id);
    assert_eq!(updated.name, "alice-changed");
    assert_eq!(updated.age, 21);
    let all = repo.find(UpUser::query()).await.unwrap();
    assert_eq!(
        all.total_count, 1,
        "upsert on an existing pk must not duplicate the row"
    );
    let got = repo.get(saved.id).await.unwrap().unwrap();
    assert_eq!(got.name, "alice-changed");
    assert_eq!(got.age, 21);

    // ── 같은 pk 로 다시 upsert(3회차) → 최신 값 반영, 여전히 한 행 ──
    let third = repo
        .upsert(&UpUser {
            id: saved.id,
            name: "alice-final".into(),
            age: 22,
        })
        .await
        .unwrap();
    assert_eq!(third.name, "alice-final");
    assert_eq!(third.age, 22);
    let all = repo.find(UpUser::query()).await.unwrap();
    assert_eq!(all.total_count, 1);

    // ── 트랜잭션 바운드 repo 에서도 upsert 는 같은 tx 로 나간다 ──
    let tx = Tx::begin().await.unwrap();
    let tx_repo = repo.with_tx(&tx);
    let tx_saved = tx_repo
        .upsert(&UpUser {
            id: Uuid::nil(),
            name: "dave".into(),
            age: 25,
        })
        .await
        .unwrap();
    assert!(tx_repo.get(tx_saved.id).await.unwrap().is_some());
    tx.commit().await.unwrap();
    assert!(repo.get(tx_saved.id).await.unwrap().is_some());

    repo.drop_table().await.unwrap();
}
