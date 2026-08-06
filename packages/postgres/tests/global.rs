//! M6 — 전역 풀 arg-less 편의 메서드.
//!
//! asset-storage 패리티: 서버가 pool 인자 없이 엔티티 메서드를 호출한다
//! (`X::get_by_id(id)` / `x.upsert()` / `x.create()` / `X::delete_by_id(id)`),
//! 프로세스 전역 풀([`postgres::global`]) 이 뒤를 받친다. 이 arg-less 메서드는 이제
//! 모든 엔티티에 상시 생성된다 (예전의 `#[postgres(global)]` 게이트는 제거됨).
//!
//! 각 `cargo test` 바이너리는 독립 프로세스라 자체 `OnceLock` 을 가진다 — 전역
//! 풀 init 은 이 파일에서만 한다.
#![allow(dead_code)]

use std::sync::OnceLock;

use postgres::uuid::Uuid;
use postgres::{PgKey, PostgresEntity};

/// 스칼라 3개. pk 는 `id: Uuid` 자동 인식. 전역 풀 arg-less 메서드(create/get_by_id/
/// upsert/delete_by_id)는 이제 모든 엔티티에 상시 생성된다 (예전 `global` 플래그 제거됨).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "g_users")]
pub struct GUser {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
}

/// 전역 풀을 이 바이너리에서 정확히 한 번 심는다 (first-wins 라 중복 호출도 안전).
async fn ensure_global_pool() {
    static INIT: OnceLock<()> = OnceLock::new();
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres@localhost:5432/postgres".into());
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("postgres unreachable — run `make pg` first");
    postgres::set_global_pool(pool);
    let _ = INIT.set(());
}

#[tokio::test]
async fn global_mode_roundtrip() {
    ensure_global_pool().await;

    // create_table 도 전역 풀 레포로 — pool 인자 없이.
    let repo = GUser::repository();
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // ── create(): nil uuid → v7 채번, 반환 행에 pk 반영 ──
    let saved = GUser {
        id: Uuid::nil(),
        name: "hackartist".into(),
        age: 40,
    }
    .create()
    .await
    .unwrap();
    assert!(!saved.id.is_nil(), "create must assign a v7 pk");

    // ── get_by_id: pk 타입 그대로 (Uuid) ──
    let got = GUser::get_by_id(saved.id).await.unwrap();
    assert!(got.is_some(), "get_by_id(Uuid) should find the row");
    assert_eq!(got.unwrap().name, "hackartist");

    // ── get_by_id: 문자열 → Uuid (PgKey String→Uuid 파싱) ──
    let got_str = GUser::get_by_id(saved.id.to_string()).await.unwrap();
    assert!(
        got_str.is_some(),
        "get_by_id(String) should parse and find the row"
    );
    assert_eq!(got_str.unwrap().id, saved.id);

    // ── upsert(): 기존 pk 로 갱신 (ON CONFLICT DO UPDATE) ──
    let updated = GUser {
        id: saved.id,
        name: "renamed".into(),
        age: 41,
    }
    .upsert()
    .await
    .unwrap();
    assert_eq!((updated.name.as_str(), updated.age), ("renamed", 41));
    let reread = GUser::get_by_id(saved.id).await.unwrap().unwrap();
    assert_eq!((reread.name.as_str(), reread.age), ("renamed", 41));

    // ── delete_by_id(): 삭제된 행 반환 ──
    let deleted = GUser::delete_by_id(saved.id).await.unwrap();
    assert_eq!(deleted.id, saved.id);
    assert_eq!(deleted.name, "renamed");

    // 삭제 후 조회는 None.
    assert!(
        GUser::get_by_id(saved.id).await.unwrap().is_none(),
        "row must be gone after delete_by_id"
    );

    repo.drop_table().await.unwrap();
}

/// PgKey: 잘못된 문자열 → Uuid 변환은 Err(InvalidKey) (DB 불필요).
#[test]
fn pg_key_invalid_uuid_is_err() {
    let r: postgres::Result<Uuid> = "not-a-uuid".to_string().into_pg_key();
    assert!(matches!(r, Err(postgres::Error::InvalidKey(_))));

    // 유효한 값은 Ok.
    let id = Uuid::now_v7();
    let ok: postgres::Result<Uuid> = id.to_string().into_pg_key();
    assert_eq!(ok.unwrap(), id);
}
