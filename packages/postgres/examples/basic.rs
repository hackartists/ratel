//! `packages/postgres` end-to-end 예제 — `docs/postgres/spec.md`의 절들을 순서대로
//! 밟아본다. Task 1~14가 만든 표면(엔티티 derive 3종·CRUD·쿼리·관계·트랜잭션·
//! `Schema` 부트스트랩)을 하나의 시나리오로 이어 붙인 실행 가능한 문서다.
//!
//! 실행: `cargo run -p postgres --example basic` (PostgreSQL 필요 — `make pg` 또는
//! `DATABASE_URL` 로 접속 정보 지정, 미설정 시 `postgres://postgres@localhost:5432/postgres`
//! 폴백 — spec.md § "Testing & examples").
//!
//! 각 단계 주석은 spec.md 의 해당 절을 가리킨다. 실행 자체가 검증이 되도록 중간중간
//! `assert!`/`assert_eq!` 를 섞는다 — 패닉 없이 끝까지 돌면 그 API 표면이 실제로
//! 살아있다는 뜻이다.

use postgres::prelude::*;
use postgres::sqlx::postgres::PgPoolOptions;
use postgres::uuid::Uuid;
use serde::{Deserialize, Serialize};
use serde_json::json;

// ─────────────────────────────────────────────────────────────────────────
// spec.md § "`#[derive(PostgresEnum)]`" — native PG enum. 기본 저장은
// `CREATE TYPE … AS ENUM`, 라벨은 variant명 snake_case (`Owner` → "owner").
// `User` 가 `Default` 를 파생하므로(아래) `Role` 도 `Default`(+ `#[default]`)가
// 필요하다.
// ─────────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum Role {
    #[default]
    Owner,
    Admin,
    Member,
}

// ─────────────────────────────────────────────────────────────────────────
// spec.md § "`#[derive(PostgresJson)]`" — JSONB 컬럼으로 저장되는 구조체.
// attribute 불필요 — 엔티티 derive가 스칼라와 동일 경로로 다룬다. `User.budget`
// 필드 타입이라 `User: Default` 파생을 위해 `Amount` 도 `Default` 가 필요하다.
// ─────────────────────────────────────────────────────────────────────────
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize, PostgresJson)]
pub struct Amount {
    pub currency: String,
    pub value: f64,
}

// ─────────────────────────────────────────────────────────────────────────
// spec.md § "`#[derive(PostgresEntity)]`" + § "Relations" — 세 엔티티.
//
// `User.posts`(one_to_many)에 `foreign_key = "user_id"` 를 명시한 이유: 자식
// `Post.user`(many_to_one, 관례 기본값)가 만드는 실제 FK 컬럼명은
// `"{field}_id"` = "user_id" 다. 부모 쪽 `one_to_many` 기본 유도값은
// `"{self base_name}_id"` = "ex_users_id" 라 자식과 어긋나므로, 양쪽이 정확히
// 같은 컬럼을 가리키도록 여기서 정렬해 준다(관계_to_many 절 "동일 이름 정렬" 참조).
//
// `User.tags`(many_to_many)는 attribute 없이 전부 관례 기본값 — 조인테이블명은
// 정렬된 base_name 결합(`ex_tags`/`ex_users` 정렬)으로 유도되고, `Tag` 쪽은
// 미러 필드를 선언하지 않아도 된다(단방향 선언으로 충분 — schema.rs 의 `STag`
// 패턴과 동일).
// ─────────────────────────────────────────────────────────────────────────
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_users")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
    pub role: Role,
    pub budget: Amount,
    #[postgres(one_to_many, foreign_key = "user_id")]
    pub posts: Vec<Post>,
    #[postgres(many_to_many)]
    pub tags: Vec<Tag>,
}

/// 소유 측(many_to_one) — FK 컬럼 "user_id" UUID NOT NULL REFERENCES ex_users(id)
/// (관례 기본값: 컬럼명 = "{필드명}_id", 타입/참조는 `User::Pk`/PK 컬럼에서 유도).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_posts")]
pub struct Post {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub user: User,
    pub title: String,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_tags")]
pub struct Tag {
    pub id: Uuid,
    pub label: String,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    // ── 커넥션 풀 — spec.md § "Testing & examples": DATABASE_URL, 미설정 시 로컬
    // trust 인증 폴백 ──
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres@localhost:5432/postgres".into());
    let pool = PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await?;

    // 프로세스 전역 풀을 한 번 심는다(일차 API) — 이후 `X::repository()` / `Tx::begin()`
    // 은 인자 없이 이 풀을 쓴다. schema.create(&pool) 처럼 명시적 풀이 필요한 곳은
    // 반환 핸들 `pool` 을 그대로 쓴다(탈출구: PostgresRepository::new / Tx::begin_with).
    postgres::set_global_pool(pool.clone());

    let user_repo = User::repository();
    let post_repo = Post::repository();
    let tag_repo = Tag::repository();

