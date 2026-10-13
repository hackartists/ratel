//! Regression coverage for `list_actions`'s Required Attributes gate: an
//! action that declares `required_attributes` must be hidden from non-Creator
//! roles until the viewer satisfies every rule, while Creator (admin/
//! operator) retains full visibility regardless of the gate — same carve-out
//! the status/prerequisite `retain` already gets.
use super::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
use crate::features::spaces::pages::actions::actions::poll::types::{ChoiceQuestion, Question};
use crate::features::spaces::pages::actions::models::{RequiredAttributeRule, SpaceAction};
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};

/// Seed an Ongoing, owner-is-Creator space with:
/// - a "gating" poll (single-choice, options `["Yes", "No"]`) + its Ongoing
///   companion `SpaceAction`.
/// - a "gated" poll + Ongoing companion `SpaceAction` whose
///   `required_attributes` is satisfied only when the viewer answered the
///   gating poll's question 0 with "Yes".
///
/// Returns `(space_id, gating_poll_id, gated_poll_id)`.
async fn seed_gated_space(ctx: &TestContext) -> (String, String, String) {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space_pk = Partition::Space(space_id.clone());
    let post_pk = Partition::Feed(space_id.clone());

    let space = SpaceCommon {
        space_pk: space_pk.to_string(),
        created_at: now,
        updated_at: now,
        status: Some(SpaceStatus::Ongoing),
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: post_pk.to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        author_display_name: ctx.test_user.0.display_name.clone(),
        author_profile_url: ctx.test_user.0.profile_url.clone(),
        author_username: ctx.test_user.0.username.clone(),
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = crate::features::posts::models::Post {
        id: uuid::Uuid::parse_str(&space_id).expect("space_id is a valid uuid"),
        title: "Required Attributes Gating Test Space".to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    let space_partition = crate::common::types::SpacePartition(space_id.clone());

    // Gating poll: single-choice question with options ["Yes", "No"].
    let mut gating_poll = SpacePoll::new(space_partition.clone()).expect("new gating poll");
    gating_poll
        .questions
        .0
        .push(Question::SingleChoice(ChoiceQuestion {
            title: "Do you agree?".to_string(),
            description: None,
            image_url: None,
            options: vec!["Yes".to_string(), "No".to_string()],
            is_required: Some(true),
            allow_other: None,
            display_condition: None,
            terminate_on: vec![],
        }));
    SpacePoll::repository()
        .insert(&gating_poll)
        .await
        .expect("save gating poll");

    let mut gating_action = SpaceAction::new(
        space_partition.clone(),
        gating_poll.poll_id.clone(),
        SpaceActionType::Poll,
    );
    gating_action.status = Some(SpaceActionStatus::Ongoing);
    gating_action.save().await.expect("save gating action");

    // Gated poll: no questions of its own; gated purely by required_attributes.
    let gated_poll = SpacePoll::new(space_partition.clone()).expect("new gated poll");
    SpacePoll::repository()
        .insert(&gated_poll)
        .await
        .expect("save gated poll");

    let mut gated_action = SpaceAction::new(
        space_partition.clone(),
        gated_poll.poll_id.clone(),
        SpaceActionType::Poll,
    );
    gated_action.status = Some(SpaceActionStatus::Ongoing);
    gated_action.required_attributes = vec![RequiredAttributeRule {
        poll_action_id: gating_poll.poll_id.clone(),
        question_index: 0,
        allowed_values: vec!["Yes".to_string()],
    }]
    .into();
    gated_action.save().await.expect("save gated action");

    (space_id, gating_poll.poll_id, gated_poll.poll_id)
}

fn action_ids(body: &serde_json::Value) -> Vec<String> {
    body.as_array()
        .expect("list_actions returns an array")
        .iter()
        .map(|a| a["action_id"].as_str().unwrap().to_string())
        .collect()
}

/// Non-Creator viewer who has not satisfied the gate: the gated action must
/// not appear in `list_actions` at all, even though the server computed
/// `required_attributes_met: false` for it internally.
#[by_macros::pg_test]
async fn list_actions_hides_ungated_action_for_participant() {
    let ctx = TestContext::setup().await;
    let (space_id, _gating_poll_id, gated_poll_id) = seed_gated_space(&ctx).await;

    let participant = ctx.create_another_user().await;
    SpaceParticipant::new(
        Partition::Space(space_id.clone()),
        participant.0.pk(),
    )
    .create()
    .await
    .expect("create participant");

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: participant.1.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);

    let ids = action_ids(&body);
    assert!(
        !ids.contains(&gated_poll_id),
        "gated action must be hidden until required_attributes_met: {:?}",
        ids
    );
}

/// Once the participant satisfies the gate (answers the gating poll's
/// question 0 with an allowed value), the gated action becomes visible.
#[by_macros::pg_test]
async fn list_actions_shows_gated_action_once_requirement_met() {
    let ctx = TestContext::setup().await;
    let (space_id, gating_poll_id, gated_poll_id) = seed_gated_space(&ctx).await;

    let participant = ctx.create_another_user().await;
    SpaceParticipant::new(
        Partition::Space(space_id.clone()),
        participant.0.pk(),
    )
    .create()
    .await
    .expect("create participant");

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, gating_poll_id),
        headers: participant.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "single_choice", "answer": 0 }
                ]
            }
        }
    };
    assert_eq!(status, 200, "respond_poll: {:?}", body);

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: participant.1.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);

    let ids = action_ids(&body);
    assert!(
        ids.contains(&gated_poll_id),
        "gated action must be visible once required_attributes_met: {:?}",
        ids
    );

    let gated = body
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["action_id"] == gated_poll_id)
        .expect("gated action present");
    assert_eq!(gated["required_attributes_met"], true);
}

/// Creator (admin/operator) always sees every action, including a gated one
/// the Creator itself has not (and structurally cannot usefully) satisfied
/// the gate for.
#[by_macros::pg_test]
async fn list_actions_creator_sees_ungated_action_regardless_of_gate() {
    let ctx = TestContext::setup().await;
    let (space_id, _gating_poll_id, gated_poll_id) = seed_gated_space(&ctx).await;

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/actions", space_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "list_actions: {:?}", body);

    let ids = action_ids(&body);
    assert!(
        ids.contains(&gated_poll_id),
        "Creator must always see the gated action: {:?}",
        ids
    );

    let gated = body
        .as_array()
        .unwrap()
        .iter()
        .find(|a| a["action_id"] == gated_poll_id)
        .expect("gated action present");
    assert_eq!(
        gated["required_attributes_met"], true,
        "Creator bypasses the gate, so the computed flag is reported as met"
    );
}
