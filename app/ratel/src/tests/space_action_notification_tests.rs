use super::*;
use crate::common::models::notification::{Notification, UserInboxNotification};
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::types::{
    InboxKind, InboxPayload, NotificationData, Partition, SpacePartition, SpacePublishState,
    SpaceStatus, SpaceVisibility,
};
use crate::features::posts::models::Post;
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::services::notify_action_ongoing;
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};
use postgres::PostgresEntity;

/// Insert a minimal space with a given status. Returns the SpaceCommon plus
/// the space partition for convenience.
async fn insert_space(
    _ctx: &TestContext,
    user_pk: Partition,
    status: Option<SpaceStatus>,
) -> (SpaceCommon, SpacePartition) {
    let post_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let space_pk = Partition::Space(post_id.clone());
    let post_pk = Partition::Feed(post_id);

    let mut space = SpaceCommon::default();
    space.id = uuid::Uuid::now_v7();
    space.space_pk = space_pk.to_string();
    space.created_at = now;
    space.updated_at = now;
    space.status = status;
    space.publish_state = SpacePublishState::Published;
    space.visibility = SpaceVisibility::Public;
    space.post_pk = post_pk.to_string();
    space.user_pk = user_pk.to_string();
    space.author_display_name = "user".to_string();
    space.author_profile_url = String::new();
    space.author_username = "user".to_string();
    space.create().await.unwrap();

    let post_uuid = match &post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).unwrap(),
        _ => unreachable!(),
    };
    let post = Post {
        id: post_uuid,
        title: "Test Space Title".to_string(),
        ..Default::default()
    };
    post.create().await.unwrap();

    let space_id: SpacePartition = space_pk.into();
    (space, space_id)
}

/// Build an Ongoing-status SpaceAction. The action is whatever the caller
/// passes to the notify handler; the row itself doesn't need to be in the DB
/// for the test (the handler operates on the value it receives).
fn make_ongoing_action(
    space_id: SpacePartition,
    title: &str,
    action_type: SpaceActionType,
) -> SpaceAction {
    let mut action = SpaceAction::new(space_id, uuid::Uuid::new_v4().to_string(), action_type);
    action.title = title.to_string();
    action.status = Some(SpaceActionStatus::Ongoing);
    action
}

async fn join_space(_ctx: &TestContext, space_pk: &Partition, user_pk: Partition) {
    let participant = SpaceParticipant::new(space_pk.clone(), user_pk);
    participant.create().await.unwrap();
}

async fn inbox_rows_for(
    _ctx: &TestContext,
    user_pk: Partition,
) -> Vec<UserInboxNotification> {
    let user_id = match &user_pk {
        Partition::User(id) => id.clone(),
        other => other.to_string(),
    };
    UserInboxNotification::find_for_user(&user_id, false, 1, 1000)
        .await
        .expect("query inbox rows failed")
        .items
}

async fn notifications_matching(
    _ctx: &TestContext,
    filter: impl Fn(&Notification) -> bool,
) -> Vec<Notification> {
    let rows = Notification::repository()
        .find(Notification::query())
        .await
        .expect("query notifications failed")
        .items;
    rows.into_iter().filter(|n| filter(n)).collect()
}

