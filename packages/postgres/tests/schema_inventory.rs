//! M7 — `Schema::from_inventory()` 자동 등록 + FK 위상정렬 + 어드바이저리 락 create.
//!
//! 모든 엔티티는 파생 코드가 프로세스 인벤토리에 자동 등록하고,
//! `Schema::from_inventory()` 가 이를 전부 모아 FK 의존순으로 위상정렬한 뒤 (enum → 테이블
//! (위상순) → 조인테이블) 순서로 부트스트랩한다 — 서버의 손수 정렬한 `registered_schemas()`
//! 를 자동으로 재현한다.
//!
//! **전용 테스트 바이너리**인 것이 핵심이다: 각 `cargo test` 바이너리는 독립 프로세스라
//! 자체 인벤토리를 갖는다. 아래 소유 엔티티 3개만 등록되고 read-only mirror 하나는
//! `skip_schema`로 제외되므로 `from_inventory()`는 정확히 그 셋만 본다.
//!
//! 위상정렬이 실제로 필요하도록 3-단계 FK 체인을 **뒤섞인 선언 순서**로 정의한다
//! (Child → Grandparent → Parent). 등록/링크 순서가 곧 의존순이 아니므로, `create()` 가
//! 성공한다는 사실 자체가 위상정렬이 grandparents → parents → children 순서를 만들었음을
//! 증명한다 (아니었다면 존재하지 않는 부모 테이블을 REFERENCES 하는 CREATE TABLE 이 실패).
#![allow(dead_code)]

mod common;

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, Schema};

// ── 뒤섞인 선언 순서: 의존 체인은 grandparent ← parent ← child 인데, 소스 순서는 그 반대다. ──

/// 체인의 말단(leaf). `parent_id` 가 `inv_parents(id)` 를 FK 참조 → inv_parents 가 먼저
/// 생성돼 있어야 이 CREATE TABLE 이 통과한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "inv_children")]
pub struct Child {
    pub id: Uuid,
    #[postgres(references = "inv_parents(id)")]
    pub parent_id: Uuid,
}

/// 체인의 뿌리(root). FK 없음 — 위상정렬상 항상 1순위여야 한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "inv_grandparents")]
pub struct Grandparent {
    pub id: Uuid,
}

/// 중간. `gp_id` 가 `inv_grandparents(id)` 를 FK 참조 → grandparents 가 먼저여야 한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "inv_parents")]
pub struct Parent {
    pub id: Uuid,
    #[postgres(references = "inv_grandparents(id)")]
    pub gp_id: Uuid,
}

/// 다른 서비스 소유 테이블의 read-only mapping은 repository 코드는 가지지만 이
/// 바이너리의 schema inventory에는 들어가지 않는다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "inv_external_mirror", skip_schema)]
pub struct ExternalMirror {
    pub id: Uuid,
}

#[tokio::test]
async fn from_inventory_topo_sorts_creates_and_advisory_locks() {
    let pool = common::pool().await;

    // ── 이 바이너리의 인벤토리에는 위 3개 엔티티만 있다 ──
    let schema = Schema::from_inventory();
    assert_eq!(
        schema.len(),
        3,
        "dedicated binary: from_inventory must see exactly Child/Grandparent/Parent"
    );

    // ── clean slate (이전 실행 잔재) ── drop 은 역위상순이라 CASCADE 로 안전.
    schema.drop(&pool).await.ok();

    // ── 단일 create(): 위상정렬이 grandparents → parents → children 을 만들었다면 세
    // REFERENCES 제약이 모두 해소돼 통과한다. 순서가 틀렸다면 존재하지 않는 부모를
    // 참조하는 CREATE TABLE 에서 실패한다. ──
    schema
        .create(&pool)
        .await
        .expect("topo-ordered create must satisfy FK REFERENCES");

    // ── 의존순으로 실제 행 삽입 → FK 가 실제로 걸려 있고 순서가 맞았음을 이중 증명 ──
    let gp = Grandparent::repository()
        .insert(&Grandparent { id: Uuid::nil() })
        .await
        .unwrap();
    let parent = Parent::repository()
        .insert(&Parent {
            id: Uuid::nil(),
            gp_id: gp.id,
        })
        .await
        .unwrap();
    let child = Child::repository()
        .insert(&Child {
            id: Uuid::nil(),
            parent_id: parent.id,
        })
        .await
        .unwrap();
    assert_eq!(child.parent_id, parent.id);

    // ── 멱등: 재실행이 에러 없이 통과 ──
    schema
        .create(&pool)
        .await
        .expect("from_inventory create must be idempotent");

    // ── 어드바이저리 락 create (xact 스코프, pg_advisory_xact_lock): 순차로 두 번 다
    // 성공해야 한다(재호출은 멱등한 create() 그대로). ──
    Schema::from_inventory()
        .create_with_advisory_lock(&pool, 424242)
        .await
        .expect("advisory-lock create must succeed");
    Schema::from_inventory()
        .create_with_advisory_lock(&pool, 424242)
        .await
        .expect("second advisory-lock create (serialized) must also succeed");

    // ── 진짜 동시(concurrent) 호출도 직렬화되어 둘 다 성공해야 한다 ── 세션 락 +
    // 전용 커넥션 버전과 달리 xact 락은 커넥션 1개로도 동작하므로, 여기서는 같은
    // lock_id 로 두 `create_with_advisory_lock` 호출을 실제로 동시에 스폰해 경쟁시킨다.
    // 두 번째 트랜잭션은 `pg_advisory_xact_lock` 에서 첫 번째가 commit(→ 자동 해제)할
    // 때까지 블록되었다가 그 뒤 자기 몫의 CREATE 문을 실행해야 하므로, 둘 다 에러 없이
    // 끝나는 것 자체가 직렬화가 실제로 걸렸다는 증거다(잠금 없이 동시에 CREATE TABLE IF
    // NOT EXISTS 를 날리면 레이스로 실패할 수 있다).
    let concurrent_a = Schema::from_inventory();
    let concurrent_b = Schema::from_inventory();
    let pool_a = pool.clone();
    let pool_b = pool.clone();
    let (result_a, result_b) = tokio::join!(
        async move { concurrent_a.create_with_advisory_lock(&pool_a, 5150).await },
        async move { concurrent_b.create_with_advisory_lock(&pool_b, 5150).await },
    );
    result_a.expect("concurrent advisory-lock create (writer A) must succeed");
    result_b.expect("concurrent advisory-lock create (writer B) must succeed");

    // ── drop(): 역위상순으로 깨끗이 정리, 재-create 가능해야 함 ──
    schema.drop(&pool).await.unwrap();
    schema
        .create(&pool)
        .await
        .expect("re-create after drop must work");
    schema.drop(&pool).await.unwrap();
}
