//! `get_space`'s `has_privacy_consent_question` field: true iff any
//! `SpacePoll` belonging to the space carries a `Question::PrivacyConsent`
//! question, false for spaces with no such question (no polls at all, or
//! polls with only non-consent questions).
use super::*;
use crate::common::models::space::SpaceCommon;
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility, UserType};
use crate::features::posts::models::{AuthorTypeJson, Post};
use crate::features::posts::types::{PostStatus, Visibility};
use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
use crate::features::spaces::pages::actions::actions::poll::types::{
    ChoiceQuestion, PrivacyConsentQuestion, Question,
};

/// Insert an individually-owned, published, public space directly into the
/// DB and return its `SpacePartition` plus the raw id string used in the
/// request path. Mirrors `get_space_admin_tests::insert_team_owned_space`,
/// minus the team indirection.
async fn insert_individual_space(ctx: &TestContext) -> (crate::common::types::SpacePartition, String) {
    let post_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let space_pk = Partition::Space(post_id.clone());
    let post_pk = Partition::Feed(post_id.clone());
    let owner = &ctx.test_user.0;

    let space = SpaceCommon {
        id: uuid::Uuid::now_v7(),
        space_pk: space_pk.to_string(),
        created_at: now,
        updated_at: now,
        status: Some(SpaceStatus::Open),
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: post_pk.to_string(),
        user_pk: owner.pk().to_string(),
        author_display_name: owner.display_name.clone(),
        author_profile_url: String::new(),
        author_username: owner.username.clone(),
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = Post {
        id: uuid::Uuid::parse_str(&post_id).unwrap(),
        created_at: now,
        updated_at: now,
        title: "Privacy Consent Test Space".to_string(),
        status: PostStatus::Published,
        visibility: Some(Visibility::Public),
        user_pk: owner.pk().to_string(),
        author_type: AuthorTypeJson(UserType::Individual),
        ..Default::default()
    };
    post.create().await.expect("create post");

    let space_partition = crate::common::types::SpacePartition(post_id.clone());
    (space_partition, post_id)
}

#[by_macros::pg_test]
async fn get_space_reports_true_when_a_poll_has_a_privacy_consent_question() {
    let ctx = TestContext::setup().await;
    let (space_pk, space_id) = insert_individual_space(&ctx).await;

    let mut poll = SpacePoll::try_from(space_pk).expect("default poll");
    poll.questions.0.push(Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
    }));
    SpacePoll::repository().insert(&poll).await.expect("save poll");

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "expected 200, body: {body:?}");
    assert_eq!(
        body["has_privacy_consent_question"],
        serde_json::json!(true),
        "a PrivacyConsent question anywhere in the space's polls must flip this true; body: {body:?}"
    );
}

#[by_macros::pg_test]
async fn get_space_reports_false_when_no_poll_has_a_privacy_consent_question() {
    let ctx = TestContext::setup().await;
    let (space_pk, space_id) = insert_individual_space(&ctx).await;

    let mut poll = SpacePoll::try_from(space_pk).expect("default poll");
    poll.questions.0.push(Question::SingleChoice(ChoiceQuestion {
        title: "Favorite color".to_string(),
        ..Default::default()
    }));
    SpacePoll::repository().insert(&poll).await.expect("save poll");

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "expected 200, body: {body:?}");
    assert_eq!(
        body["has_privacy_consent_question"],
        serde_json::json!(false),
        "no PrivacyConsent question in any poll; body: {body:?}"
    );
}

#[by_macros::pg_test]
async fn get_space_reports_false_when_space_has_no_polls() {
    let ctx = TestContext::setup().await;
    let (_space_pk, space_id) = insert_individual_space(&ctx).await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "expected 200, body: {body:?}");
    assert_eq!(
        body["has_privacy_consent_question"],
        serde_json::json!(false),
        "a space with zero polls must not report a consent question; body: {body:?}"
    );
}
