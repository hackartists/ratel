//! Task 9 — `#[derive(PostgresEntity)]` 쿼리 빌더 표면 검증.
//!
//! 컬럼별 Op 진입점(연산자·combinator) / `filter`(is-null 포함) / 다중 `order_by` /
//! `limit`·`offset` / enum 필터, 그리고 `Update` 의 Some·None 세터를 라이브 PostgreSQL
//! 왕복으로 증명한다. `crud.rs` 와 다른 테이블·enum 타입을 써서 병렬 실행 시 간섭이 없다.
//!
//! M1 — `find` 가 반환하는 `Page<T>` 의 페이지네이션(`page`/`page_size`/`total_count`/
//! `total_pages`) + `count(&query)` 를 별도 테이블(`d_page_users`)로 검증한다.
#![allow(dead_code)]

mod common;

use postgres::ops::{EnumOp, NumOp, StringOp};
use postgres::uuid::Uuid;
use postgres::{BoolCol, EnumCol, OrdCol, Order, PostgresEntity, PostgresEnum, StringCol};

#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum QRole {
    #[default]
    Owner,
    Admin,
    Member,
}

#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
#[postgres(table = "d_query_users")]
pub struct QUser {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
    pub role: QRole,
    pub nickname: Option<String>,
}

#[tokio::test]
async fn derive_entity_query_surface() {
    // 다중 #[tokio::test] 바이너리 — 각 테스트는 자기 런타임에 묶인 풀을 써야 하므로
    // (프로세스 전역 풀은 첫 런타임에 고정된다) 명시적 풀 escape hatch 를 쓴다.
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<QUser>::new(pool);
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // seed 4 rows
    for (n, age, agreed, role, nick) in [
        ("alice", 30_i64, true, QRole::Owner, Some("al")),
        ("alex", 25, true, QRole::Admin, None),
        ("bob", 40, false, QRole::Member, Some("bobby")),
        ("carol", 22, true, QRole::Member, None),
    ] {
        repo.insert(&QUser {
            id: Uuid::nil(),
            name: n.into(),
            age,
            agreed,
            role,
            nickname: nick.map(str::to_string),
        })
        .await
        .unwrap();
    }

    // 연산자: name starts_with "al" → alice, alex
    let r = repo
        .find(QUser::query().name(StringOp::StartsWith("al")))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // combinator: starts_with "al" | eq "bob" → alice, alex, bob
    let r = repo
        .find(QUser::query().name(StringOp::StartsWith("al") | StringOp::Eq("bob")))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 3);

    // filter: age >= 30 & agreed = true → alice
    let r = repo
        .find(QUser::query().filter(|c| c.age.gte(30) & c.agreed.eq(true)))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 1);
    assert_eq!(r[0].name, "alice");

    // is_null: nickname IS NULL → alex, carol
    let r = repo
        .find(QUser::query().filter(|c| c.nickname.is_null()))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // is_not_null → alice, bob
    let r = repo
        .find(QUser::query().filter(|c| c.nickname.is_not_null()))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // 다중 정렬: agreed ASC, age DESC → bob(false), alice30, alex25, carol22
    let r = repo
        .find(
            QUser::query()
                .order_by(QUserColumn::Agreed, Order::Asc)
                .order_by(QUserColumn::Age, Order::Desc),
        )
        .await
        .unwrap()
        .items;
    let names: Vec<&str> = r.iter().map(|u| u.name.as_str()).collect();
    assert_eq!(names, vec!["bob", "alice", "alex", "carol"]);

    // limit/offset: age DESC [bob40, alice30, alex25, carol22], offset1 limit2 → alice, alex
    let r = repo
        .find(
            QUser::query()
                .order_by(QUserColumn::Age, Order::Desc)
                .limit(2)
                .offset(1),
        )
        .await
        .unwrap()
        .items;
    let names: Vec<&str> = r.iter().map(|u| u.name.as_str()).collect();
    assert_eq!(names, vec!["alice", "alex"]);

    // enum 필터: role = Member → bob, carol
    let r = repo
        .find(QUser::query().role(EnumOp::Eq(QRole::Member)))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // num 연산자: age < 26 → alex25, carol22
    let r = repo
        .find(QUser::query().age(NumOp::Lt(26)))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // filter 크로스컬럼 OR (StringCol | EnumCol): name = "bob" OR role = Owner → bob, alice
    let r = repo
        .find(QUser::query().filter(|c| c.name.eq("bob") | c.role.eq(QRole::Owner)))
        .await
        .unwrap()
        .items;
    assert_eq!(r.len(), 2);

    // Update Some/None 세터 — 특정 행 대상
    let alice = repo
        .find_one(QUser::query().name(StringOp::Eq("alice")))
        .await
        .unwrap()
        .unwrap();
    let up = repo
        .update(alice.id, QUser::update().nickname(None))
        .await
        .unwrap();
    assert_eq!(up.nickname, None);
    let up = repo
        .update(
            alice.id,
            QUser::update().nickname(Some("ALICE".to_string())).age(31),
        )
        .await
        .unwrap();
    assert_eq!(up.nickname.as_deref(), Some("ALICE"));
    assert_eq!(up.age, 31);

    repo.drop_table().await.unwrap();
}

