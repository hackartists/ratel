//! Task 13 — `Schema` 부트스트랩 헬퍼.
//!
//! `Schema::new().register::<T>()...` 로 여러 엔티티를 등록해 두면, `.create()` 한
//! 호출로 (1) 전 엔트리의 enum dependency(문자열 dedupe) → (2) 테이블(등록순)
//! → (3) 전 엔트리의 조인테이블(문자열 dedupe) 순으로 부트스트랩하고, `.drop()` 은
//! 정확히 역순으로 정리한다. `many_to_many.rs` 의 `.ok()` 두 단계 부트스트랩(상대
//! 테이블이 아직 없어 조인 생성이 실패하는 것을 감수하고 넘어가던 스멜)을 대체한다.
#![allow(dead_code)]

mod common;

use std::sync::LazyLock;

use postgres::sqlx::Row;
use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresEnum, PostgresObject, Schema, UuidCol};

/// native PG enum — `SUser.role` / `SPost.status` 두 테이블이 공유해, enum DDL
/// dedupe(문자열 기준)를 실행 경로에서 검증한다.
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum SRole {
    #[default]
    Member,
    Admin,
}

/// 이 파일의 테스트들은 같은 DB 를 DDL 로 만들고 부수므로 서로 겹치면 안 된다.
/// 테스트 스레드 수를 CI 명령에서 제한하는 대신 여기서만 직렬화한다.
static DB_SERIAL: LazyLock<tokio::sync::Mutex<()>> = LazyLock::new(|| tokio::sync::Mutex::new(()));

/// FK 의존 없음 — 등록 1순위.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_users")]
pub struct SUser {
    pub id: Uuid,
    pub name: String,
    pub role: SRole,
}

/// `author` 가 `s_users` 를 FK 참조 — `s_users` 보다 뒤에 등록해야 한다.
/// `status` 도 `SRole` 을 써서 enum dedupe 대상을 두 테이블로 만든다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_posts")]
pub struct SPost {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub author: SUser, // fk col "author_id" REFERENCES s_users(id)
    pub title: String,
    pub status: SRole,
}

/// m2m 을 **단방향**으로만 선언(반대편 `SPost` 는 `tags` 필드를 선언하지 않는다) —
/// 조인테이블 이름 유도는 어느 한쪽 선언만으로도 결정된다(정렬된 base_name 결합).
/// 조인테이블은 `s_posts`/`s_tags` 모두를 FK 로 참조하므로, 등록순상 두 테이블이
/// 이미 생성된 뒤(phase 2 종료 후 phase 3)에 만들어져야 한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "s_tags")]
pub struct STag {
    pub id: Uuid,
    pub name: String,
    #[postgres(many_to_many)]
    pub posts: Vec<SPost>,
}

fn schema() -> Schema {
    // 등록순 = FK 의존순: SUser(무의존) → SPost(→ s_users) → STag(조인테이블은 phase 3).
    Schema::new()
        .register::<SUser>()
        .register::<SPost>()
        .register::<STag>()
}

#[tokio::test]
async fn schema_create_bootstraps_everything_in_order() {
    let _serial = DB_SERIAL.lock().await;
    let pool = common::pool().await;
    let schema = schema();

    // ── clean slate (이전 실행 잔재 정리) ──
    schema.drop(&pool).await.ok();

    // ── 단일 create() 호출로 enum + 세 테이블 + 조인테이블까지 전부 안착 ──
    schema.create(&pool).await.unwrap();

    // ── SRole 은 SUser.role / SPost.status 두 엔트리가 공유하는 enum dependency —
    // dedupe 가 없었다면(또는 깨졌다면) 두 번째 CREATE TYPE 이 재실행되었을 텐데,
    // 이전에는 "에러 없이 통과했다"는 사실만으로 통과하는 테스트였다(DO 블록의
    // `duplicate_object` 흡수가 idempotent 라 dedupe 여부와 무관하게 에러가 안 남).
    // 여기서는 실제 카탈로그 상태를 질의해 `SRole` 타입이 정확히 한 번만 존재하는지
    // 직접 확인한다.
    let srole_type_name = <SRole as PostgresObject>::name();
    let srole_count: i64 = sqlx::query("SELECT count(*)::int8 FROM pg_type WHERE typname = $1")
        .bind(srole_type_name)
        .fetch_one(&pool)
        .await
        .unwrap()
        .try_get(0)
        .unwrap();
    assert_eq!(
        srole_count, 1,
        "SRole must exist exactly once in pg_type after create(), got {srole_count}"
    );

    let user_repo = SUser::repository();
    let post_repo = SPost::repository();
    let tag_repo = STag::repository();

    // ── seed: FK/조인 모두 즉시 사용 가능해야 한다 ──
    let alice = user_repo
        .insert(&SUser {
            id: Uuid::nil(),
            name: "alice".into(),
            role: SRole::Admin,
        })
        .await
        .unwrap();

    let post = post_repo
        .insert(&SPost {
            id: Uuid::nil(),
            author: alice.clone(),
            title: "hello".into(),
            status: SRole::Member,
        })
        .await
        .unwrap();

    let tag = tag_repo
        .insert(&STag {
            id: Uuid::nil(),
            name: "rust".into(),
            posts: vec![],
        })
        .await
        .unwrap();

    // 조인테이블이 create() 한 번으로 이미 만들어져 있어야 attach 가 바로 동작한다
    // (many_to_many.rs 가 겪던 "상대 테이블 없음" 두 단계 문제가 없다는 증거).
    tag_repo.attach_posts(tag.id, post.id).await.unwrap();
    let reloaded = tag_repo
        .find_one(STag::query().filter(|q| q.id.eq(tag.id)).with_posts())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(reloaded.posts.len(), 1);
    assert_eq!(reloaded.posts[0].title, "hello");

    // ── idempotent: 재실행이 에러 없이 통과해야 한다 (enum/테이블/조인 모두) ──
    schema.create(&pool).await.unwrap();

    // ── drop(): 정확히 역순 — 재실행해도 깨끗해야 한다 ──
    schema.drop(&pool).await.unwrap();

    // ── drop 이후 재-create 가 다시 가능해야 한다(깨끗하게 정리되었다는 증거) ──
    schema.create(&pool).await.unwrap();
    schema.drop(&pool).await.unwrap();
}
