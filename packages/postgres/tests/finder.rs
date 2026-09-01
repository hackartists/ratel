//! M5 — named finder (`#[postgres(find = "…")]`).
//!
//! asset-storage 패리티: FK 스칼라에 `find = "find_by_room"` 을 달면, 서버가 pool 인자
//! 없이 `X::find_by_room(value)` 를 호출해 그 컬럼 == value 인 전 행을 `Page<Self>` 로
//! 받는다. `#[postgres(default_order)]` 필드가 있으면 finder 는 그 컬럼으로
//! `ORDER BY … DESC` (newest-first) 정렬한다. finder 는 전역 풀([`postgres::global`])을
//! 쓰며, 그 풀은 상시 사용 가능하므로 별도 struct 플래그가 필요없다.
//!
//! 라이브 PostgreSQL 왕복으로: (1) 컬럼 필터링(해당 room 만), (2) default_order DESC 정렬,
//! (3) `find_by_room_page(v, page, size)` 페이지네이션(items/total_count/total_pages/page)을
//! 검증한다. finder 는 관계 hydrate 를 하지 않는(bare 행) `find_by_spec` 을 경유한다.
//!
//! 각 `cargo test` 바이너리는 독립 프로세스라 자체 `OnceLock` 을 가진다 — 전역 풀 init 은
//! 이 파일에서만 한다.
#![allow(dead_code)]

use std::sync::OnceLock;

use postgres::PostgresEntity;
use postgres::uuid::Uuid;

/// FK 참조 대상 (부모). finder 대상 테이블의 `room_id` 가 이 테이블의 `id` 를 참조한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fd_rooms")]
pub struct FdRoom {
    pub id: Uuid,
}

/// finder 대상. `room_id` 는 finder(`find_by_room`) + FK(REFERENCES fd_rooms(id))를 동시에
/// 갖고(둘은 독립 조합), `created_at` 은 default_order (finder 가 이 컬럼으로 DESC 정렬).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fd_posts")]
pub struct FdPost {
    pub id: Uuid,
    #[postgres(find = "find_by_room", references = "fd_rooms(id)")]
    pub room_id: Uuid,
    #[postgres(default_order)]
    pub created_at: i64,
    pub title: String,
}

/// M5 fix — FK 참조 대상 (pk-field finder 케이스의 부모).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fd_pk_finder_users")]
pub struct FdUser {
    pub id: Uuid,
}

