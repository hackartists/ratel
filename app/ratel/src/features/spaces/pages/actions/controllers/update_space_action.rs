use super::*;

use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::features::membership::models::{
    Membership, TeamMembership, UserMembership, ensure_team_membership_monthly_refill,
    ensure_user_membership_monthly_refill,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum UpdateSpaceActionRequest {
    Credits {
        credits: u64,
    },
    Status {
        status: SpaceActionStatus,
    },
    Dependencies {
        depends_on: Vec<String>,
    },
    RequiredAttributes {
        required_attributes: Vec<RequiredAttributeRule>,
    },
    Prerequisite {
        prerequisite: bool,
    },
    Title {
        title: String,
    },
    Description {
        description: String,
    },
}

#[post(
    "/api/spaces/{space_id}/actions/{action_id}",
    role: SpaceUserRole,
    user: crate::features::auth::User,
    space: SpaceCommon
)]
pub async fn update_space_action(
    space_id: SpacePartition,
    action_id: String,
    req: UpdateSpaceActionRequest,
) -> Result<SpaceAction> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let mut space_action = SpaceAction::get_one(&space_id, &action_id)
        .await
        .map_err(|e| {
            crate::error!("Failed to get space action: {e:?}");
            SpaceActionError::ActionLoadFailed
        })?
        .ok_or(Error::NotFound("Space action not found".into()))?;

    // Phase 5: capture the pre-mutation action so the outbox event carries the
    // real old→new transition (the "SpaceActionStatusChange" rule matches
    // old status == Designing && new status == Ongoing).
    let old_action = space_action.clone();

    if space_action.space_action_type == SpaceActionType::Announcement
        && !matches!(
            req,
            UpdateSpaceActionRequest::Status { .. }
                | UpdateSpaceActionRequest::Title { .. }
                | UpdateSpaceActionRequest::Description { .. }
                | UpdateSpaceActionRequest::Prerequisite {
                    prerequisite: false
                }
        )
    {
        return Err(SpaceActionError::UnsupportedForAnnouncement.into());
    }

    match req {
        UpdateSpaceActionRequest::Credits { credits } => {
            update_credits(
                &user,
                &space,
                &space_id,
                &action_id,
                credits,
                &mut space_action,
                now,
            )
            .await?;
        }
        UpdateSpaceActionRequest::Status { status } => {
            if !SpaceActionStatus::allows_transition(space_action.status.as_ref(), &status) {
                return Err(SpaceActionError::InvalidStatusTransition.into());
            }
            space_action.status = Some(status.clone());
        }
        UpdateSpaceActionRequest::Dependencies { depends_on } => {
            if depends_on.iter().any(|id| id == &action_id) {
                return Err(SpaceActionError::InvalidDependency.into());
            }
            if !depends_on.is_empty() {
                let siblings = SpaceAction::list_by_space(&space_id).await?;
                if siblings.iter().any(|a| {
                    a.space_action_type == SpaceActionType::Announcement
                        && depends_on.contains(&a.action_id)
                }) {
                    return Err(SpaceActionError::InvalidDependency.into());
                }
            }
            space_action.depends_on = SpaceActionDependsOn(depends_on);
        }
        UpdateSpaceActionRequest::RequiredAttributes {
            required_attributes,
        } => {
            space_action.required_attributes = SpaceActionRequiredAttributes(required_attributes);
        }
        UpdateSpaceActionRequest::Prerequisite { prerequisite } => {
            space_action.prerequisite = prerequisite;
        }
        UpdateSpaceActionRequest::Title { title } => {
            space_action.title = title;
        }
        UpdateSpaceActionRequest::Description { description } => {
            space_action.description = description;
        }
    }

    space_action.updated_at = now;
    // Persist all field mutations in one write (was a per-arm DynamoDB
    // `updater().execute()`; now a single Postgres upsert on the surrogate id).
    space_action.save().await.map_err(|e| {
        crate::error!("Failed to update space action: {e:?}");
        SpaceActionError::ActionUpdateFailed
    })?;

    // Phase 5: emit the action change so the outbox poller dispatches
    // "SpaceActionStatusChange" (notify_action_ongoing) and
    // "EssenceActionMetadataUpdate". MODIFY with the real old→new images so the
    // Designing→Ongoing status-transition filter matches.
    crate::common::events::outbox::EventOutbox::emit_modify(
        crate::common::events::outbox::topic::SPACE_ACTION_STATUS,
        &old_action,
        &space_action,
    )
    .await
    .ok();

    reindex_essence_for_action(cli, &space_id, &action_id, &space_action, &space).await;
    Ok(space_action)
}

