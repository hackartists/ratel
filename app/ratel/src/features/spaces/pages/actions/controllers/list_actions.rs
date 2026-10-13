use super::*;
#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
#[cfg(feature = "server")]
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::discussion::{SpacePost, SpacePostComment};
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::follow::SpaceFollowUser;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::poll::SpacePollUserAnswer;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::quiz::{SpaceQuiz, SpaceQuizAttempt};
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use std::collections::{HashMap, HashSet};

#[mcp_tool(
    name = "list_actions",
    description = "List all actions in a space (polls, quizzes, discussions, follow). Shows action type, title, status, and dependency state."
)]
#[get("/api/spaces/{space_pk}/actions", role: SpaceUserRole, user: OptionalUser, space: SpaceCommon)]
pub async fn list_actions(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
) -> Result<Vec<SpaceActionSummary>> {
    let space_id = space_pk;
    let space_pk: Partition = space_id.clone().into();

    let space_actions = SpaceAction::list_by_space(&space_id).await.map_err(|e| {
        crate::error!("failed to load actions: {e:?}");
        SpaceActionError::ActionLoadFailed
    })?;

    let mut actions: Vec<SpaceActionSummary> = space_actions.into_iter().map(Into::into).collect();

    // Enrich discussion actions with their current comment count.
    let discussion_ids: Vec<String> = actions
        .iter()
        .filter(|a| a.action_type == SpaceActionType::TopicDiscussion)
        .map(|a| a.action_id.clone())
        .collect();
    if !discussion_ids.is_empty() {
        let posts = SpacePost::repository()
            .find(
                SpacePost::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .post_id(StringOp::In(discussion_ids)),
            )
            .await
            .map(|p| p.items)
            .map_err(|e| {
                crate::error!("failed to load discussion posts: {e:?}");
                SpaceActionError::ActionLoadFailed
            })?;
        let count_by_id: HashMap<String, i64> =
            posts.into_iter().map(|p| (p.post_id, p.comments)).collect();
        for action in actions.iter_mut() {
            if action.action_type == SpaceActionType::TopicDiscussion {
                action.comment_count =
                    Some(count_by_id.get(&action.action_id).copied().unwrap_or(0));
            }
        }
    }

    let current_user = user.0;
    for action in actions.iter_mut() {
        // Quiz: always enrich quiz scores
        if action.action_type == SpaceActionType::Quiz {
            let quiz_id: SpaceQuizEntityType = action.action_id.clone().into();

            if let Some(quiz) = SpaceQuiz::get_one(&space_id, &quiz_id).await? {
                action.quiz_total_score = Some(quiz.questions.len() as i64);

                if let Some(user) = current_user.as_ref() {
                    if let Some(attempt) =
                        SpaceQuizAttempt::find_latest_by_quiz_user(&quiz_id, &user.pk()).await?
                    {
                        action.quiz_score = Some(attempt.score);
                        action.quiz_passed = Some(attempt.score >= quiz.pass_score);
                        action.user_participated = true;
                    }
                }
            }
            continue;
        }

        if let Some(user) = current_user.as_ref() {
            match action.action_type {
                SpaceActionType::Poll => {
                    let poll_sk = EntityType::SpacePoll(action.action_id.clone());
                    if let Ok(Some(answer)) =
                        SpacePollUserAnswer::find_one(&space_pk, &poll_sk, &user.pk()).await
                    {
                        action.user_participated = answer.completed;
                    }
                }
                SpaceActionType::TopicDiscussion => {
                    action.user_participated =
                        has_completed_discussion_action(&action.action_id, &user.pk()).await?;
                }
                SpaceActionType::Follow => {
                    action.user_participated =
                        has_completed_follow_action(&space_id, &space_pk, &user.pk()).await?;
                }
                SpaceActionType::Announcement => {
                    action.user_participated =
                        SpaceAnnouncementRead::exists(&space_id, &action.action_id, &user.pk())
                            .await?;
                }
                _ => {}
            }
        }
    }

    let participated_by_id: HashMap<String, bool> = actions
        .iter()
        .map(|a| (a.action_id.clone(), a.user_participated))
        .collect();

    let is_creator = matches!(role, SpaceUserRole::Creator);

    for action in actions.iter_mut() {
        if is_creator || action.depends_on.is_empty() {
            action.dependencies_met = true;
            continue;
        }
        action.dependencies_met = current_user.is_some()
            && action
                .depends_on
                .iter()
                .all(|dep_id| participated_by_id.get(dep_id).copied().unwrap_or(false));
    }

    for action in actions.iter_mut() {
        if is_creator || action.required_attributes.is_empty() {
            action.required_attributes_met = true;
            continue;
        }
        action.required_attributes_met = match current_user.as_ref() {
            Some(user) => {
                let full_action =
                    crate::features::spaces::pages::actions::models::SpaceAction::get_one(
                        &space_id,
                        &action.action_id,
                    )
                    .await?
                    .ok_or(Error::SpaceActionNotFound)?;
                crate::features::spaces::pages::actions::services::required_attributes::required_attributes_met(
                    &space,
                    &full_action,
                    &user.pk(),
                )
                .await?
            }
            None => false,
        };
    }

    // Required Attributes gate: hide an action from non-Creator roles once it
    // declares at least one rule and the viewer doesn't satisfy it. Creators
    // (admins/operators) always see every action regardless of this gate —
    // same carve-out as the status/prerequisite `retain` below.
    if !matches!(role, SpaceUserRole::Creator) {
        actions.retain(|a| a.required_attributes.is_empty() || a.required_attributes_met);
    }

    if !matches!(role, SpaceUserRole::Creator) {
        actions.retain(|a| {
            a.prerequisite
                || matches!(
                    a.status,
                    Some(SpaceActionStatus::Ongoing | SpaceActionStatus::Finish)
                )
        });
    }

    if !matches!(role, SpaceUserRole::Creator) {
        let has_pre_actions = actions.iter().any(|a| a.prerequisite);
        if has_pre_actions {
            let all_pre_actions_done = actions
                .iter()
                .filter(|a| a.prerequisite)
                .all(|a| a.user_participated);

            if should_only_show_prerequisite_actions(
                space.status.clone(),
                space.join_anytime,
                all_pre_actions_done,
            ) {
                actions
                    .retain(|a| a.prerequisite || a.action_type == SpaceActionType::Announcement);
            }
        }
    }

    actions.sort_by_key(|a| a.action_type != SpaceActionType::Announcement);

    debug!("actions: {:?}", actions);
    Ok(actions)
}

