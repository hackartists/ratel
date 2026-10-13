//! Space admins (`SpaceUserRole::Creator`) run any action regardless of its
//! Dependency Actions, Required Attributes and not-started (Designing)
//! status, while Participants stay gated by all three.
use super::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
use crate::features::spaces::pages::actions::actions::poll::types::{ChoiceQuestion, Question};
use crate::features::spaces::pages::actions::models::{RequiredAttributeRule, SpaceAction};
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};

fn yes_no_question() -> Question {
    Question::SingleChoice(ChoiceQuestion {
        title: "Do you agree?".to_string(),
        html_title: None,
        description: None,
        image_url: None,
        options: vec!["Yes".to_string(), "No".to_string()],
        is_required: Some(true),
        allow_other: None,
        display_condition: None,
        terminate_on: vec![],
    })
}

/// Ids of the actions seeded by [`seed_space`].
struct Seeded {
    space_id: String,
    /// Ongoing poll nobody has answered yet.
    gating_poll_id: String,
    /// Ongoing poll that depends on the gating poll.
    dependent_poll_id: String,
    /// Ongoing poll whose Required Attributes need "Yes" on the gating poll.
    attribute_poll_id: String,
    /// Designing poll that both depends on and is attribute-gated by the
    /// gating poll.
    designing_poll_id: String,
}

async fn seed_poll(
    space_partition: &crate::common::types::SpacePartition,
    status: SpaceActionStatus,
    depends_on: Vec<String>,
    required_attributes: Vec<RequiredAttributeRule>,
) -> String {
    let mut poll = SpacePoll::new(space_partition.clone()).expect("new poll");
    poll.questions.0.push(yes_no_question());
    SpacePoll::repository()
        .insert(&poll)
        .await
        .expect("save poll");

    let mut action = SpaceAction::new(
        space_partition.clone(),
        poll.poll_id.clone(),
        SpaceActionType::Poll,
    );
    action.status = Some(status);
    action.depends_on = depends_on.into();
    action.required_attributes = required_attributes.into();
    action.save().await.expect("save action");

    poll.poll_id
}

/// Seed an Ongoing, Published space owned by `ctx.test_user` (Creator).
async fn seed_space(ctx: &TestContext) -> Seeded {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space = SpaceCommon {
        space_pk: Partition::Space(space_id.clone()).to_string(),
        created_at: now,
        updated_at: now,
        status: Some(SpaceStatus::Ongoing),
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
        title: "Space Admin Action Bypass Test Space".to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    let space_partition = crate::common::types::SpacePartition(space_id.clone());

    let gating_poll_id =
        seed_poll(&space_partition, SpaceActionStatus::Ongoing, vec![], vec![]).await;
    let attribute_rule = || RequiredAttributeRule {
        poll_action_id: gating_poll_id.clone(),
        question_index: 0,
        allowed_values: vec!["Yes".to_string()],
    };
    let dependent_poll_id = seed_poll(
        &space_partition,
        SpaceActionStatus::Ongoing,
        vec![gating_poll_id.clone()],
        vec![],
    )
    .await;
    let attribute_poll_id = seed_poll(
        &space_partition,
        SpaceActionStatus::Ongoing,
        vec![],
        vec![attribute_rule()],
    )
    .await;
    let designing_poll_id = seed_poll(
        &space_partition,
        SpaceActionStatus::Designing,
        vec![gating_poll_id.clone()],
        vec![attribute_rule()],
    )
    .await;

    Seeded {
        space_id,
        gating_poll_id,
        dependent_poll_id,
        attribute_poll_id,
        designing_poll_id,
    }
}

async fn respond_yes(
    ctx: &TestContext,
    headers: &axum::http::HeaderMap,
    space_id: &str,
    poll_id: &str,
) -> (axum::http::StatusCode, serde_json::Value) {
    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: headers.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "single_choice", "answer": 0 }
                ]
            }
        }
    };
    (status, body)
}

async fn join_as_participant(ctx: &TestContext, space_id: &str) -> axum::http::HeaderMap {
    let participant = ctx.create_another_user().await;
    SpaceParticipant::new(Partition::Space(space_id.to_string()), participant.0.pk())
        .create()
        .await
        .expect("create participant");
    participant.1
}

#[by_macros::pg_test]
async fn participant_blocked_by_unmet_dependency() {
    let ctx = TestContext::setup().await;
    let seeded = seed_space(&ctx).await;
    let headers = join_as_participant(&ctx, &seeded.space_id).await;

    let (status, body) =
        respond_yes(&ctx, &headers, &seeded.space_id, &seeded.dependent_poll_id).await;
    assert_ne!(status, 200, "dependency must gate a Participant: {:?}", body);
}

#[by_macros::pg_test]
async fn participant_blocked_by_unmet_required_attributes() {
    let ctx = TestContext::setup().await;
    let seeded = seed_space(&ctx).await;
    let headers = join_as_participant(&ctx, &seeded.space_id).await;

    let (status, body) =
        respond_yes(&ctx, &headers, &seeded.space_id, &seeded.attribute_poll_id).await;
    assert_ne!(
        status, 200,
        "required attributes must gate a Participant: {:?}",
        body
    );
}

#[by_macros::pg_test]
async fn participant_blocked_on_designing_action() {
    let ctx = TestContext::setup().await;
    let seeded = seed_space(&ctx).await;
    let headers = join_as_participant(&ctx, &seeded.space_id).await;

    let (status, body) = respond_yes(&ctx, &headers, &seeded.space_id, &seeded.gating_poll_id).await;
    assert_eq!(status, 200, "respond gating poll: {:?}", body);

    let (status, body) =
        respond_yes(&ctx, &headers, &seeded.space_id, &seeded.designing_poll_id).await;
    assert_ne!(
        status, 200,
        "a Designing action must stay closed to a Participant: {:?}",
        body
    );
}

#[by_macros::pg_test]
async fn creator_runs_actions_with_unmet_gates() {
    let ctx = TestContext::setup().await;
    let seeded = seed_space(&ctx).await;
    let headers = ctx.test_user.1.clone();

    for poll_id in [
        &seeded.dependent_poll_id,
        &seeded.attribute_poll_id,
        &seeded.designing_poll_id,
    ] {
        let (status, body) = respond_yes(&ctx, &headers, &seeded.space_id, poll_id).await;
        assert_eq!(
            status, 200,
            "Creator must bypass dependencies, required attributes and Designing status ({}): {:?}",
            poll_id, body
        );
    }
}

#[by_macros::pg_test]
async fn list_actions_reports_gates_met_for_creator() {
    let ctx = TestContext::setup().await;
    let seeded = seed_space(&ctx).await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", seeded.space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);

    let designing = body
        .as_array()
        .expect("list_actions returns an array")
        .iter()
        .find(|a| a["action_id"] == seeded.designing_poll_id)
        .expect("Creator sees the Designing action");
    assert_eq!(designing["dependencies_met"], true);
    assert_eq!(designing["required_attributes_met"], true);
}