/// M5 fix — pk 필드도 `find` 대상이 될 수 있다. 실서버 선례
/// (`#[pg(primary_key, find = "find_by_user")]`, screener_watchlist.rs)를 그대로
/// 재현: `user_id` 는 pk 이면서 finder(`find_by_user`) 이면서 FK(REFERENCES
/// fd_pk_finder_users(id))다 — 셋 다 독립적으로 조합된다. pk 컬럼은 unique 하므로
/// finder 는 최대 1행만 매치한다(get 과 동등하되 Page 로 감싼다).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fd_pk_finders")]
pub struct FdPkFinder {
    #[postgres(pk, find = "find_by_user", references = "fd_pk_finder_users(id)")]
    pub user_id: Uuid,
    pub title: String,
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
async fn named_finder_filters_orders_and_paginates() {
    ensure_global_pool().await;

    let room_repo = FdRoom::repository();
    let post_repo = FdPost::repository();

    // 자식(FK 소유) 먼저 drop, 부모 나중 — 반대로 create.
    post_repo.drop_table().await.ok();
    room_repo.drop_table().await.ok();
    room_repo.create_table().await.unwrap();
    post_repo.create_table().await.unwrap();

    // ── seed: 1 room + 3 posts (created_at 다르게) + 다른 room 의 post 1개 ──
    let room = FdRoom { id: Uuid::nil() }.create().await.unwrap();
    let other = FdRoom { id: Uuid::nil() }.create().await.unwrap();

    for (ts, title) in [(100i64, "oldest"), (300, "newest"), (200, "middle")] {
        FdPost {
            id: Uuid::nil(),
            room_id: room.id,
            created_at: ts,
            title: title.into(),
        }
        .create()
        .await
        .unwrap();
    }
    FdPost {
        id: Uuid::nil(),
        room_id: other.id,
        created_at: 999,
        title: "other-room".into(),
    }
    .create()
    .await
    .unwrap();

    // ── find_by_room(room): 그 room 만(3개), default_order created_at DESC ──
    let page = FdPost::find_by_room(room.id).await.unwrap();
    assert_eq!(page.items.len(), 3, "only this room's posts");
    assert_eq!(page.total_count, 3);
    assert_eq!(page.total_pages, 1, "unpaged → single page");
    // created_at DESC → 300, 200, 100 (newest-first).
    let order: Vec<i64> = page.items.iter().map(|p| p.created_at).collect();
    assert_eq!(order, vec![300, 200, 100], "default_order must be DESC");
    assert!(
        page.items.iter().all(|p| p.room_id == room.id),
        "finder must only return the matched room"
    );

    // ── find_by_room(other): 다른 room 은 1개만 ──
    let other_page = FdPost::find_by_room(other.id).await.unwrap();
    assert_eq!(other_page.items.len(), 1);
    assert_eq!(other_page.total_count, 1);
    assert_eq!(other_page.items[0].title, "other-room");

    // ── find_by_room_page(room, 1, 2): 첫 페이지 2개, 총 3개, 2페이지 ──
    let p1 = FdPost::find_by_room_page(room.id, 1, 2).await.unwrap();
    assert_eq!(p1.items.len(), 2, "page 1 holds page_size rows");
    assert_eq!(p1.total_count, 3);
    assert_eq!(p1.total_pages, 2);
    assert_eq!(p1.page, 1);
    assert_eq!(p1.page_size, 2);
    // 정렬 유지: 첫 페이지 = 300, 200.
    assert_eq!(
        p1.items.iter().map(|p| p.created_at).collect::<Vec<_>>(),
        vec![300, 200],
        "page 1 keeps DESC order"
    );

    // ── page 2: 나머지 1개 (created_at 100) ──
    let p2 = FdPost::find_by_room_page(room.id, 2, 2).await.unwrap();
    assert_eq!(p2.items.len(), 1, "page 2 holds the remaining row");
    assert_eq!(p2.total_count, 3);
    assert_eq!(p2.page, 2);
    assert_eq!(p2.items[0].created_at, 100);

    post_repo.drop_table().await.unwrap();
    room_repo.drop_table().await.unwrap();

    // ── M5 fix: pk 필드도 `find` 대상이 될 수 있다 ──
    // 이전엔 finder codegen 이 `scalars` 만 순회해 pk 필드의 `find` attr 을 조용히
    // 무시했다 (asset-storage 실서버 모델 screener_watchlist.rs 의
    // `#[pg(primary_key, find = "find_by_user")]` 형태가 postgres-macros 로는 생성되지
    // 않았을 gap). pk + FK(references) + finder(find) 셋을 동시에 단 필드로 검증한다.
    // (같은 파일의 다른 `#[tokio::test]` 로 쪼개지 않는다 — finder 는 프로세스 전역 풀을
    // 공유하므로, 별개 테스트 함수는 병렬 실행 시 4-connection 풀을 놓고 경합해
    // `PoolTimedOut` 으로 flaky 해진다; `upsert.rs` 의 "한 테스트 함수에 몰아넣는" 하우스
    // 컨벤션을 그대로 따른다.)
    let finder_repo = FdPkFinder::repository();
    let user_repo = FdUser::repository();

    finder_repo.drop_table().await.ok();
    user_repo.drop_table().await.ok();
    user_repo.create_table().await.unwrap();
    // FK 제약(REFERENCES fd_pk_finder_users(id))이 DDL 에 실제로 실렸는지는 이 CREATE
    // TABLE 이 통과하는 것 자체로 검증된다 — 부모 테이블이 없으면 실패한다.
    finder_repo.create_table().await.unwrap();

    let user = FdUser { id: Uuid::nil() }.create().await.unwrap();
    FdPkFinder {
        user_id: user.id,
        title: "hello".into(),
    }
    .create()
    .await
    .unwrap();

    // ── pk 컬럼은 unique 하므로 find_by_user 는 최대 1행만 매치한다 ──
    let pk_page = FdPkFinder::find_by_user(user.id).await.unwrap();
    assert_eq!(
        pk_page.items.len(),
        1,
        "pk column is unique — exactly one row matches"
    );
    assert_eq!(pk_page.total_count, 1);
    assert_eq!(pk_page.items[0].user_id, user.id);
    assert_eq!(pk_page.items[0].title, "hello");

    // ── 매치되지 않는 값 → 에러가 아니라 빈 Page ──
    let missing = FdPkFinder::find_by_user(Uuid::now_v7()).await.unwrap();
    assert_eq!(missing.items.len(), 0);
    assert_eq!(missing.total_count, 0);

    finder_repo.drop_table().await.unwrap();
    user_repo.drop_table().await.unwrap();
}
