//! Task 9 — `#[derive(PostgresEntity)]` 스칼라 컬럼 CRUD 왕복.
//!
//! `manual_entity.rs`(Task 7)의 시나리오를 derive 구조체로 재작성한 판이다. 추가로
//! enum 컬럼(`role: TRole2` — `create_table()` 이 enum 타입을 먼저 만드는지 dependency),
//! Option 컬럼(`nickname: Option<String>` — nullable 왕복 NULL/값), 그리고 pk attribute
//! 없이 `id` 필드 자동 인식(`#[postgres(pk)]` 없이 pk 추론)을 함께 검증한다.
#![allow(dead_code)]

mod common;

use postgres::ops::{BoolOp, NumOp, StringOp};
use postgres::uuid::Uuid;
use postgres::{BoolCol, OrdCol, Order, PostgresEntity, PostgresEnum, Tx};

/// native PG enum 컬럼 저장 — derive 가 dependency_ddl 을 자동 수집하는지 검증용.
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum TRole2 {
    #[default]
    Owner,
    Admin,
    #[postgres(rename = "member_x")]
    Member,
}

/// 스칼라 6개: pk uuid(attr 없이 자동 인식) / text / bigint / boolean / enum / nullable text.
#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
#[postgres(table = "d_users")]
pub struct DUser {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
    pub role: TRole2,
    pub nickname: Option<String>,
}

#[tokio::test]
async fn derive_entity_crud_roundtrip() {
    common::pool().await; // 전역 풀 시딩 (first-wins)
    let repo = DUser::repository();
    repo.drop_table().await.ok();
    // enum 타입(t_role2)이 테이블보다 먼저 만들어져야 아래 enum insert 가 성공한다.
    repo.create_table().await.unwrap();

    // enum 컬럼이 쿼팅된 (prefix 반영) 타입명으로 렌더되는지 — SqlType::Enum(to_sql) 경로 검증
    let ddl = <DUser as postgres::PostgresObject>::ddl();
    let expected_ty = format!("\"{}\"", <TRole2 as postgres::PostgresObject>::name());
    assert!(
        ddl.create[0].contains(&expected_ty),
        "CREATE TABLE must reference the quoted enum type: {}",
        ddl.create[0]
    );

    // ── insert: nil uuid → v7 채번, Option 은 None(NULL) ──
    let u = DUser {
        id: Uuid::nil(),
        name: "hackartist".into(),
        age: 40,
        agreed: true,
        role: TRole2::Member,
        nickname: None,
    };
    let saved = repo.insert(&u).await.unwrap();
    assert!(!saved.id.is_nil());
    assert_eq!(saved.role, TRole2::Member);
    assert_eq!(saved.nickname, None);

    // ── get ──
    let got = repo.get(saved.id).await.unwrap().unwrap();
    assert_eq!(got.name, "hackartist");
    assert_eq!(got.role, TRole2::Member);

    // ── 빈 업데이트 가드 ──
    assert!(matches!(
        repo.update(saved.id, DUser::update()).await,
        Err(postgres::Error::Schema(_))
    ));

    // ── find: StringOp(|) 연산자 + filter(OrdCol & BoolCol) + order_by ──
    let found = repo
        .find(
            DUser::query()
                .name(StringOp::StartsWith("hack") | StringOp::EndsWith("zzz"))
                .filter(|c| c.age.gte(20) & c.agreed.eq(true))
                .order_by(DUserColumn::Age, Order::Desc),
        )
        .await
        .unwrap();
    assert_eq!(found.items.len(), 1);
    assert_eq!(found.total_count, 1);

    // ── find: 직접 빌더(age/agreed/limit/offset/order_by) 표면 — 매칭 0건 ──
    let none = repo
        .find(
            DUser::query()
                .age(NumOp::Lt(0))
                .agreed(BoolOp::Eq(false))
                .order_by(DUserColumn::Name, Order::Asc)
                .limit(10)
                .offset(0),
        )
        .await
        .unwrap();
    assert!(none.items.is_empty());
    assert_eq!(none.total_count, 0);

    // ── update … RETURNING explicit columns: enum 세팅 + Option Some 세팅 ──
    let updated = repo
        .update(
            saved.id,
            DUser::update()
                .name("renamed")
                .age(41)
                .agreed(false)
                .role(TRole2::Owner)
                .nickname(Some("nick".to_string())),
        )
        .await
        .unwrap();
    assert_eq!(
        (updated.name.as_str(), updated.age, updated.agreed),
        ("renamed", 41, false)
    );
    assert_eq!(updated.role, TRole2::Owner);
    assert_eq!(updated.nickname.as_deref(), Some("nick"));

    // ── Update Option None → NULL ──
    let nulled = repo
        .update(saved.id, DUser::update().nickname(None))
        .await
        .unwrap();
    assert_eq!(nulled.nickname, None);

    // ── 트랜잭션: tx-bound repo, read-your-writes, commit ──
    let tx = Tx::begin().await.unwrap();
    let tx_repo = repo.with_tx(&tx);
    tx_repo.delete(saved.id).await.unwrap();
    assert!(tx_repo.get(saved.id).await.unwrap().is_none());
    tx.commit().await.unwrap();
    assert!(repo.get(saved.id).await.unwrap().is_none());

    repo.drop_table().await.unwrap();
}