    // ═══════════════════════════════════════════════════════════════════
    // 1) spec.md § "Schema 관리 — `postgres::Schema` 부트스트랩 헬퍼"
    //
    // 등록 순서 = FK 의존 순서: User(무의존) → Post(→ ex_users 참조) →
    // Tag(조인테이블은 phase 3, 두 본 테이블이 이미 있어야 함). enum(Role)/
    // json(Amount) 의존은 User 컬럼에서 자동 유도된다 — Schema 에 별도 등록 불필요.
    // ═══════════════════════════════════════════════════════════════════
    let schema = Schema::new()
        .register::<User>()
        .register::<Post>()
        .register::<Tag>();

    schema.drop(&pool).await.ok(); // 이전 실행 잔재 정리(없어도 무해 — idempotent)
    schema.create(&pool).await?;
    println!("[1] Schema::create() — ex_users/ex_posts/ex_tags + role enum + join table");

    // ═══════════════════════════════════════════════════════════════════
    // 2) spec.md § "PK 규칙" (nil Uuid → `insert()` 가 v7 채번) +
    //    § "Relations — many_to_many" (`attach_*` 로 조인테이블 링크 관리).
    // ═══════════════════════════════════════════════════════════════════
    let hackartist = user_repo
        .insert(&User {
            id: Uuid::nil(),
            name: "hackartist".into(),
            age: 33,
            agreed: true,
            role: Role::Owner,
            budget: Amount {
                currency: "USD".into(),
                value: 1000.0,
            },
            posts: vec![],
            tags: vec![],
        })
        .await?;
    assert!(
        !hackartist.id.is_nil(),
        "nil pk는 insert()가 v7으로 채번해야 한다"
    );
    println!(
        "[2] insert user hackartist → nil id 채번 → {}",
        hackartist.id
    );

    // 대조군: 이름이 "h"로 시작하지 않고, 통화도 USD가 아닌 행 — 3)의 쿼리들이
    // 실제로 걸러내는지 보여주는 노이즈.
    let other = user_repo
        .insert(&User {
            id: Uuid::nil(),
            name: "someone-else".into(),
            age: 15,
            agreed: false,
            role: Role::Member,
            budget: Amount {
                currency: "KRW".into(),
                value: 0.0,
            },
            posts: vec![],
            tags: vec![],
        })
        .await?;
    println!(
        "[2] insert user {} (control row, filtered out below)",
        other.name
    );

    let post1 = post_repo
        .insert(&Post {
            id: Uuid::nil(),
            user: hackartist.clone(),
            title: "hello postgres".into(),
        })
        .await?;
    let post2 = post_repo
        .insert(&Post {
            id: Uuid::nil(),
            user: hackartist.clone(),
            title: "derive first".into(),
        })
        .await?;
    println!(
        "[2] insert 2 posts for hackartist: \"{}\", \"{}\"",
        post1.title, post2.title
    );

    let rust_tag = tag_repo
        .insert(&Tag {
            id: Uuid::nil(),
            label: "rust".into(),
        })
        .await?;
    let db_tag = tag_repo
        .insert(&Tag {
            id: Uuid::nil(),
            label: "database".into(),
        })
        .await?;
    user_repo.attach_tags(hackartist.id, rust_tag.id).await?;
    user_repo.attach_tags(hackartist.id, db_tag.id).await?;
    println!(
        "[2] insert 2 tags (\"{}\", \"{}\") + attach both to hackartist",
        rust_tag.label, db_tag.label
    );

    // ═══════════════════════════════════════════════════════════════════
    // 3) spec.md § "생성되는 보조 타입 — `UserQuery`": 연산자 enum + `.filter()`
    //    (컬럼 간 OR) + eager 로딩(`with_*`, N+1 없는 배치 hydrate) + 다중 정렬.
    // ═══════════════════════════════════════════════════════════════════
    let found = user_repo
        .find(
            User::query()
                .name(StringOp::StartsWith("h"))
                .filter(|u| u.age.gte(20) | u.agreed.eq(true))
                .with_posts()
                .with_tags()
                .order_by(UserColumn::Age, Order::Desc),
        )
        .await?
        .items;
    assert_eq!(
        found.len(),
        1,
        "이름이 \"h\"로 시작하는 행은 hackartist 하나뿐"
    );
    let h = &found[0];
    assert_eq!(h.posts.len(), 2, "with_posts()는 배치 hydrate — N+1 없음");
    assert_eq!(h.tags.len(), 2, "with_tags()는 조인테이블 배치 hydrate");
    println!(
        "[3] query: name StartsWith(\"h\") & (age>=20 | agreed) → \"{}\" (posts={}, tags={})",
        h.name,
        h.posts.len(),
        h.tags.len()
    );

    // spec.md § "`#[derive(PostgresJson)]`" — `JsonOp::Contains`(`@>`)를 통한
    // 부분 문서 매칭. `.filter()` 클로저가 받는 `UserCols` 의 `budget` 컬럼에
    // `JsonCol::contains` 확장 트레이트가 적용된다.
    let usd_users = user_repo
        .find(User::query().filter(|u| u.budget.contains(json!({"currency": "USD"}))))
        .await?
        .items;
    assert_eq!(
        usd_users.len(),
        1,
        "budget @> {{currency: USD}} 는 hackartist만 매칭"
    );
    println!(
        "[3] JsonOp::Contains: budget @> {{\"currency\":\"USD\"}} → {} row(s)",
        usd_users.len()
    );

