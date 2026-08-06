//! Task 10 — `#[derive(PostgresEntity)]` 소유 관계(one_to_one / many_to_one).
//!
//! FK 컬럼 합성(`{field}_id` 기본 / `foreign_key` override / `type`+`reference_key` 커스텀),
//! `relations()` 발 REFERENCES·UNIQUE DDL, `RelationRef::fk_value` 바인딩(pk/custom),
//! eager hydrate(`with_*` 배치 2차 쿼리), None LEFT-semantics, lazy 로더(`load_*`),
//! `{N}Update` FK 세터를 라이브 PostgreSQL 왕복으로 증명한다.
#![allow(dead_code)]

mod common;

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresObject, UuidCol};

/// 참조 대상(pk-side). email 은 UNIQUE — owner_email FK 가 이 컬럼을 참조한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r1_users")]
pub struct RUser {
    pub id: Uuid,
    #[postgres(unique)]
    pub email: String,
    pub name: String,
}

/// 소유(FK-side). `user` 는 pk 참조(NOT NULL), `owner` 는 email 참조(nullable + UNIQUE).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r1_orders")]
pub struct ROrder {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub user: RUser, // fk col "user_id"
    #[postgres(
        one_to_one,
        foreign_key = "owner_email",
        type = "TEXT",
        reference_key = "email"
    )]
    pub owner: Option<RUser>, // nullable + UNIQUE, references r1_users(email)
    pub total: i64,
}

#[tokio::test]
async fn relation_to_one_roundtrip() {
    let pool = common::pool().await;
    let user_repo = RUser::repository();
    let order_repo = ROrder::repository();

    // FK 의존: order → user. drop 은 order 먼저, create 는 user 먼저.
    order_repo.drop_table().await.ok();
    user_repo.drop_table().await.ok();
    user_repo.create_table().await.unwrap();
    order_repo.create_table().await.unwrap();

    // ── DDL: relations() 에서 유도된 FK 제약 + nullability + UNIQUE ──
    let users = <RUser as PostgresObject>::name();
    let ddl = <ROrder as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains(&format!(
            "\"user_id\" UUID NOT NULL REFERENCES \"{users}\"(\"id\")"
        )),
        "user_id FK DDL missing: {create}"
    );
    assert!(
        create.contains(&format!(
            "\"owner_email\" TEXT UNIQUE REFERENCES \"{users}\"(\"email\")"
        )),
        "owner_email FK DDL missing: {create}"
    );

    // ── seed users ──
    let alice = user_repo
        .insert(&RUser {
            id: Uuid::nil(),
            email: "alice@x.com".into(),
            name: "Alice".into(),
        })
        .await
        .unwrap();
    let bob = user_repo
        .insert(&RUser {
            id: Uuid::nil(),
            email: "bob@x.com".into(),
            name: "Bob".into(),
        })
        .await
        .unwrap();

    // ── insert order: user = alice (FK 바인딩), owner = None (NULL) ──
    let saved = order_repo
        .insert(&ROrder {
            id: Uuid::nil(),
            user: alice.clone(),
            owner: None,
            total: 100,
        })
        .await
        .unwrap();
    assert!(!saved.id.is_nil());
    // insert 는 관계를 hydrate 하지 않는다 — 필드는 Default.
    assert_eq!(saved.user.name, "");
    assert!(saved.owner.is_none());

    // ── insert order: user = bob, owner = Some(alice) (email 참조) ──
    let saved2 = order_repo
        .insert(&ROrder {
            id: Uuid::nil(),
            user: bob.clone(),
            owner: Some(alice.clone()),
            total: 200,
        })
        .await
        .unwrap();

    // ── raw: FK 컬럼 실제 값 (pk 바인딩 + reference_key 바인딩 증명) ──
    let ot = <ROrder as PostgresObject>::name();
    let uid_row: (Uuid,) =
        postgres::sqlx::query_as(&format!("SELECT user_id FROM \"{ot}\" WHERE id = $1"))
            .bind(saved.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(uid_row.0, alice.id, "user_id must bind alice's pk");

    let owner_null: (Option<String>,) =
        postgres::sqlx::query_as(&format!("SELECT owner_email FROM \"{ot}\" WHERE id = $1"))
            .bind(saved.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(owner_null.0, None, "owner None → owner_email NULL");

    let owner_email: (Option<String>,) =
        postgres::sqlx::query_as(&format!("SELECT owner_email FROM \"{ot}\" WHERE id = $1"))
            .bind(saved2.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(
        owner_email.0.as_deref(),
        Some("alice@x.com"),
        "reference_key = email → owner_email holds the email string"
    );

    // ── eager: with_user() 배치 hydrate ──
    let orders = order_repo
        .find(ROrder::query().with_user())
        .await
        .unwrap()
        .items;
    let so = orders.iter().find(|o| o.id == saved.id).unwrap();
    assert_eq!(so.user.name, "Alice");
    let so2 = orders.iter().find(|o| o.id == saved2.id).unwrap();
    assert_eq!(so2.user.name, "Bob");

    // ── eager: with_owner() — None 은 LEFT-semantics 로 그대로 None ──
    let orders = order_repo
        .find(ROrder::query().with_owner())
        .await
        .unwrap()
        .items;
    let so = orders.iter().find(|o| o.id == saved.id).unwrap();
    assert!(so.owner.is_none(), "no join match → owner stays None");
    let so2 = orders.iter().find(|o| o.id == saved2.id).unwrap();
    assert_eq!(
        so2.owner.as_ref().unwrap().name,
        "Alice",
        "owner loaded via email reference_key"
    );

    // ── lazy 로더: get 은 관계 미로딩, load_user 로 채운다 ──
    let mut ord = order_repo.get(saved.id).await.unwrap().unwrap();
    assert_eq!(ord.user.name, "");
    ord.load_user(&order_repo).await.unwrap();
    assert_eq!(ord.user.name, "Alice");

    // ── Update FK 세터: user_id 재지정 → 재로딩으로 확인 ──
    // `user` 는 기본 reference(FK → target PK, Uuid)라서 `{Update}::user_id(Uuid)` 가
    // 생성된다. `owner` 는 custom `reference_key = "email"` 관계라 FK 컬럼("owner_email")의
    // 러스트 타입을 매크로가 추론할 수 없으므로 `{Update}` 에 `owner_email(...)` 세터가
    // 애초에 생성되지 않는다(런타임에 Uuid → TEXT 로 잘못 바인딩되던 버그의 수정) —
    // 그래서 여기서는 `user_id` 만 왕복 검증한다.
    order_repo
        .update(saved.id, ROrder::update().user_id(bob.id))
        .await
        .unwrap();
    let reloaded = order_repo
        .find_one(ROrder::query().filter(|c| c.id.eq(saved.id)).with_user())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(reloaded.user.name, "Bob", "user_id setter re-points FK");
    // total 은 그대로 (FK 세터만 바꿨다).
    assert_eq!(reloaded.total, 100);

    // ── cleanup ──
    order_repo.drop_table().await.unwrap();
    user_repo.drop_table().await.unwrap();
}