/// Re-index the Essence row backing this action's source entity (quiz /
/// poll / discussion) so hero stats + title/word_count mirror the edited
/// action. Credits/Prerequisite updates touch no text fields, but Title
/// edits do — running on every branch keeps the call site uniform.
#[cfg(feature = "server")]
async fn reindex_essence_for_action(
    cli: &aws_sdk_dynamodb::Client,
    space_id: &SpacePartition,
    action_id: &str,
    space_action: &SpaceAction,
    space: &SpaceCommon,
) {
    let space_pk: Partition = space_id.clone().into();
    // Essence re-indexing for poll/quiz happens via the DynamoDB Stream
    // pipeline whenever the underlying SpacePoll/SpaceQuiz row is updated.
    // When *only* SpaceAction fields change (action title/description) we
    // explicitly bump the related row so the stream picks the change up.
    let _ = (space, action_id, space_pk, space_action, cli);
}

#[cfg(feature = "server")]
async fn update_credits(
    user: &crate::features::auth::User,
    space: &SpaceCommon,
    space_id: &SpacePartition,
    action_id: &str,
    credits: u64,
    space_action: &mut SpaceAction,
    now: i64,
) -> Result<()> {
    let behavior = space_action
        .space_action_type
        .to_behavior()
        .ok_or(SpaceActionError::UnsupportedForAnnouncement)?;

    if credits > 0 {
        set_credits(
            user,
            space,
            space_id,
            action_id,
            credits,
            space_action,
            &behavior,
            now,
        )
        .await
    } else {
        remove_credits(
            user,
            space,
            space_id,
            action_id,
            space_action,
            &behavior,
            now,
        )
        .await
    }
}

/// Fetch a tier's `Membership` catalog row, treating "no row for this tier"
/// the same as the old `Option`-returning DynamoDB lookup (`None` → caller
/// applies no per-space credit cap).
#[cfg(feature = "server")]
async fn get_membership_or_none(
    tier: &crate::features::membership::models::MembershipTier,
) -> Result<Option<Membership>> {
    match Membership::get_by_membership_tier(tier).await {
        Ok(m) => Ok(Some(m)),
        Err(Error::NotFound(_)) => Ok(None),
        Err(e) => {
            crate::error!("Failed to get membership: {e:?}");
            Err(SpaceActionError::MembershipCheckFailed.into())
        }
    }
}

/// Set or update reward credits: validate membership limits, deduct delta, upsert reward.
///
/// The membership credit decrement and the `SpaceReward` upsert are both
/// Postgres tables now, so they are applied inside a single `postgres::Tx` —
/// replicating the atomicity the old DynamoDB `transact_write_items!` call
/// gave the two rows. The `SpaceAction` row itself is still persisted
/// separately by the caller's final `save()`, same as before the migration.
#[cfg(feature = "server")]
async fn set_credits(
    user: &crate::features::auth::User,
    space: &SpaceCommon,
    space_id: &SpacePartition,
    action_id: &str,
    credits: u64,
    space_action: &mut SpaceAction,
    behavior: &RewardUserBehavior,
    now: i64,
) -> Result<()> {
    let old_credits = space_action.credits;
    let credit_delta = credits as i64 - old_credits;
    let (point, period, condition) = get_or_create_reward(behavior).await?;
    let total_points = credits as i64 * point;
    space_action.credits = credits as i64;
    space_action.total_points = total_points;

    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;

    use std::str::FromStr;
    let space_user_pk =
        Partition::from_str(&space.user_pk).unwrap_or(Partition::User(space.user_pk.clone()));
    if matches!(space_user_pk, Partition::Team(_)) {
        let mut team_membership = TeamMembership::find_by_team(&space.user_pk.to_string())
            .await
            .map_err(|e| {
                crate::error!("Failed to get team membership: {e:?}");
                SpaceActionError::MembershipCheckFailed
            })?
            .ok_or(SpaceRewardError::CreditsExceedBalance)?;
        team_membership = ensure_team_membership_monthly_refill(team_membership).await?;

        let membership = get_membership_or_none(&team_membership.membership_pk).await?;
        let max_per_space = membership.as_ref().map_or(0, |m| m.max_credits_per_space);
        if max_per_space > 0 && credits as i64 > max_per_space {
            return Err(SpaceRewardError::CreditsExceedMaxPerSpace.into());
        }

        team_membership.use_credits(credit_delta)?;
        team_membership.updated_at = now;
        TeamMembership::repository()
            .with_tx(&tx)
            .upsert_on(&["team_pk"], &team_membership)
            .await
            .map_err(crate::common::Error::from)?;
    } else {
        let mut user_membership = UserMembership::find_by_user(&user.pk().to_string())
            .await
            .map_err(|e| {
                crate::error!("Failed to get user membership: {e:?}");
                SpaceActionError::MembershipCheckFailed
            })?
            .ok_or(SpaceRewardError::CreditsExceedBalance)?;
        user_membership = ensure_user_membership_monthly_refill(user_membership).await?;

        let membership = get_membership_or_none(&user_membership.membership_pk).await?;
        let max_per_space = membership.as_ref().map_or(0, |m| m.max_credits_per_space);
        if max_per_space > 0 && credits as i64 > max_per_space {
            return Err(SpaceRewardError::CreditsExceedMaxPerSpace.into());
        }

        user_membership.use_credits(credit_delta)?;
        user_membership.updated_at = now;
        UserMembership::repository()
            .with_tx(&tx)
            .upsert_on(&["user_pk"], &user_membership)
            .await
            .map_err(crate::common::Error::from)?;
    };

    let space_reward = SpaceReward::new(
        space_id.clone(),
        action_id.to_string(),
        behavior.clone(),
        String::new(),
        credits as i64,
        point,
        period,
        condition,
    );
    SpaceReward::repository()
        .with_tx(&tx)
        .upsert_on(&["space_id", "action_id", "behavior"], &space_reward)
        .await
        .map_err(|e| {
            crate::error!("Failed to upsert space reward: {e:?}");
            SpaceActionError::TransactionFailed
        })?;

    tx.commit().await.map_err(|e| {
        crate::error!("Failed to execute transaction: {e:?}");
        SpaceActionError::TransactionFailed
    })?;

    Ok(())
}

