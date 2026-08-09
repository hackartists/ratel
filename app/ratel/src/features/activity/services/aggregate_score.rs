use crate::features::activity::models::SpaceScore;
use crate::features::activity::*;

#[cfg(feature = "server")]
pub async fn aggregate_score(
    activity: crate::features::activity::models::SpaceActivity,
) -> crate::common::Result<()> {
    use crate::features::spaces::pages::actions::types::SpaceActionType;

    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space_id = SpacePartition(activity.space_id.clone());
    let author: AuthorPartition = activity
        .author_pk
        .parse()
        .unwrap_or(AuthorPartition::Unknown);

    // Get existing score or start from a fresh one for this (space, author).
    // Read-modify-write: not atomic against a concurrent aggregation of the
    // same participant — matches the prior DynamoDB get-then-update semantics.
    let mut score = SpaceScore::get_for(&space_id, &author)
        .await?
        .unwrap_or_else(|| {
            SpaceScore::new(
                space_id.clone(),
                author.clone(),
                activity.user_name.clone(),
                activity.user_avatar.clone(),
            )
        });

    score.total_score += activity.total_score;
    score.rank_total_score = score.total_score;

    match activity.action_type() {
        SpaceActionType::Poll => score.poll_score += activity.total_score,
        SpaceActionType::Quiz => score.quiz_score += activity.total_score,
        SpaceActionType::Follow => score.follow_score += activity.total_score,
        SpaceActionType::TopicDiscussion => score.discussion_score += activity.total_score,
        // Meet actions are not yet tracked in per-category score breakdowns.
        SpaceActionType::Meet => {}
    }

    // Refresh the denormalized identity/display fields from the activity.
    score.user_name = activity.user_name;
    score.user_avatar = activity.user_avatar;
    score.updated_at = now;

    score.save().await?;
    // Phase 5: emit so the outbox poller dispatches "CharacterXpDelta"
    // (apply_character_xp_delta) — matches the SPACE_SCORE routing token.
    crate::common::events::outbox::EventOutbox::emit_insert(
        crate::common::events::outbox::topic::SPACE_SCORE,
        &score,
    )
    .await
    .ok();
    Ok(())
}
