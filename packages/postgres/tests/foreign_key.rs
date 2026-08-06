//! M4 — 스칼라 FK-only 어트리뷰트 (`references` / `foreign_key`).
//!
//! 스칼라 컬럼이 로드되는 관계 없이 FK 제약만 갖는 경우를 라이브 PostgreSQL 왕복으로
//! 증명한다: shorthand(`references = "table(col)"`, sibling `on_delete = "…"` 포함) +
//! full-form(`references(table=…, column=…, on_delete=…)`) 두 문법, `foreign_key`
//! 동의어, DDL REFERENCES 렌더, `ON DELETE CASCADE`/`ON DELETE SET NULL` 실제 적용,
//! nullable FK, 그리고 FK 컬럼이 그냥 스칼라라 일반 Query 메서드로 필터된다는 사실.
//! FK 컬럼은 관계가 아니므로 `with_*`/`load_*` 메서드가 생성되지 않는다(호출하지 않는
//! 것으로 컴파일 레벨에서 확인).
#![allow(dead_code)]

mod common;

use postgres::ops::UuidOp;
use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresObject};

// 각 테스트는 (테스트가 병렬 실행되므로) 서로 겹치지 않는 부모 테이블을 참조한다 —
// 같은 테이블을 여러 테스트가 동시에 create/drop 하면 pg_type 유니크 제약에서 레이스가 난다
// (relation_to_one 등 기존 테스트가 테이블명을 유니크하게 두는 것과 동일한 규약).

/// 참조 대상 (pk-side) — shorthand 테스트용.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents")]
pub struct FkParent {
    pub id: Uuid,
    pub name: String,
}

/// shorthand FK — `references = "fk_parents(id)"`. 스칼라 컬럼 `parent_id` 는 그대로
/// 스칼라이고, FK 제약(REFERENCES)만 얹는다. 로드되는 관계가 아니다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_children")]
pub struct FkChild {
    pub id: Uuid,
    #[postgres(references = "fk_parents(id)")]
    pub parent_id: Uuid,
    pub title: String,
}

/// 참조 대상 — CASCADE 테스트용 (별도 테이블).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents_c")]
pub struct FkParentC {
    pub id: Uuid,
    pub name: String,
}

/// full-form FK + `on_delete = "CASCADE"`.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_children2")]
pub struct FkChild2 {
    pub id: Uuid,
    #[postgres(references(table = "fk_parents_c", column = "id", on_delete = "CASCADE"))]
    pub parent_id: Uuid,
    pub title: String,
}

/// 참조 대상 — nullable 테스트용 (별도 테이블).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents_n")]
pub struct FkParentN {
    pub id: Uuid,
    pub name: String,
}

/// nullable FK — `Option<Uuid>`. 컬럼은 NULL 허용, FK 제약은 그대로. None → NULL.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_children3")]
pub struct FkChild3 {
    pub id: Uuid,
    #[postgres(references = "fk_parents_n(id)")]
    pub parent_id: Option<Uuid>,
    pub title: String,
}

/// 참조 대상 — shared-pk 테스트용 (별도 테이블).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents_pk")]
pub struct FkParentPk {
    pub id: Uuid,
    pub name: String,
}

/// pk 가 동시에 FK — asset-storage `#[pg(primary_key, foreign_key = "…")]` 대응.
/// `id` 는 PRIMARY KEY 이면서 부모를 참조하는 FK 다 (shared-pk 1:1 패턴).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_shared_pk")]
pub struct FkSharedPk {
    #[postgres(pk, references = "fk_parents_pk(id)")]
    pub id: Uuid,
    pub title: String,
}

