//! Task 12 — `#[derive(PostgresEntity)]` many_to_many 조인테이블.
//!
//! `Vec<T>` (T: 테이블 엔티티) 필드에 `#[postgres(many_to_many)]` — 소유 컬럼 없이
//! 규약 유도 조인테이블(정렬된 base_name 결합)로 다대다를 표현한다. 양쪽 엔티티에서
//! 각각 선언해도 **같은 조인테이블 이름**을 유도하고, `attach_*`/`detach_*` 확장 메서드로
//! 링크를 관리하며, `with_*` 플래그로 양방향 배치 hydrate 를 라이브 PostgreSQL 왕복으로
//! 증명한다.
#![allow(dead_code)]

mod common;

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresObject, Schema, UuidCol};

/// 한쪽 엔티티. `tags` 는 many_to_many — 부모 테이블에 컬럼을 만들지 않고,
/// 규약 유도 조인테이블 "r3_articles_r3_tags" 로 RTag 와 연결한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_articles")]
pub struct RArticle {
    pub id: Uuid,
    pub title: String,
    #[postgres(many_to_many)]
    pub tags: Vec<RTag>,
}

/// 반대쪽 엔티티. `articles` 도 many_to_many — **같은** 조인테이블 이름을 유도해야
/// 한다(정렬된 base_name 결합은 대칭). 이 미러 선언이 양방향 로딩과 동일 이름 유도를
/// 증명하는 근거다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_tags")]
pub struct RTag {
    pub id: Uuid,
    pub name: String,
    #[postgres(many_to_many)]
    pub articles: Vec<RArticle>,
}

#[test]
fn many_to_many_metadata_derives_same_join_table() {
    // ── 양쪽에서 선언해도 동일 조인테이블 이름 (정렬 결합) ──
    let a_rels = <RArticle as PostgresEntity>::relations();
    let t_rels = <RTag as PostgresEntity>::relations();
    let a_tags = a_rels.iter().find(|r| r.field == "tags").unwrap();
    let t_articles = t_rels.iter().find(|r| r.field == "articles").unwrap();

    let a_join = (a_tags.join_table.unwrap())();
    let t_join = (t_articles.join_table.unwrap())();
    assert_eq!(
        a_join, t_join,
        "both sides must derive the SAME join table name"
    );
    assert_eq!(
        a_join, "r3_articles_r3_tags",
        "sorted base names → r3_articles_r3_tags"
    );

    // ── 규약 유도 from_key / to_key (base_name + _id) ──
    assert_eq!((a_tags.foreign_key)(), "r3_articles_id");
    assert_eq!((a_tags.reference_key)(), "r3_tags_id");
    // 미러 측은 from/to 가 뒤집힌다 (같은 조인테이블, 반대 관점).
    assert_eq!((t_articles.foreign_key)(), "r3_tags_id");
    assert_eq!((t_articles.reference_key)(), "r3_articles_id");
}

#[test]
fn many_to_many_ddl_adds_no_parent_column() {
    // 부모 테이블 DDL 에 관계 필드명 컬럼이 생기면 안 된다 (조인테이블이 링크를 소유).
    let ddl = <RArticle as PostgresObject>::ddl();
    let create = &ddl.create[0];
    assert!(
        !create.contains("tags"),
        "many_to_many must not add a column to the parent DDL: {create}"
    );
}

