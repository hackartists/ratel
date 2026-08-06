use crate::features::activity::models::SpaceActivity;
use crate::features::activity::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Fixed XP values per activity type
#[cfg(feature = "server")]
pub const XP_FOLLOW: i64 = 1_000;
#[cfg(feature = "server")]
pub const XP_QUIZ_PASSED: i64 = 20_000;
#[cfg(feature = "server")]
pub const XP_QUIZ_FAILED: i64 = 1_000;
#[cfg(feature = "server")]
pub const XP_DISCUSSION_REPLY: i64 = 5_000;
#[cfg(feature = "server")]
pub const XP_POLL: i64 = 50_000;

#[cfg(feature = "server")]
fn calculate_xp(data: &SpaceActivityData) -> i64 {
    match data {
        SpaceActivityData::Poll { .. } => XP_POLL,
        SpaceActivityData::Follow { .. } => XP_FOLLOW,
        SpaceActivityData::Quiz { passed, .. } => {
            if *passed {
                XP_QUIZ_PASSED
            } else {
                XP_QUIZ_FAILED
            }
        }
        SpaceActivityData::Discussion { .. } => XP_DISCUSSION_REPLY,
        SpaceActivityData::Unknown => 0,
    }
}

#[cfg(feature = "server")]
fn dedup_key(action_id: &str, data: &SpaceActivityData) -> String {
    match data {
        // Discussion: each comment earns separate XP, so include comment_id
        SpaceActivityData::Discussion { comment_id, .. } => {
            format!("{}#comment#{}", action_id, comment_id)
        }
        // Poll, Quiz, Follow: one XP per user per action
        _ => action_id.to_string(),
    }
}

#[cfg(feature = "server")]
pub async fn record_activity(
    space_id: SpacePartition,
    author: AuthorPartition,
    action_id: String,
    action_type: crate::features::spaces::pages::actions::types::SpaceActionType,
    data: SpaceActivityData,
    user_name: String,
    user_avatar: String,
) -> crate::common::Result<()> {
    use postgres::ops::StringOp;

    let xp = calculate_xp(&data);
    let dedup = dedup_key(&action_id, &data);

    // Check for duplicate: an existing activity row for the same
    // (space_id, author, dedup_key). This prevents double-counting when both
    // the stream handler and the EventBridge Lambda process the same event.
    let existing = SpaceActivity::repository()
        .find_one(
            SpaceActivity::query()
                .space_id(StringOp::Eq(space_id.0.clone()))
                .author_pk(StringOp::Eq(author.to_string()))
                .dedup_key(StringOp::Eq(dedup.clone())),
        )
        .await
        .map_err(crate::features::activity::models::map_db_err)?;
    if existing.is_some() {
        tracing::warn!(
            action_id = %action_id,
            action_type = ?action_type,
            "activity already recorded — skipping duplicate"
        );
        return Ok(());
    }

    let activity = SpaceActivity::new_with_dedup(
        space_id,
        author,
        action_id.clone(),
        action_type.clone(),
        data,
        xp,
        0,
        user_name,
        user_avatar,
        dedup.clone(),
    )
    .await;
    SpaceActivity::repository()
        .insert(&activity)
        .await
        .map_err(crate::features::activity::models::map_db_err)?;
    tracing::info!(
        action_id = %action_id,
        action_type = ?action_type,
        xp = xp,
        "recorded new activity"
    );
    Ok(())
}