#[tokio::test]
async fn scalar_fk_shorthand_roundtrip_and_query() {
    // 다중 #[tokio::test] 바이너리 — 각 테스트는 자기 런타임에 묶인 풀을 써야 하므로
    // (프로세스 전역 풀은 첫 런타임에 고정된다) 명시적 풀 escape hatch 를 쓴다.
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParent>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkChild>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: 스칼라 컬럼 + REFERENCES (관계발이 아니라 FK-only) ──
    let parents = <FkParent as PostgresObject>::name();
    let ddl = <FkChild as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains("\"parent_id\" UUID"),
        "parent_id must stay a scalar UUID column: {create}"
    );
    assert!(
        create.contains(&format!("REFERENCES \"{parents}\"(\"id\")")),
        "FK-only scalar must render REFERENCES: {create}"
    );
    // FK-only shorthand 은 ON DELETE 절이 없다.
    assert!(
        !create.contains("ON DELETE"),
        "shorthand FK has no ON DELETE clause: {create}"
    );

    // ── seed parent, insert child with parent_id (scalar binds itself) ──
    let p = parent_repo
        .insert(&FkParent {
            id: Uuid::nil(),
            name: "Parent".into(),
        })
        .await
        .unwrap();
    let c = child_repo
        .insert(&FkChild {
            id: Uuid::nil(),
            parent_id: p.id,
            title: "Child".into(),
        })
        .await
        .unwrap();
    assert!(!c.id.is_nil());

    // ── get back: scalar FK value round-trips ──
    let got = child_repo.get(c.id).await.unwrap().unwrap();
    assert_eq!(got.parent_id, p.id, "parent_id scalar must round-trip");

    // ── query by the FK column via the NORMAL scalar Query method ──
    let found = child_repo
        .find(FkChild::query().parent_id(UuidOp::Eq(p.id)))
        .await
        .unwrap()
        .items;
    assert_eq!(found.len(), 1);
    assert_eq!(found[0].id, c.id);

    // ── FK to a non-existent parent must violate the constraint ──
    let bad = child_repo
        .insert(&FkChild {
            id: Uuid::nil(),
            parent_id: Uuid::from_u128(0xDEAD_BEEF), // no such parent
            title: "Orphan".into(),
        })
        .await;
    assert!(
        bad.is_err(),
        "FK constraint must reject a dangling parent_id"
    );

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}

#[tokio::test]
async fn scalar_fk_on_delete_cascade() {
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParentC>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkChild2>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: ON DELETE CASCADE fragment present ──
    let ddl = <FkChild2 as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains("ON DELETE CASCADE"),
        "full-form FK must render ON DELETE CASCADE: {create}"
    );

    // ── seed + child, then DELETE parent → CASCADE removes child (enforced by PG) ──
    let p = parent_repo
        .insert(&FkParentC {
            id: Uuid::nil(),
            name: "P".into(),
        })
        .await
        .unwrap();
    let c = child_repo
        .insert(&FkChild2 {
            id: Uuid::nil(),
            parent_id: p.id,
            title: "C".into(),
        })
        .await
        .unwrap();
    assert!(child_repo.get(c.id).await.unwrap().is_some());

    parent_repo.delete(p.id).await.unwrap();
    assert!(
        child_repo.get(c.id).await.unwrap().is_none(),
        "ON DELETE CASCADE must remove the child when its parent is deleted"
    );

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}

#[tokio::test]
async fn scalar_fk_nullable() {
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParentN>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkChild3>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: nullable column (no NOT NULL) but FK still present ──
    let ddl = <FkChild3 as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains("\"parent_id\" UUID REFERENCES"),
        "nullable FK column must be REFERENCES without NOT NULL: {create}"
    );
    assert!(
        !create.contains("\"parent_id\" UUID NOT NULL"),
        "Option<Uuid> FK must not be NOT NULL: {create}"
    );

    // ── insert with None → NULL, no constraint violation ──
    let c = child_repo
        .insert(&FkChild3 {
            id: Uuid::nil(),
            parent_id: None,
            title: "NoParent".into(),
        })
        .await
        .unwrap();
    let got = child_repo.get(c.id).await.unwrap().unwrap();
    assert_eq!(got.parent_id, None, "None FK → NULL round-trips");

    // ── insert with Some(existing parent) also works ──
    let p = parent_repo
        .insert(&FkParentN {
            id: Uuid::nil(),
            name: "P".into(),
        })
        .await
        .unwrap();
    let c2 = child_repo
        .insert(&FkChild3 {
            id: Uuid::nil(),
            parent_id: Some(p.id),
            title: "HasParent".into(),
        })
        .await
        .unwrap();
    let got2 = child_repo.get(c2.id).await.unwrap().unwrap();
    assert_eq!(got2.parent_id, Some(p.id));

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}

/// 참조 대상 — `foreign_key` synonym + shorthand sibling `on_delete` 테스트용 (별도 테이블).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents_syn")]
pub struct FkParentSyn {
    pub id: Uuid,
    pub name: String,
}

/// `foreign_key` 동의어 shorthand + sibling `on_delete = "CASCADE"` (nested full-form이
/// 아니라 shorthand 옆에 나란히 놓인 키).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_children_syn")]
pub struct FkChildSyn {
    pub id: Uuid,
    #[postgres(foreign_key = "fk_parents_syn(id)", on_delete = "CASCADE")]
    pub parent_id: Uuid,
    pub title: String,
}

/// 참조 대상 — `references` shorthand + sibling `on_delete = "SET NULL"` 테스트용 (별도 테이블).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_parents_shd")]
pub struct FkParentShd {
    pub id: Uuid,
    pub name: String,
}

