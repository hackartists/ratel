use super::*;
#[cfg(feature = "server")]
use crate::common::Partition;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::aggregate::DashboardAggregate;

#[delete("/api/spaces/{space_id}/actions/{action_id}", role: SpaceUserRole, space: crate::common::models::space::SpaceCommon)]
pub async fn delete_space_action(space_id: SpacePartition, action_id: String) -> Result<()> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_action = SpaceAction::get_one(&space_id, &action_id)
        .await?
        .ok_or(Error::NotFound("Action not found".into()))?;

    // Once the action has been published (Ongoing / Finish) it is locked —
    // creators can no longer delete it. Designing / legacy (None) actions
    // remain deletable.
    if crate::features::spaces::pages::actions::is_action_locked(
        space.status.clone(),
        space_action.status.as_ref(),
    ) {
        return Err(Error::ActionLocked);
    }

    let space_pk: Partition = space_id.clone().into();

    match space_action.space_action_type {
        SpaceActionType::Poll => {
            use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
            let poll_id = SpacePollEntityType(action_id.clone());
            let poll = SpacePoll::get_one(&space_id, &poll_id)
                .await?
                .ok_or(Error::NotFound("Poll not found".into()))?;

            if poll.user_response_count > 0 {
                return Err(SpaceActionError::ActionDeleteFailed.into());
            }

            delete_entities_tx(&[poll.id], space_action.id, "poll").await?;
            let _ = DashboardAggregate::inc_polls(&space_pk, -1).await;
        }
        SpaceActionType::TopicDiscussion => {
            use crate::features::spaces::pages::actions::actions::discussion::SpacePost;
            let post = SpacePost::get_one(&space_id, &SpacePostPartition(action_id.clone()))
                .await?
                .ok_or(
                    crate::features::spaces::pages::actions::actions::discussion::SpaceActionDiscussionError::NotFound,
                )?;

            if post.comments > 0 {
                return Err(SpaceActionError::ActionDeleteFailed.into());
            }

            delete_post_and_action(post.id, space_action.id).await?;
            let _ = DashboardAggregate::inc_posts(&space_pk, -1).await;
        }
        SpaceActionType::Quiz => {
            use crate::features::spaces::pages::actions::actions::quiz::{
                SpaceQuiz, SpaceQuizAnswer,
            };
            let quiz_id = SpaceQuizEntityType(action_id.clone());
            let quiz = SpaceQuiz::get_one(&space_id, &quiz_id)
                .await?
                .ok_or(Error::NotFound("Quiz not found".into()))?;

            if quiz.user_response_count > 0 {
                return Err(SpaceActionError::ActionDeleteFailed.into());
            }

            let answer_id = SpaceQuizAnswer::get_one(&space_id, &quiz_id)
                .await?
                .map(|a| a.id);

            let tx = postgres::Tx::begin()
                .await
                .map_err(crate::common::Error::from)?;
            SpaceQuiz::repository()
                .with_tx(&tx)
                .delete(quiz.id)
                .await
                .map_err(delete_err)?;
            SpaceAction::repository()
                .with_tx(&tx)
                .delete(space_action.id)
                .await
                .map_err(delete_err)?;
            if let Some(answer_id) = answer_id {
                SpaceQuizAnswer::repository()
                    .with_tx(&tx)
                    .delete(answer_id)
                    .await
                    .map_err(delete_err)?;
            }
            tx.commit().await.map_err(delete_err)?;
        }
        SpaceActionType::Follow => {
            use crate::features::spaces::pages::actions::actions::follow::{
                SpaceFollowAction, SpaceFollowUser,
            };

            let tx = postgres::Tx::begin()
                .await
                .map_err(crate::common::Error::from)?;
            if let Some(follow) = SpaceFollowAction::find_for_space(&space_id).await? {
                SpaceFollowAction::repository()
                    .with_tx(&tx)
                    .delete(follow.id)
                    .await
                    .map_err(delete_err)?;
            }
            SpaceAction::repository()
                .with_tx(&tx)
                .delete(space_action.id)
                .await
                .map_err(delete_err)?;

            let mut bookmark: Option<String> = None;
            loop {
                let (users, next) =
                    SpaceFollowUser::list_by_space(&space_id, bookmark, 100).await?;
                for user in &users {
                    SpaceFollowUser::repository()
                        .with_tx(&tx)
                        .delete(user.id)
                        .await
                        .map_err(delete_err)?;
                }
                if next.is_none() {
                    break;
                }
                bookmark = next;
            }
            tx.commit().await.map_err(delete_err)?;
        }
        SpaceActionType::Meet => {
            use crate::features::spaces::pages::actions::actions::meet::SpaceMeet;
            let meet = SpaceMeet::get_one(&space_id, &SpaceMeetEntityType(action_id.clone()))
                .await?
                .ok_or(Error::NotFound("Meet not found".into()))?;

            delete_entities_tx(&[meet.id], space_action.id, "meet").await?;
            let _ = DashboardAggregate::inc_meets(&space_pk, -1).await;
        }
    }

    Ok(())
}

#[cfg(feature = "server")]
fn delete_err(e: postgres::Error) -> crate::common::Error {
    crate::error!("Failed to delete action entity: {e}");
    SpaceActionError::ActionDeleteFailed.into()
}

/// Delete a poll/meet-style entity (by surrogate id) plus its companion
/// SpaceAction row, atomically.
#[cfg(feature = "server")]
async fn delete_entities_tx(
    entity_ids: &[uuid::Uuid],
    action_id: uuid::Uuid,
    kind: &str,
) -> Result<()> {
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    match kind {
        "poll" => {
            use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
            for id in entity_ids {
                SpacePoll::repository()
                    .with_tx(&tx)
                    .delete(*id)
                    .await
                    .map_err(delete_err)?;
            }
        }
        "meet" => {
            use crate::features::spaces::pages::actions::actions::meet::SpaceMeet;
            for id in entity_ids {
                SpaceMeet::repository()
                    .with_tx(&tx)
                    .delete(*id)
                    .await
                    .map_err(delete_err)?;
            }
        }
        _ => {}
    }
    SpaceAction::repository()
        .with_tx(&tx)
        .delete(action_id)
        .await
        .map_err(delete_err)?;
    tx.commit().await.map_err(delete_err)?;
    Ok(())
}

/// Delete a discussion post plus its companion SpaceAction row, atomically.
#[cfg(feature = "server")]
async fn delete_post_and_action(post_id: uuid::Uuid, action_id: uuid::Uuid) -> Result<()> {
    use crate::features::spaces::pages::actions::actions::discussion::SpacePost;
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;
    SpacePost::repository()
        .with_tx(&tx)
        .delete(post_id)
        .await
        .map_err(delete_err)?;
    SpaceAction::repository()
        .with_tx(&tx)
        .delete(action_id)
        .await
        .map_err(delete_err)?;
    tx.commit().await.map_err(delete_err)?;
    Ok(())
}
