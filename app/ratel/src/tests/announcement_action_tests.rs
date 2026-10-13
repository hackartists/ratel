//! Space announcement action: singleton creation, `list_actions` ordering and
//! visibility, and the `update_space_action` guards that keep it out of
//! rewards, prerequisites and dependency chains, and the per-user read record
//! that moves a confirmed announcement into the dashboard archive.
use super::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};

/// Seeds a published space owned by the test user (Creator) with the given status.
async fn seed_space(ctx: &TestContext, status: SpaceStatus) -> String {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space = SpaceCommon {
        space_pk: Partition::Space(space_id.clone()).to_string(),
        created_at: now,
        updated_at: now,
        status: Some(status),
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: Partition::Feed(space_id.clone()).to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        author_display_name: ctx.test_user.0.display_name.clone(),
        author_profile_url: ctx.test_user.0.profile_url.clone(),
        author_username: ctx.test_user.0.username.clone(),
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = crate::features::posts::models::Post {
        id: uuid::Uuid::parse_str(&space_id).expect("space_id is a valid uuid"),
        title: "Announcement Action Test Space".to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    space_id
}

/// Seeds an Ongoing poll companion action and returns its action id.
async fn seed_poll_action(space_id: &str, prerequisite: bool) -> String {
    let mut action = SpaceAction::new(
        crate::common::types::SpacePartition(space_id.to_string()),
        uuid::Uuid::new_v4().to_string(),
        SpaceActionType::Poll,
    );
    action.status = Some(SpaceActionStatus::Ongoing);
    action.prerequisite = prerequisite;
    action.save().await.expect("save poll action");
    action.action_id
}

/// Creates the announcement as the Creator and returns its action id.
async fn create_announcement(ctx: &TestContext, space_id: &str) -> String {
    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/announcements", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "create_space_announcement: {:?}", body);
    assert_eq!(body["space_action_type"], "Announcement");
    body["action_id"].as_str().unwrap().to_string()
}

async fn update_action(
    ctx: &TestContext,
    space_id: &str,
    action_id: &str,
    req: serde_json::Value,
) -> u16 {
    let (status, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions/{}", space_id, action_id),
        headers: ctx.test_user.1.clone(),
        body: { "req": req }
    };
    status.as_u16()
}

fn action_ids(body: &serde_json::Value) -> Vec<String> {
    body.as_array()
        .expect("list_actions returns an array")
        .iter()
        .map(|a| a["action_id"].as_str().unwrap().to_string())
        .collect()
}

#[by_macros::pg_test]
async fn test_create_announcement_is_singleton() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;

    let first = create_announcement(&ctx, &space_id).await;
    let second = create_announcement(&ctx, &space_id).await;
    assert_eq!(
        first, second,
        "a second create must return the existing announcement"
    );

    let actions = SpaceAction::list_by_space(&crate::common::types::SpacePartition(space_id))
        .await
        .expect("list actions");
    let count = actions
        .iter()
        .filter(|a| a.space_action_type == SpaceActionType::Announcement)
        .count();
    assert_eq!(count, 1, "only one announcement row per space");
}

#[by_macros::pg_test]
async fn test_create_announcement_requires_creator() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;

    let (status, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/announcements", space_id),
    };
    assert_ne!(status, 200, "unauthenticated create must fail");

    let (_, other_headers) = ctx.create_another_user().await;
    let (status, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/announcements", space_id),
        headers: other_headers,
    };
    assert_ne!(status, 200, "non-creator create must fail");
}

#[by_macros::pg_test]
async fn test_list_actions_pins_announcement_first() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;
    let poll_id = seed_poll_action(&space_id, false).await;
    let announcement_id = create_announcement(&ctx, &space_id).await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);
    assert_eq!(action_ids(&body), vec![announcement_id, poll_id]);
}

#[by_macros::pg_test]
async fn test_viewer_sees_published_announcement_alongside_prerequisites() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Open).await;
    let prereq_id = seed_poll_action(&space_id, true).await;
    let other_poll_id = seed_poll_action(&space_id, false).await;
    let announcement_id = create_announcement(&ctx, &space_id).await;
    let (_, viewer_headers) = ctx.create_another_user().await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: viewer_headers.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);
    assert_eq!(
        action_ids(&body),
        vec![prereq_id.clone()],
        "a Designing announcement stays hidden from non-Creators"
    );

    assert_eq!(
        update_action(
            &ctx,
            &space_id,
            &announcement_id,
            serde_json::json!({ "status": "Ongoing" })
        )
        .await,
        200
    );

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: viewer_headers,
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);
    let ids = action_ids(&body);
    assert_eq!(ids, vec![announcement_id, prereq_id]);
    assert!(!ids.contains(&other_poll_id));
}