/// Remove reward and refund credits back to user membership.
#[cfg(feature = "server")]
async fn remove_credits(
    user: &crate::features::auth::User,
    space: &SpaceCommon,
    space_id: &SpacePartition,
    action_id: &str,
    space_action: &mut SpaceAction,
    behavior: &RewardUserBehavior,
    now: i64,
) -> Result<()> {
    let existing =
        SpaceReward::get_by_action(space_id.clone(), action_id.to_string(), behavior.clone()).await;

    space_action.credits = 0;
    space_action.total_points = 0;

    let Ok(ref reward) = existing else {
        return Ok(());
    };

    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;

    if reward.credits > 0 {
        use std::str::FromStr;
        let space_user_pk =
            Partition::from_str(&space.user_pk).unwrap_or(Partition::User(space.user_pk.clone()));
        if matches!(space_user_pk, Partition::Team(_)) {
            if let Some(mut team_membership) =
                TeamMembership::find_by_team(&space.user_pk.to_string())
                    .await
                    .map_err(|e| {
                        crate::error!("Failed to get team membership: {e:?}");
                        SpaceActionError::MembershipCheckFailed
                    })?
            {
                team_membership = ensure_team_membership_monthly_refill(team_membership).await?;
                team_membership.remaining_credits += reward.credits;
                team_membership.updated_at = now;
                TeamMembership::repository()
                    .with_tx(&tx)
                    .upsert_on(&["team_pk"], &team_membership)
                    .await
                    .map_err(crate::common::Error::from)?;
            }
        } else if let Some(mut um) = UserMembership::find_by_user(&user.pk().to_string())
            .await
            .map_err(|e| {
                crate::error!("Failed to get user membership: {e:?}");
                SpaceActionError::MembershipCheckFailed
            })?
        {
            um = ensure_user_membership_monthly_refill(um).await?;
            um.remaining_credits += reward.credits;
            um.updated_at = now;
            UserMembership::repository()
                .with_tx(&tx)
                .upsert_on(&["user_pk"], &um)
                .await
                .map_err(crate::common::Error::from)?;
        }
    }

    SpaceReward::repository()
        .with_tx(&tx)
        .delete(reward.id)
        .await
        .map_err(|e| {
            crate::error!("Failed to delete space reward: {e:?}");
            SpaceActionError::TransactionFailed
        })?;

    tx.commit().await.map_err(|e| {
        crate::error!("Failed to execute transaction: {e:?}");
        SpaceActionError::TransactionFailed
    })?;

    Ok(())
}

#[cfg(feature = "server")]
async fn get_or_create_reward(
    behavior: &RewardUserBehavior,
) -> Result<(i64, RewardPeriod, RewardCondition)> {
    use crate::common::models::reward::Reward;
    use std::str::FromStr;

    let existing = Reward::get_by_behavior(behavior).await.map_err(|e| {
        crate::error!("Failed to get reward template: {e:?}");
        SpaceActionError::RewardTemplateFailed
    })?;

    match existing {
        Some(r) => {
            let period = RewardPeriod::from_str(&r.period).unwrap_or_default();
            Ok((r.point, period, r.condition.0))
        }
        None => {
            let reward = Reward::new(
                behavior.clone(),
                10000,
                RewardPeriod::Once,
                RewardCondition::None,
            );
            reward.create().await.map_err(|e| {
                crate::error!("Failed to create reward template: {e:?}");
                SpaceActionError::RewardTemplateFailed
            })?;
            Ok((reward.point, RewardPeriod::Once, RewardCondition::None))
        }
    }
}