#[tokio::test]
async fn many_to_many_roundtrip() {
    let pool = common::pool().await;
    let article_repo = RArticle::repository();
    let tag_repo = RTag::repository();

    // `Schema` 부트스트랩(Task 13): 등록순으로 (1) enum dep → (2) 두 본 테이블 →
    // (3) 조인테이블(양쪽이 같은 DDL 을 emit 해도 문자열 dedupe) 순으로 한 번에
    // 안착시킨다 — 상대 본 테이블이 아직 없어 조인 생성이 실패하던 두 단계 `.ok()`
    // 부트스트랩이 더 이상 필요 없다.
    let schema = Schema::new().register::<RArticle>().register::<RTag>();

    // ── clean slate ──
    schema.drop(&pool).await.ok();

    // ── create: 한 번의 호출로 본 테이블 + 조인테이블까지 전부 안착 ──
    schema.create(&pool).await.unwrap();

    // ── seed ──
    let a1 = article_repo
        .insert(&RArticle {
            id: Uuid::nil(),
            title: "a1".into(),
            tags: vec![],
        })
        .await
        .unwrap();
    let a2 = article_repo
        .insert(&RArticle {
            id: Uuid::nil(),
            title: "a2".into(),
            tags: vec![],
        })
        .await
        .unwrap();
    let t1 = tag_repo
        .insert(&RTag {
            id: Uuid::nil(),
            name: "t1".into(),
            articles: vec![],
        })
        .await
        .unwrap();
    let t2 = tag_repo
        .insert(&RTag {
            id: Uuid::nil(),
            name: "t2".into(),
            articles: vec![],
        })
        .await
        .unwrap();
    let t3 = tag_repo
        .insert(&RTag {
            id: Uuid::nil(),
            name: "t3".into(),
            articles: vec![],
        })
        .await
        .unwrap();

    // ── attach: a1 ↔ {t1, t2}, a2 ↔ {t3} (조인테이블은 schema.create() 가 만든 것 그대로) ──
    article_repo.attach_tags(a1.id, t1.id).await.unwrap();
    article_repo.attach_tags(a1.id, t2.id).await.unwrap();
    article_repo.attach_tags(a2.id, t3.id).await.unwrap();

    // ── forward eager: find RArticle with_tags → 정확한 집합 ──
    let articles = article_repo
        .find(RArticle::query().with_tags())
        .await
        .unwrap()
        .items;
    let fa1 = articles.iter().find(|a| a.id == a1.id).unwrap();
    let mut a1_tags: Vec<String> = fa1.tags.iter().map(|t| t.name.clone()).collect();
    a1_tags.sort();
    assert_eq!(a1_tags, vec!["t1".to_string(), "t2".to_string()]);
    let fa2 = articles.iter().find(|a| a.id == a2.id).unwrap();
    assert_eq!(fa2.tags.len(), 1);
    assert_eq!(fa2.tags[0].name, "t3");

    // ── reverse eager: find RTag with_articles → 같은 조인테이블을 반대 관점으로 로딩 ──
    let tags = tag_repo
        .find(RTag::query().with_articles())
        .await
        .unwrap()
        .items;
    let ft1 = tags.iter().find(|t| t.id == t1.id).unwrap();
    assert_eq!(ft1.articles.len(), 1);
    assert_eq!(ft1.articles[0].title, "a1");
    let ft3 = tags.iter().find(|t| t.id == t3.id).unwrap();
    assert_eq!(ft3.articles.len(), 1);
    assert_eq!(ft3.articles[0].title, "a2");

    // ── duplicate attach 무해 (ON CONFLICT DO NOTHING) → 여전히 2개 ──
    article_repo.attach_tags(a1.id, t1.id).await.unwrap();
    let a1_dup = article_repo
        .find_one(RArticle::query().filter(|q| q.id.eq(a1.id)).with_tags())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(a1_dup.tags.len(), 2, "duplicate attach must not add a row");

    // ── detach a1 ↔ t1 → {t2} 만 남음 ──
    article_repo.detach_tags(a1.id, t1.id).await.unwrap();
    let a1_det = article_repo
        .find_one(RArticle::query().filter(|q| q.id.eq(a1.id)).with_tags())
        .await
        .unwrap()
        .unwrap();
    let a1_names: Vec<String> = a1_det.tags.iter().map(|t| t.name.clone()).collect();
    assert_eq!(a1_names, vec!["t2".to_string()]);

    // ── 미러 측 확장 메서드(RTagRepositoryExt)도 같은 조인테이블을 구동한다 ──
    tag_repo.attach_articles(t3.id, a1.id).await.unwrap(); // t3 ↔ {a2, a1}
    let ft3b = tag_repo
        .find_one(RTag::query().filter(|q| q.id.eq(t3.id)).with_articles())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(ft3b.articles.len(), 2);
    tag_repo.detach_articles(t3.id, a1.id).await.unwrap(); // 다시 t3 ↔ {a2}
    let ft3c = tag_repo
        .find_one(RTag::query().filter(|q| q.id.eq(t3.id)).with_articles())
        .await
        .unwrap()
        .unwrap();
    assert_eq!(ft3c.articles.len(), 1);

    // ── lazy: fresh get 은 관계 미로딩, load_* 로 채운다 (양방향) ──
    let mut ga2 = article_repo.get(a2.id).await.unwrap().unwrap();
    assert!(ga2.tags.is_empty(), "get 은 관계를 hydrate 하지 않는다");
    ga2.load_tags(&article_repo).await.unwrap();
    assert_eq!(ga2.tags.len(), 1);
    assert_eq!(ga2.tags[0].name, "t3");

    let mut gt2 = tag_repo.get(t2.id).await.unwrap().unwrap();
    assert!(gt2.articles.is_empty());
    gt2.load_articles(&tag_repo).await.unwrap();
    assert_eq!(gt2.articles.len(), 1);
    assert_eq!(gt2.articles[0].title, "a1");

    // ── cleanup: Schema::drop() 이 조인테이블 → 본 테이블(역등록순) 순으로 정리한다 ──
    schema.drop(&pool).await.unwrap();
}
