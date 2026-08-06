//! Task 11 — `#[derive(PostgresEntity)]` one_to_many 배치 hydrate.
//!
//! 부모 `Vec<Child>` 관계: 부모 테이블에 컬럼/제약 없음, 자식 테이블을 부모 pk 리스트로
//! 한 번에 끌어와(N+1 없음) 각 부모에 정확히 분배, 재로딩 시 `clear()` 로 중복 방지,
//! lazy `load_*` 동작을 라이브 PostgreSQL 왕복으로 증명한다.
#![allow(dead_code)]

mod common;

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresObject, UuidCol};

/// 부모(pk-side). `posts` 는 one_to_many — 부모 테이블에 컬럼을 만들지 않고,
/// 자식 `r2_posts.author_id` 로 역참조한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r2_authors")]
pub struct RAuthor {
    pub id: Uuid,
    pub name: String,
    #[postgres(one_to_many, foreign_key = "author_id")]
    pub posts: Vec<RPost>,
}

/// 자식(FK-side). `author` 는 many_to_one → FK 컬럼 "author_id" REFERENCES r2_authors(id).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r2_posts")]
pub struct RPost {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub author: RAuthor, // fk col "author_id"
    pub title: String,
}

#[tokio::test]
async fn relation_to_many_roundtrip() {
    // 다중 #[tokio::test] 바이너리 — 각 테스트는 자기 런타임에 묶인 풀을 써야 하므로
    // (프로세스 전역 풀은 첫 런타임에 고정된다) 명시적 풀 escape hatch 를 쓴다.
    let pool = common::pool().await;
    let author_repo = postgres::PostgresRepository::<RAuthor>::new(pool.clone());
    let post_repo = postgres::PostgresRepository::<RPost>::new(pool);

    // FK 의존: post → author. drop 은 post 먼저, create 는 author 먼저.
    post_repo.drop_table().await.ok();
    author_repo.drop_table().await.ok();
    author_repo.create_table().await.unwrap();
    post_repo.create_table().await.unwrap();

    // ── DDL: one_to_many 는 부모 테이블에 컬럼을 만들지 않는다 ──
    let ddl = <RAuthor as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        !create.contains("posts"),
        "one_to_many must not add a column to the parent DDL: {create}"
    );

    // ── seed authors A, B, C ──
    let a = author_repo
        .insert(&RAuthor {
            id: Uuid::nil(),
            name: "A".into(),
            posts: vec![],
        })
        .await
        .unwrap();
    let b = author_repo
        .insert(&RAuthor {
            id: Uuid::nil(),
            name: "B".into(),
            posts: vec![],
        })
        .await
        .unwrap();
    let c = author_repo
        .insert(&RAuthor {
            id: Uuid::nil(),
            name: "C".into(),
            posts: vec![],
        })
        .await
        .unwrap();

    // ── seed posts: 2 for A, 1 for B, 0 for C ──
    for t in ["a-1", "a-2"] {
        post_repo
            .insert(&RPost {
                id: Uuid::nil(),
                author: a.clone(),
                title: t.into(),
            })
            .await
            .unwrap();
    }
    post_repo
        .insert(&RPost {
            id: Uuid::nil(),
            author: b.clone(),
            title: "b-1".into(),
        })
        .await
        .unwrap();

    // ── batch eager: 세 부모 동시 find + with_posts → 각자 정확 분배 (N+1 없음) ──
    let authors = author_repo
        .find(RAuthor::query().with_posts())
        .await
        .unwrap()
        .items;
    assert_eq!(authors.len(), 3);
    let fa = authors.iter().find(|x| x.id == a.id).unwrap();
    let fb = authors.iter().find(|x| x.id == b.id).unwrap();
    let fc = authors.iter().find(|x| x.id == c.id).unwrap();

    let mut a_titles: Vec<String> = fa.posts.iter().map(|p| p.title.clone()).collect();
    a_titles.sort();
    assert_eq!(
        a_titles,
        vec!["a-1".to_string(), "a-2".to_string()],
        "A 는 자식 2개가 정확히 분배되어야 한다"
    );
    assert_eq!(fb.posts.len(), 1, "B 는 자식 1개");
    assert_eq!(fb.posts[0].title, "b-1");
    assert!(fc.posts.is_empty(), "C 는 자식 0 → 빈 vec");

    // ── clear() 증명: 이미 로딩된 부모에 load_posts 재실행 → 중복 없음 ──
    let mut fa2 = author_repo
        .find_one(RAuthor::query().filter(|q| q.id.eq(a.id)).with_posts())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(fa2.posts.len(), 2);
    fa2.load_posts(&author_repo).await.unwrap();
    assert_eq!(
        fa2.posts.len(),
        2,
        "재로딩은 clear 후 다시 채운다 — 중복 push 금지"
    );

    // ── lazy: fresh get 은 관계 미로딩, load_posts 로 채운다 ──
    let mut gb = author_repo.get(b.id).await.unwrap().unwrap();
    assert!(gb.posts.is_empty(), "get 은 관계를 hydrate 하지 않는다");
    gb.load_posts(&author_repo).await.unwrap();
    assert_eq!(gb.posts.len(), 1);
    assert_eq!(gb.posts[0].title, "b-1");

    // ── cleanup ──
    post_repo.drop_table().await.unwrap();
    author_repo.drop_table().await.unwrap();
}