/// `references` shorthand + sibling `on_delete = "SET NULL"` — nullable FK.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "fk_children_shd")]
pub struct FkChildShd {
    pub id: Uuid,
    #[postgres(references = "fk_parents_shd(id)", on_delete = "SET NULL")]
    pub parent_id: Option<Uuid>,
    pub title: String,
}

#[tokio::test]
async fn scalar_fk_foreign_key_synonym_sibling_on_delete_cascade() {
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParentSyn>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkChildSyn>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: `foreign_key` synonym shorthand + sibling on_delete renders REFERENCES … ON DELETE CASCADE ──
    let parents = <FkParentSyn as PostgresObject>::name();
    let ddl = <FkChildSyn as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains(&format!("REFERENCES \"{parents}\"(\"id\")")),
        "foreign_key synonym must render REFERENCES: {create}"
    );
    assert!(
        create.contains("ON DELETE CASCADE"),
        "sibling on_delete alongside the foreign_key synonym must render ON DELETE CASCADE: {create}"
    );

    // ── live: CASCADE removes the child when its parent is deleted ──
    let p = parent_repo
        .insert(&FkParentSyn {
            id: Uuid::nil(),
            name: "P".into(),
        })
        .await
        .unwrap();
    let c = child_repo
        .insert(&FkChildSyn {
            id: Uuid::nil(),
            parent_id: p.id,
            title: "C".into(),
        })
        .await
        .unwrap();
    assert!(child_repo.get(c.id).await.unwrap().is_some());

    parent_repo.delete(p.id).await.unwrap();
    assert!(
        child_repo.get(c.id).await.unwrap().is_none(),
        "ON DELETE CASCADE via the foreign_key synonym + sibling on_delete must remove the child"
    );

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}

#[tokio::test]
async fn scalar_fk_shorthand_sibling_on_delete_set_null() {
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParentShd>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkChildShd>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: shorthand `references` + sibling on_delete renders ON DELETE SET NULL ──
    let ddl = <FkChildShd as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains("ON DELETE SET NULL"),
        "shorthand references + sibling on_delete must render ON DELETE SET NULL: {create}"
    );

    // ── live: deleting the parent nulls the child's FK; the child row survives ──
    let p = parent_repo
        .insert(&FkParentShd {
            id: Uuid::nil(),
            name: "P".into(),
        })
        .await
        .unwrap();
    let c = child_repo
        .insert(&FkChildShd {
            id: Uuid::nil(),
            parent_id: Some(p.id),
            title: "C".into(),
        })
        .await
        .unwrap();

    parent_repo.delete(p.id).await.unwrap();
    let got = child_repo
        .get(c.id)
        .await
        .unwrap()
        .expect("ON DELETE SET NULL must keep the child row alive");
    assert_eq!(
        got.parent_id, None,
        "ON DELETE SET NULL must null out the child's FK column"
    );

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}

#[tokio::test]
async fn scalar_fk_composes_with_pk() {
    let pool = common::pool().await;
    let parent_repo = postgres::PostgresRepository::<FkParentPk>::new(pool.clone());
    let child_repo = postgres::PostgresRepository::<FkSharedPk>::new(pool);

    child_repo.drop_table().await.ok();
    parent_repo.drop_table().await.ok();
    parent_repo.create_table().await.unwrap();
    child_repo.create_table().await.unwrap();

    // ── DDL: the pk column renders BOTH PRIMARY KEY and REFERENCES ──
    let parents = <FkParentPk as PostgresObject>::name();
    let ddl = <FkSharedPk as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        create.contains(&format!(
            "\"id\" UUID PRIMARY KEY REFERENCES \"{parents}\"(\"id\")"
        )),
        "pk+FK column must render PRIMARY KEY and REFERENCES together: {create}"
    );

    // ── live: child's pk == parent's pk (shared-pk); FK satisfied ──
    let p = parent_repo
        .insert(&FkParentPk {
            id: Uuid::nil(),
            name: "P".into(),
        })
        .await
        .unwrap();
    // id is non-nil → init_pk preserves it, so the child shares the parent's pk.
    let c = child_repo
        .insert(&FkSharedPk {
            id: p.id,
            title: "Shared".into(),
        })
        .await
        .unwrap();
    assert_eq!(c.id, p.id, "shared-pk child keeps the given pk");
    assert!(child_repo.get(p.id).await.unwrap().is_some());

    // ── a child pk that references no parent must be rejected by the FK ──
    let bad = child_repo
        .insert(&FkSharedPk {
            id: Uuid::from_u128(0xC0FFEE),
            title: "Orphan".into(),
        })
        .await;
    assert!(bad.is_err(), "pk+FK must still enforce the FK constraint");

    child_repo.drop_table().await.unwrap();
    parent_repo.drop_table().await.unwrap();
}
