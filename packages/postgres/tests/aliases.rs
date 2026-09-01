//! M8-prep — asset-storage `#[pg(...)]` attribute 별칭.
//!
//! 88개 서버 모델 이관이 거의 순수 `pg`→`postgres` rename 이 되도록, 우리 매크로가
//! asset-storage 문법의 별칭을 받아준다:
//! - field `#[postgres(primary_key)]` = `pk` 별칭.
//! - field `#[postgres(order)]` = `default_order` 별칭.
//! - struct `#[postgres(repository)]` = 옛 `global` 별칭 → 이제 no-op(전역 풀 편의 메서드가
//!   모든 엔티티에 상시 생성되므로). 인식만 하고 무시한다.
//! - struct `#[postgres(partition = "…")]` / `#[postgres(legacy_sk = "…")]` = 인식만 하고
//!   무시(no-op) — asset-storage legacy, postgres 에 대응 개념 없음.
//!
//! 별칭이 붙은 struct 가 canonical(`pk` + `default_order`) 과 동일하게 동작하는지 라이브
//! PostgreSQL 로 검증한다: 전역 풀 arg-less 메서드 존재, pk 인식(`get_by_id`), finder 가
//! `order` 컬럼으로 DESC 정렬, repository/partition/legacy_sk 무시(컴파일/실행됨). finder 는
//! 전역 풀([`postgres::global`])을 쓴다.
//!
//! 각 `cargo test` 바이너리는 독립 프로세스라 자체 `OnceLock` 을 가진다 — 전역 풀 init 은
//! 이 파일에서만 한다.
#![allow(dead_code)]

use std::sync::OnceLock;

use postgres::PostgresEntity;
use postgres::uuid::Uuid;

/// 전부 asset-storage 별칭으로 선언한 엔티티:
/// - `repository` (옛 `global` 별칭): 이제 no-op — 인식만 하고 무시. 전역 풀 arg-less
///   메서드 + named finder 는 상시 활성이라 이 플래그 없이도 생성된다.
/// - `partition` / `legacy_sk`: 인식만 하고 무시 — 컴파일·실행되면 무시가 증명된다.
/// - `primary_key` (= `pk`): `id` 를 pk 로 인식.
/// - `order` (= `default_order`): finder 가 `created_at` 으로 `ORDER BY … DESC`.
/// - `find`: 전역 풀 named finder (canonical 문법 그대로, 별칭 아님).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(
    table = "al_users",
    repository,
    partition = "User",
    legacy_sk = "USER#{id}"
)]
pub struct AlUser {
    #[postgres(primary_key)]
    pub id: Uuid,
    #[postgres(order)]
    pub created_at: i64,
    #[postgres(find = "find_by_group")]
    pub group_id: i64,
    pub name: String,
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
async fn asset_storage_aliases_behave_like_canonical() {
    ensure_global_pool().await;

    // `repository` 는 이제 no-op 이지만, 전역 풀 arg-less 메서드는 상시 생성된다.
    let repo = AlUser::repository();
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // ── seed: 같은 group 의 3행 (created_at 다르게) ──
    let group = 42_i64;
    for (ts, name) in [(100i64, "oldest"), (300, "newest"), (200, "middle")] {
        AlUser {
            id: Uuid::nil(),
            created_at: ts,
            group_id: group,
            name: name.into(),
        }
        .create()
        .await
        .unwrap();
    }

    // ── `primary_key` 별칭 → pk 인식: get_by_id 가 동작한다 ──
    let one = AlUser::find_by_group(group).await.unwrap().items[0].clone();
    let by_id = AlUser::get_by_id(one.id).await.unwrap();
    assert!(by_id.is_some(), "primary_key alias must make `id` the pk");
    assert_eq!(by_id.unwrap().id, one.id);

    // ── `order` 별칭 → default_order: finder 가 created_at DESC 로 정렬 ──
    let page = AlUser::find_by_group(group).await.unwrap();
    assert_eq!(page.items.len(), 3);
    assert_eq!(page.total_count, 3);
    let order: Vec<i64> = page.items.iter().map(|u| u.created_at).collect();
    assert_eq!(
        order,
        vec![300, 200, 100],
        "order alias must drive DESC default_order"
    );

    // partition / legacy_sk 는 무시된다 — 여기까지 컴파일·실행된 것 자체가 증명이다
    // (대응 컬럼/제약을 만들지 않았고 에러도 나지 않았다).

    repo.drop_table().await.unwrap();
}