#[cfg(feature = "server")]
async fn has_completed_discussion_action(action_id: &str, user_pk: &Partition) -> Result<bool> {
    // Any comment (top-level or reply) by this user on the discussion counts.
    let page = SpacePostComment::repository()
        .find(
            SpacePostComment::query()
                .post_id(StringOp::Eq(action_id.to_string()))
                .author_pk(StringOp::Eq(user_pk.to_string()))
                .page(1)
                .page_size(1),
        )
        .await
        .map_err(|e| {
            crate::error!("failed to verify discussion prerequisite: {e}");
            SpaceActionError::ActionLoadFailed
        })?;
    Ok(!page.items.is_empty())
}

#[cfg(feature = "server")]
async fn has_completed_follow_action(
    space_id: &SpacePartition,
    space_pk: &Partition,
    user_pk: &Partition,
) -> Result<bool> {
    let space = SpaceCommon::get_by_partition(space_pk)
        .await?
        .ok_or_else(|| Error::NotFound("space not found".to_string()))?;

    let mut target_user_pks = Vec::new();
    let mut bookmark: Option<String> = None;
    loop {
        let (users, next) = SpaceFollowUser::list_by_space(space_id, bookmark, 100)
            .await
            .map_err(|err| {
                crate::error!("failed to load follow prerequisite targets: {err}");
                SpaceActionError::ActionLoadFailed
            })?;
        let none_str = Partition::None.to_string();
        target_user_pks.extend(
            users
                .into_iter()
                .filter(|u| u.user_pk != none_str)
                .map(|u| u.user_partition()),
        );
        if next.is_none() {
            break;
        }
        bookmark = next;
    }

    use std::str::FromStr;
    let space_user_pk =
        Partition::from_str(&space.user_pk).unwrap_or(Partition::User(space.user_pk.clone()));
    if !target_user_pks
        .iter()
        .any(|target| target == &space_user_pk)
    {
        target_user_pks.push(space_user_pk);
    }

    let mut deduped_targets = Vec::new();
    let mut seen = HashSet::new();
    for target_user_pk in target_user_pks {
        let target_key = target_user_pk.to_string();
        if seen.insert(target_key) {
            deduped_targets.push(target_user_pk);
        }
    }

    if deduped_targets.is_empty() {
        return Ok(true);
    }

    let follows = UserFollow::following_targets_in(user_pk, &deduped_targets)
        .await
        .map_err(|err| {
            crate::error!("failed to verify follow prerequisite: {err}");
            SpaceActionError::ActionLoadFailed
        })?;

    Ok(follows.len() == deduped_targets.len())
}

fn should_only_show_prerequisite_actions(
    status: Option<SpaceStatus>,
    join_anytime: bool,
    all_pre_actions_done: bool,
) -> bool {
    if all_pre_actions_done {
        return false;
    }

    match status {
        Some(SpaceStatus::Ongoing) | Some(SpaceStatus::Finished) => join_anytime,
        _ => true,
    }
}