#[by_macros::pg_test]
async fn test_announcement_rejects_reward_prerequisite_and_dependencies() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;
    let poll_id = seed_poll_action(&space_id, false).await;
    let announcement_id = create_announcement(&ctx, &space_id).await;

    for req in [
        serde_json::json!({ "credits": 10 }),
        serde_json::json!({ "prerequisite": true }),
        serde_json::json!({ "depends_on": [poll_id.clone()] }),
        serde_json::json!({ "required_attributes": [] }),
    ] {
        assert_eq!(
            update_action(&ctx, &space_id, &announcement_id, req.clone()).await,
            400,
            "announcement must reject {req}"
        );
    }

    assert_eq!(
        update_action(
            &ctx,
            &space_id,
            &poll_id,
            serde_json::json!({ "depends_on": [announcement_id.clone()] })
        )
        .await,
        400,
        "an announcement cannot be a dependency target"
    );

    for req in [
        serde_json::json!({ "title": "Welcome" }),
        serde_json::json!({ "description": "<p>Read me first</p>" }),
    ] {
        assert_eq!(
            update_action(&ctx, &space_id, &announcement_id, req.clone()).await,
            200,
            "announcement must accept {req}"
        );
    }

    let saved = SpaceAction::get_one(
        &crate::common::types::SpacePartition(space_id),
        &announcement_id,
    )
    .await
    .expect("get announcement")
    .expect("announcement exists");
    assert_eq!(saved.title, "Welcome");
    assert_eq!(saved.description, "<p>Read me first</p>");
    assert_eq!(saved.credits, 0);
    assert!(!saved.prerequisite);
}

/// Joins a fresh user to the space as a participant and returns their headers.
async fn join_participant(ctx: &TestContext, space_id: &str) -> axum::http::HeaderMap {
    let (user, headers) = ctx.create_another_user().await;
    SpaceParticipant::new(Partition::Space(space_id.to_string()), user.pk())
        .create()
        .await
        .expect("create participant");
    headers
}

async fn read_announcement(
    ctx: &TestContext,
    space_id: &str,
    action_id: &str,
    headers: Option<axum::http::HeaderMap>,
) -> u16 {
    let path = format!("/api/spaces/{}/announcements/{}/read", space_id, action_id);
    let (status, _, _) = match headers {
        Some(headers) => crate::test_post! {
            app: ctx.app.clone(),
            path: &path,
            headers: headers,
        },
        None => crate::test_post! {
            app: ctx.app.clone(),
            path: &path,
        },
    };
    status.as_u16()
}

async fn announcement_participated(
    ctx: &TestContext,
    space_id: &str,
    action_id: &str,
    headers: axum::http::HeaderMap,
) -> bool {
    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: headers,
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);
    let action = body
        .as_array()
        .expect("list_actions returns an array")
        .iter()
        .find(|a| a["action_id"] == action_id)
        .expect("announcement is listed")
        .clone();
    action["user_participated"].as_bool().unwrap()
}

#[by_macros::pg_test]
async fn test_read_announcement_marks_it_participated_per_user() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;
    seed_poll_action(&space_id, false).await;
    let announcement_id = create_announcement(&ctx, &space_id).await;
    assert_eq!(
        update_action(
            &ctx,
            &space_id,
            &announcement_id,
            serde_json::json!({ "status": "Ongoing" })
        )
        .await,
        200
    );

    let reader = join_participant(&ctx, &space_id).await;
    let other = join_participant(&ctx, &space_id).await;
    assert!(!announcement_participated(&ctx, &space_id, &announcement_id, reader.clone()).await);

    assert_eq!(
        read_announcement(&ctx, &space_id, &announcement_id, Some(reader.clone())).await,
        200
    );
    assert_eq!(
        read_announcement(&ctx, &space_id, &announcement_id, Some(reader.clone())).await,
        200,
        "a repeated read is idempotent"
    );

    assert!(announcement_participated(&ctx, &space_id, &announcement_id, reader).await);
    assert!(
        !announcement_participated(&ctx, &space_id, &announcement_id, other).await,
        "the read record belongs to the reader only"
    );
}

#[by_macros::pg_test]
async fn test_read_announcement_rejects_non_participants_drafts_and_other_actions() {
    let ctx = TestContext::setup().await;
    let space_id = seed_space(&ctx, SpaceStatus::Ongoing).await;
    let poll_id = seed_poll_action(&space_id, false).await;
    let announcement_id = create_announcement(&ctx, &space_id).await;
    let participant = join_participant(&ctx, &space_id).await;

    assert_ne!(
        read_announcement(&ctx, &space_id, &announcement_id, Some(participant.clone())).await,
        200,
        "a Designing announcement cannot be read"
    );

    assert_eq!(
        update_action(
            &ctx,
            &space_id,
            &announcement_id,
            serde_json::json!({ "status": "Ongoing" })
        )
        .await,
        200
    );

    assert_ne!(
        read_announcement(&ctx, &space_id, &announcement_id, None).await,
        200,
        "unauthenticated read must fail"
    );
    let (_, viewer) = ctx.create_another_user().await;
    assert_ne!(
        read_announcement(&ctx, &space_id, &announcement_id, Some(viewer)).await,
        200,
        "a non-participant read must fail"
    );
    assert_ne!(
        read_announcement(
            &ctx,
            &space_id,
            &announcement_id,
            Some(ctx.test_user.1.clone())
        )
        .await,
        200,
        "the Creator does not record reads"
    );
    assert_ne!(
        read_announcement(&ctx, &space_id, &poll_id, Some(participant.clone())).await,
        200,
        "only announcement actions can be read"
    );
    assert_eq!(
        read_announcement(&ctx, &space_id, &announcement_id, Some(participant)).await,
        200
    );
}