    // spec.md § "`#[derive(PostgresEnum)]`" — enum 컬럼 직접 연산자 진입점.
    let owners = user_repo
        .find(User::query().role(EnumOp::Eq(Role::Owner)))
        .await?
        .items;
    assert_eq!(owners.len(), 1, "role = Owner 는 hackartist만 매칭");
    println!("[3] EnumOp::Eq(Role::Owner) → {} row(s)", owners.len());

    // ═══════════════════════════════════════════════════════════════════
    // 4) spec.md § "`UserUpdate`" — 부분 업데이트 + "관계 소유 필드의 FK 갱신"
    //    (post의 user_id 재지정, 엔티티 전체가 아니라 FK 스칼라 값만으로).
    // ═══════════════════════════════════════════════════════════════════
    let updated = user_repo
        .update(
            hackartist.id,
            User::update().name("hackartist-renamed").age(34),
        )
        .await?;
    assert_eq!(updated.name, "hackartist-renamed");
    assert_eq!(updated.age, 34);
    println!(
        "[4] User::update().name(...).age(...) → name=\"{}\", age={}",
        updated.name, updated.age
    );

    // post1 을 "someone-else" 소유로 재지정했다가 되돌린다.
    post_repo
        .update(post1.id, Post::update().user_id(other.id))
        .await?;
    let repointed = post_repo
        .find_one(Post::query().filter(|p| p.id.eq(post1.id)).with_user())
        .await?
        .expect("post1 must still exist");
    assert_eq!(
        repointed.user.name, "someone-else",
        "user_id 세터는 소유자를 재지정한다"
    );
    post_repo
        .update(post1.id, Post::update().user_id(hackartist.id))
        .await?;
    println!("[4] Post::update().user_id(...) re-points ownership, then restored to hackartist");

    // ═══════════════════════════════════════════════════════════════════
    // 5) spec.md § "트랜잭션 설계 노트" — `Tx::begin` + `repo.with_tx(&tx)` 클론.
    //    rollback 은 drop 으로도 걸리지만, 여기서는 명시적 rollback/commit 둘 다
    //    보여준다. `Tx::begin()` 은 인자 없이 전역 풀에서 tx 를 연다.
    // ═══════════════════════════════════════════════════════════════════
    let tx = Tx::begin().await?;
    let tx_tags = tag_repo.with_tx(&tx);
    let draft_tag = tx_tags
        .insert(&Tag {
            id: Uuid::nil(),
            label: "draft-only".into(),
        })
        .await?;
    assert!(
        tx_tags.get(draft_tag.id).await?.is_some(),
        "tx 안에서는 커밋 전에도 자신이 쓴 행을 본다 (read-your-writes)"
    );
    tx.rollback().await?;
    assert!(
        tag_repo.get(draft_tag.id).await?.is_none(),
        "rollback 후에는 pool 에서도 보이지 않아야 한다"
    );
    println!("[5] tx insert + rollback → row absent afterwards");

    let tx2 = Tx::begin().await?;
    let tx_tags2 = tag_repo.with_tx(&tx2);
    let kept_tag = tx_tags2
        .insert(&Tag {
            id: Uuid::nil(),
            label: "kept".into(),
        })
        .await?;
    tx2.commit().await?;
    assert!(
        tag_repo.get(kept_tag.id).await?.is_some(),
        "commit 후에는 pool 에서도 보여야 한다"
    );
    println!("[5] tx insert + commit → row present afterwards");

    // ═══════════════════════════════════════════════════════════════════
    // 6) spec.md § "로딩 모델 (hybrid) — lazy": `get()` 은 관계를 채우지 않고,
    //    `load_posts()` 로 명시적으로 채운다.
    // ═══════════════════════════════════════════════════════════════════
    let mut fresh = user_repo
        .get(hackartist.id)
        .await?
        .expect("hackartist must exist");
    assert!(fresh.posts.is_empty(), "get()은 관계를 hydrate 하지 않는다");
    fresh.load_posts(&user_repo).await?;
    assert_eq!(fresh.posts.len(), 2);
    println!(
        "[6] lazy load_posts(): get() 직후 0 → load_posts() 후 {}",
        fresh.posts.len()
    );

    // ═══════════════════════════════════════════════════════════════════
    // 7) spec.md § "Schema 관리" 정리 — 등록 역순(조인테이블 → 테이블(역등록순)
    //    → enum)으로 drop.
    // ═══════════════════════════════════════════════════════════════════
    schema.drop(&pool).await?;
    println!("[7] Schema::drop() — ex_tags/ex_posts/ex_users(+role enum, join table) gone");

    println!("\nbasic.rs — 전 과정 통과 (assert 포함, 패닉 없이 정상 종료)");
    Ok(())
}
