//! Integration coverage for the space waiting-screen greeting: the Creator
//! writes it through `PATCH /api/spaces/{id}` while the space has not started,
//! `GET /api/spaces/{id}` exposes it, and edits are rejected once the space is
//! `Ongoing` or later.
use super::*;
use crate::common::models::space::SpaceCommon;
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::spaces::space_common::controllers::UpdateSpaceRequest;
use axum::http::HeaderMap;
use postgres::PostgresEntity;
use serde_json::{Value, json};

/// Seeds a public, published space owned by the test user in `status` and
/// returns its id (no prefix).
async fn seed_space(ctx: &TestContext, status: Option<SpaceStatus>) -> String {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space = SpaceCommon {
        space_pk: Partition::Space(space_id.clone()).to_string(),
        created_at: now,
        updated_at: now,
        status,
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: Partition::Feed(space_id.clone()).to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        author_display_name: ctx.test_user.0.display_name.clone(),
        author_profile_url: ctx.test_user.0.profile_url.clone(),
        author_username: ctx.test_user.0.username.clone(),
        quota: 1_000_000,
        remains: 1_000_000,
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = crate::features::posts::models::Post {
        id: uuid::Uuid::parse_str(&space_id).expect("uuid"),
        title: "Greeting Test Space".to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    space_id
}

async fn patch_greeting(
    ctx: &TestContext,
    headers: HeaderMap,
    space_id: &str,
    greeting: &str,
) -> (axum::http::StatusCode, Value) {
    let (status, _, body) = crate::test_patch! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: headers,
        body: { "req": { "greeting": greeting } }
    };
    (status, body)
}

async fn stored_greeting(space_id: &str) -> String {
    SpaceCommon::get_by_partition(&Partition::Space(space_id.to_string()))
        .await
        .expect("load space")
        .expect("space exists")
        .greeting
}

#[test]
fn greeting_request_is_not_shadowed_by_start_time() {
    let req: UpdateSpaceRequest =
        serde_json::from_value(json!({ "greeting": "<p>Hi</p>" })).expect("deserialize");
    assert!(
        matches!(req, UpdateSpaceRequest::Greeting { ref greeting } if greeting == "<p>Hi</p>"),
        "expected Greeting variant, got {req:?}"
    );
}

#[by_macros::pg_test]
async fn test_space_greeting_defaults_to_empty() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, Some(SpaceStatus::Open)).await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "get space: {body:?}");
    assert_eq!(body["greeting"], json!(""), "body: {body:?}");
}

#[by_macros::pg_test]
async fn test_creator_sets_greeting_before_start() {
    let ctx = TestContext::setup().await;

    for state in [
        None,
        Some(SpaceStatus::Designing),
        Some(SpaceStatus::Open),
        Some(SpaceStatus::Sampling),
    ] {
        let space_id = seed_space(&ctx, state.clone()).await;
        let (status, body) = patch_greeting(
            &ctx,
            ctx.test_user.1.clone(),
            &space_id,
            "<p style=\"color: #ff0000; font-weight: 700;\">Welcome aboard</p>",
        )
        .await;
        assert_eq!(status, 200, "patch greeting in {state:?}: {body:?}");
        assert_eq!(
            body["greeting"],
            json!("<p style=\" font-weight: 700;\">Welcome aboard</p>"),
            "color styles are stripped in {state:?}: {body:?}"
        );

        let (status, _, body) = crate::test_get! {
            app: ctx.app.clone(),
            path: &format!("/api/spaces/{}", space_id),
            headers: ctx.test_user.1.clone(),
        };
        assert_eq!(status, 200, "get space: {body:?}");
        assert_eq!(
            body["greeting"],
            json!("<p style=\" font-weight: 700;\">Welcome aboard</p>"),
            "get_space exposes the greeting in {state:?}: {body:?}"
        );
    }
}

#[by_macros::pg_test]
async fn test_creator_can_clear_greeting() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, Some(SpaceStatus::Open)).await;

    let (status, body) =
        patch_greeting(&ctx, ctx.test_user.1.clone(), &space_id, "<p>Hello</p>").await;
    assert_eq!(status, 200, "set greeting: {body:?}");
    let (status, body) = patch_greeting(&ctx, ctx.test_user.1.clone(), &space_id, "").await;
    assert_eq!(status, 200, "clear greeting: {body:?}");
    assert_eq!(stored_greeting(&space_id).await, "");
}

#[by_macros::pg_test]
async fn test_greeting_is_locked_once_started() {
    let ctx = TestContext::setup().await;

    for state in [
        SpaceStatus::Ongoing,
        SpaceStatus::Processing,
        SpaceStatus::Finished,
    ] {
        let space_id = seed_space(&ctx, Some(state.clone())).await;
        let (status, body) =
            patch_greeting(&ctx, ctx.test_user.1.clone(), &space_id, "<p>Too late</p>").await;
        assert_eq!(
            status, 400,
            "greeting edit must be rejected in {state:?}: {body:?}"
        );
        assert_eq!(
            stored_greeting(&space_id).await,
            "",
            "greeting unchanged in {state:?}"
        );
    }
}

#[by_macros::pg_test]
async fn test_non_creator_cannot_set_greeting() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, Some(SpaceStatus::Open)).await;
    let (_other, other_headers) = ctx.create_another_user().await;

    let (status, body) = patch_greeting(&ctx, other_headers, &space_id, "<p>Hijack</p>").await;
    assert_ne!(
        status, 200,
        "non-creator must not set the greeting: {body:?}"
    );
    assert_eq!(stored_greeting(&space_id).await, "");

    let (status, body) = patch_greeting(&ctx, HeaderMap::new(), &space_id, "<p>Anon</p>").await;
    assert_ne!(
        status, 200,
        "unauthenticated caller must not set the greeting: {body:?}"
    );
    assert_eq!(stored_greeting(&space_id).await, "");
}