/// Happy path: ongoing space + one participant → inbox row + email Notification row.
#[tokio::test]
async fn test_notify_action_ongoing_creates_inbox_and_email() {
    let ctx = TestContext::setup().await;
    let owner_pk = ctx.test_user.0.pk();

    let (space, space_id) = insert_space(&ctx, owner_pk, Some(SpaceStatus::Ongoing)).await;

    let participant = create_test_user(&ctx.ddb).await;
    join_space(&ctx, &space.partition(), participant.pk()).await;

    let action = make_ongoing_action(space_id, "Vote on the proposal", SpaceActionType::Poll);

    notify_action_ongoing(action.clone()).await.expect("handler failed");

    let rows = inbox_rows_for(&ctx, participant.pk()).await;
    let action_rows: Vec<_> = rows
        .iter()
        .filter(|r| r.kind == InboxKind::SpaceActionOngoing)
        .collect();
    assert_eq!(
        action_rows.len(),
        1,
        "expected exactly one SpaceActionOngoing inbox row, got {} (all rows: {:?})",
        action_rows.len(),
        rows.iter().map(|r| r.kind).collect::<Vec<_>>()
    );

    match &action_rows[0].payload {
        InboxPayload::SpaceActionOngoing {
            action_id,
            action_title,
            ..
        } => {
            assert_eq!(action_id, &action.action_id);
            assert_eq!(action_title, "Vote on the proposal");
        }
        other => panic!("expected SpaceActionOngoing payload, got {:?}", other),
    }

    let emails = notifications_matching(&ctx, |n| {
        if let NotificationData::SpaceActionOngoing {
            emails,
            action_title,
            ..
        } = &n.data
        {
            action_title == "Vote on the proposal" && emails.contains(&participant.email)
        } else {
            false
        }
    })
    .await;
    assert!(
        !emails.is_empty(),
        "expected at least one SpaceActionOngoing email Notification row covering the participant"
    );
}

/// Dedup: the same action firing twice produces only one inbox row per participant.
#[tokio::test]
async fn test_notify_action_ongoing_is_idempotent_per_action() {
    let ctx = TestContext::setup().await;
    let owner_pk = ctx.test_user.0.pk();

    let (space, space_id) = insert_space(&ctx, owner_pk, Some(SpaceStatus::Ongoing)).await;

    let participant = create_test_user(&ctx.ddb).await;
    join_space(&ctx, &space.partition(), participant.pk()).await;

    let action = make_ongoing_action(space_id, "Quiz me", SpaceActionType::Quiz);

    notify_action_ongoing(action.clone()).await.expect("first call failed");
    notify_action_ongoing(action.clone()).await.expect("second call failed");

    let rows = inbox_rows_for(&ctx, participant.pk()).await;
    let action_rows: Vec<_> = rows
        .iter()
        .filter(|r| r.kind == InboxKind::SpaceActionOngoing)
        .collect();
    assert_eq!(
        action_rows.len(),
        1,
        "second invocation should be deduped; got {} rows",
        action_rows.len()
    );
}

/// Guard: parent space not Ongoing → no inbox row created.
#[tokio::test]
async fn test_notify_action_ongoing_skipped_when_space_not_ongoing() {
    let ctx = TestContext::setup().await;
    let owner_pk = ctx.test_user.0.pk();

    let (space, space_id) = insert_space(&ctx, owner_pk, Some(SpaceStatus::Open)).await;

    let participant = create_test_user(&ctx.ddb).await;
    join_space(&ctx, &space.partition(), participant.pk()).await;

    let action = make_ongoing_action(space_id, "Should not fire", SpaceActionType::Follow);

    notify_action_ongoing(action).await.expect("handler failed");

    let rows = inbox_rows_for(&ctx, participant.pk()).await;
    let any_action_rows = rows
        .iter()
        .any(|r| r.kind == InboxKind::SpaceActionOngoing);
    assert!(
        !any_action_rows,
        "expected zero SpaceActionOngoing inbox rows when parent space is not Ongoing"
    );
}

/// Guard: zero participants → handler returns Ok and writes nothing.
#[tokio::test]
async fn test_notify_action_ongoing_no_participants_is_noop() {
    let ctx = TestContext::setup().await;
    let owner_pk = ctx.test_user.0.pk();

    let (_space, space_id) = insert_space(&ctx, owner_pk, Some(SpaceStatus::Ongoing)).await;

    let action = make_ongoing_action(space_id, "Nobody hears", SpaceActionType::Meet);

    let result = notify_action_ongoing(action).await;
    assert!(result.is_ok(), "handler should return Ok with no participants");
}