/// 부모(pk-side), **DEFAULT** FK 정렬 검증. `members` 는 `foreign_key` attr 없이
/// 선언 → 매크로가 `format!("{}_id", base_name())` = "r2_club_id" 로 유도한다
/// (위 `RAuthor::posts` 는 명시적 `foreign_key = "author_id"` 라 이 경로는 별도 커버가
/// 필요했다).
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r2_club")]
pub struct RClub {
    pub id: Uuid,
    pub name: String,
    #[postgres(one_to_many)]
    pub members: Vec<RMember>,
}

/// 자식(FK-side). `club` FK 컬럼명을 "r2_club_id" 로 명시 지정해, 부모의 DEFAULT
/// 유도값과 정렬시킨다 — 실제 컬럼을 만드는 쪽은 이 소유 선언이다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r2_members")]
pub struct RMember {
    pub id: Uuid,
    #[postgres(many_to_one, foreign_key = "r2_club_id")]
    pub club: RClub,
    pub nickname: String,
}

#[tokio::test]
async fn relation_to_many_default_fk_roundtrip() {
    // ── metadata: foreign_key attr 없는 one_to_many 는 "{base_name}_id" 로 유도된다 ──
    let rels = <RClub as PostgresEntity>::relations();
    let rel = rels.iter().find(|r| r.field == "members").unwrap();
    assert_eq!(
        (rel.foreign_key)(),
        "r2_club_id",
        "no foreign_key attr → derived from base_name()"
    );

    let pool = common::pool().await;
    let club_repo = postgres::PostgresRepository::<RClub>::new(pool.clone());
    let member_repo = postgres::PostgresRepository::<RMember>::new(pool);

    // FK 의존: member → club. drop 은 member 먼저, create 는 club 먼저.
    member_repo.drop_table().await.ok();
    club_repo.drop_table().await.ok();
    club_repo.create_table().await.unwrap();
    member_repo.create_table().await.unwrap();

    let club = club_repo
        .insert(&RClub {
            id: Uuid::nil(),
            name: "Chess".into(),
            members: vec![],
        })
        .await
        .unwrap();

    for n in ["alice", "bob"] {
        member_repo
            .insert(&RMember {
                id: Uuid::nil(),
                club: club.clone(),
                nickname: n.into(),
            })
            .await
            .unwrap();
    }

    // ── live roundtrip: 유도된 FK 컬럼으로 실제 hydrate 가 동작해야 한다 ──
    let clubs = club_repo
        .find(RClub::query().with_members())
        .await
        .unwrap()
        .items;
    let c = clubs.iter().find(|c| c.id == club.id).unwrap();
    assert_eq!(
        c.members.len(),
        2,
        "default FK alignment must hydrate both members"
    );
    let mut nicks: Vec<String> = c.members.iter().map(|m| m.nickname.clone()).collect();
    nicks.sort();
    assert_eq!(nicks, vec!["alice".to_string(), "bob".to_string()]);

    // ── cleanup ──
    member_repo.drop_table().await.unwrap();
    club_repo.drop_table().await.unwrap();
}