/// M1 페이지네이션 전용 엔티티 — 결정적 정렬을 위해 정수 컬럼 `n` 을 둔다.
#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
#[postgres(table = "d_page_users")]
pub struct PUser {
    pub id: Uuid,
    pub name: String,
    pub n: i64,
    pub active: bool,
}

#[tokio::test]
async fn find_returns_paginated_page() {
    let pool = common::pool().await;
    let repo = postgres::PostgresRepository::<PUser>::new(pool);
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // seed 5 rows: n = 1..=5, active for n <= 3 (→ 3 active, 2 inactive).
    for n in 1..=5_i64 {
        repo.insert(&PUser {
            id: Uuid::nil(),
            name: format!("u{n}"),
            n,
            active: n <= 3,
        })
        .await
        .unwrap();
    }

    // ── page 1, page_size 2 (order by n ASC) → [u1, u2] ──
    let p = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(1),
        )
        .await
        .unwrap();
    assert_eq!(p.items.len(), 2);
    assert_eq!(p.items.iter().map(|u| u.n).collect::<Vec<_>>(), vec![1, 2]);
    assert_eq!(p.total_count, 5);
    assert_eq!(p.total_pages, 3); // ceil(5/2)
    assert_eq!(p.page, 1);
    assert_eq!(p.page_size, 2);

    // ── page 2 → next 2 items [u3, u4] ──
    let p = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(2),
        )
        .await
        .unwrap();
    assert_eq!(p.items.iter().map(|u| u.n).collect::<Vec<_>>(), vec![3, 4]);
    assert_eq!(p.page, 2);
    assert_eq!(p.total_count, 5);
    assert_eq!(p.total_pages, 3);

    // ── page past the end → empty items, but total_count still the real total ──
    let p = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(4), // offset = 6, beyond 5 rows
        )
        .await
        .unwrap();
    assert!(p.items.is_empty());
    assert_eq!(p.total_count, 5); // count fallback (no rows to carry __total_count)
    assert_eq!(p.page, 4);
    assert_eq!(p.page_size, 2);
    assert_eq!(p.total_pages, 3);

    // ── unpaged find → all rows, page=1, page_size=total_count, total_pages=1 ──
    let p = repo
        .find(PUser::query().order_by(PUserColumn::N, Order::Asc))
        .await
        .unwrap();
    assert_eq!(p.items.len(), 5);
    assert_eq!(p.total_count, 5);
    assert_eq!(p.page, 1);
    assert_eq!(p.page_size, 5);
    assert_eq!(p.total_pages, 1);

    // ── count(&query) with a WHERE filter matches the filtered total ──
    let active_only = PUser::query().filter(|c| c.active.eq(true));
    assert_eq!(repo.count(&active_only).await.unwrap(), 3);

    // ── pagination + WHERE filter: total_count reflects the FILTERED total ──
    let p = repo
        .find(
            PUser::query()
                .filter(|c| c.active.eq(true))
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(1),
        )
        .await
        .unwrap();
    assert_eq!(p.items.len(), 2); // page cap
    assert_eq!(p.total_count, 3); // COUNT(*) OVER() respects WHERE
    assert_eq!(p.total_pages, 2); // ceil(3/2)
    assert_eq!(p.items.iter().map(|u| u.n).collect::<Vec<_>>(), vec![1, 2]);

    // ── precedence: page_size wins over a raw limit set on the same query ──
    let p = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .limit(99),
        )
        .await
        .unwrap();
    assert_eq!(p.items.len(), 2); // page_size(2), not limit(99)
    assert_eq!(p.items.iter().map(|u| u.n).collect::<Vec<_>>(), vec![1, 2]);

    // ── page(0) is clamped to page 1, not a negative-OFFSET SQL error ──
    let clamped = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(0),
        )
        .await
        .unwrap();
    let page_one = repo
        .find(
            PUser::query()
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(2)
                .page(1),
        )
        .await
        .unwrap();
    assert_eq!(clamped.items.len(), 2);
    assert_eq!(
        clamped.items.iter().map(|u| u.n).collect::<Vec<_>>(),
        page_one.items.iter().map(|u| u.n).collect::<Vec<_>>()
    );

    // ── find_one on a query carrying page_size must not double-append LIMIT 1 ──
    let one = repo
        .find_one(
            PUser::query()
                .filter(|c| c.active.eq(true))
                .order_by(PUserColumn::N, Order::Asc)
                .page_size(5),
        )
        .await
        .unwrap();
    assert!(one.is_some());
    assert_eq!(one.unwrap().n, 1); // first active row by n ASC

    repo.drop_table().await.unwrap();
}
