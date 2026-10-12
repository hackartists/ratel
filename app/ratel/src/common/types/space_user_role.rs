use crate::common::*;

#[derive(
    Debug,
    Clone,
    Copy,
    Serialize,
    Deserialize,
    Default,
    // DynamoEnum,
    // JsonSchema,
    // OperationIo,
    Translate,
    PartialEq,
    Eq,
)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum SpaceUserRole {
    #[default]
    #[translate(en = "Viewer", ko = "뷰어")]
    Viewer,
    #[translate(en = "Participant", ko = "참가자")]
    Participant,
    #[translate(en = "Candidate", ko = "참가후보")]
    Candidate,
    #[translate(en = "Admin", ko = "관리자")]
    Creator,
}

impl SpaceUserRole {
    pub fn is_admin(&self) -> bool {
        matches!(self, SpaceUserRole::Creator)
    }

    pub fn is_creator(&self) -> Result<()> {
        if matches!(self, SpaceUserRole::Creator) {
            Ok(())
        } else {
            Err(Error::NoPermission)
        }
    }

    pub fn can_edit(&self) -> bool {
        matches!(self, SpaceUserRole::Creator)
    }

    pub fn can_act(&self) -> bool {
        matches!(self, SpaceUserRole::Participant | SpaceUserRole::Creator)
    }
}

#[cfg(feature = "server")]
fn prerequisite_check_error(context: &str, err: impl std::fmt::Display) -> Error {
    error!("{context}: {err}");
    Error::SpaceUserRoleFailed
}

#[cfg(feature = "server")]
fn serializable_role_error(context: &str, err: Error) -> Error {
    match err {
        Error::Aws(err) => prerequisite_check_error(context, err),
        Error::Session(err) => prerequisite_check_error(context, err),
        other => other,
    }
}

#[cfg(feature = "server")]
async fn has_completed_prerequisite_actions(
    space: &crate::common::models::space::SpaceCommon,
    user: &crate::common::models::auth::User,
) -> Result<bool> {
    use crate::features::spaces::pages::actions::models::SpaceAction;

    let space_id: SpacePartition = space.partition().into();
    let actions = SpaceAction::list_by_space(&space_id)
        .await
        .map_err(|err| prerequisite_check_error("Failed to load prerequisite actions", err))?;

    let prerequisite_actions: Vec<_> = actions
        .into_iter()
        .filter(|action| action.prerequisite)
        .collect();

    if prerequisite_actions.is_empty() {
        return Ok(true);
    }

    for action in prerequisite_actions {
        if !has_completed_prerequisite_action(space, &action, &user.pk()).await? {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Checks whether `user_pk` has personally completed `action`.
/// Dispatches on action type (Poll → UserAnswer, Quiz → Attempt,
/// Discussion → Comment, Follow → UserFollow edges).
#[cfg(feature = "server")]
pub async fn has_completed_prerequisite_action(
    space: &crate::common::models::space::SpaceCommon,
    action: &crate::features::spaces::pages::actions::models::SpaceAction,
    user_pk: &Partition,
) -> Result<bool> {
    use crate::features::spaces::pages::actions::types::SpaceActionType;

    match action.space_action_type {
        SpaceActionType::Poll => {
            has_completed_poll_action(&space.partition(), &action.action_id, user_pk).await
        }
        SpaceActionType::Quiz => has_completed_quiz_action(&action.action_id, user_pk).await,
        SpaceActionType::TopicDiscussion => {
            has_completed_discussion_action(&action.action_id, user_pk).await
        }
        SpaceActionType::Follow => has_completed_follow_action(space, user_pk).await,
        // Meet prerequisites are not tracked per-user yet; treat as not-completed.
        SpaceActionType::Meet => Ok(false),
        SpaceActionType::Announcement => Ok(true),
    }
}

#[cfg(feature = "server")]
async fn has_completed_poll_action(
    space_pk: &Partition,
    action_id: &str,
    user_pk: &Partition,
) -> Result<bool> {
    use crate::features::spaces::pages::actions::actions::poll::SpacePollUserAnswer;

    let poll_id: SpacePollEntityType = action_id.to_string().into();
    let poll_sk: EntityType = poll_id.into();

    SpacePollUserAnswer::find_one(space_pk, &poll_sk, user_pk)
        .await
        .map(|answer| answer.is_some())
        .map_err(|err| prerequisite_check_error("Failed to verify poll prerequisite", err))
}

#[cfg(feature = "server")]
async fn has_completed_quiz_action(action_id: &str, user_pk: &Partition) -> Result<bool> {
    use crate::features::spaces::pages::actions::actions::quiz::SpaceQuizAttempt;

    let quiz_id: SpaceQuizEntityType = action_id.to_string().into();

    SpaceQuizAttempt::find_latest_by_quiz_user(&quiz_id, user_pk)
        .await
        .map(|attempt| attempt.is_some())
        .map_err(|err| prerequisite_check_error("Failed to verify quiz prerequisite", err))
}

/// `action_id` is the discussion's bare `SpacePost` id (matches
/// `SpacePostComment::post_id`). A comment/reply row on that post authored by
/// `user_pk` satisfies the prerequisite — equivalent to the old two-prefix
/// (top-level + reply) scan, since both share the same `post_id` column now.
#[cfg(feature = "server")]
async fn has_completed_discussion_action(action_id: &str, user_pk: &Partition) -> Result<bool> {
    use crate::features::spaces::pages::actions::actions::discussion::SpacePostComment;
    use postgres::PostgresEntity as _;
    use postgres::ops::StringOp;

    let found = SpacePostComment::repository()
        .find_one(
            SpacePostComment::query()
                .post_id(StringOp::Eq(action_id.to_string()))
                .author_pk(StringOp::Eq(user_pk.to_string())),
        )
        .await
        .map_err(|err| {
            prerequisite_check_error("Failed to verify discussion prerequisite", err)
        })?;

    Ok(found.is_some())
}

#[cfg(feature = "server")]
async fn has_completed_follow_action(
    space: &crate::common::models::space::SpaceCommon,
    user_pk: &Partition,
) -> Result<bool> {
    use std::collections::HashSet;

    use crate::common::models::auth::UserFollow;
    use crate::features::spaces::pages::actions::actions::follow::SpaceFollowUser;

    let space_id: SpacePartition = space.partition().into();

    let mut target_user_pks: Vec<String> = Vec::new();
    let mut bookmark: Option<String> = None;

    loop {
        let (users, next_bookmark) =
            SpaceFollowUser::list_by_space(&space_id, bookmark.clone(), 100)
                .await
                .map_err(|err| {
                    prerequisite_check_error("Failed to load follow prerequisite targets", err)
                })?;

        target_user_pks.extend(
            users
                .into_iter()
                .filter(|user| !user.user_pk.is_empty())
                .map(|user| user.user_pk),
        );

        if next_bookmark.is_none() {
            break;
        }

        bookmark = next_bookmark;
    }

    if !target_user_pks
        .iter()
        .any(|target| target == &space.user_pk)
    {
        target_user_pks.push(space.user_pk.clone());
    }

    let mut deduped_targets = Vec::new();
    let mut seen = HashSet::new();
    for target_user_pk in target_user_pks {
        if seen.insert(target_user_pk.clone()) {
            deduped_targets.push(target_user_pk);
        }
    }

    // Every target must have a `Follower` edge from `user_pk`. `UserFollow`
    // no longer exposes a batch-get, so this checks one-by-one instead of the
    // old single `batch_get` — same result (all-of check), more round-trips.
    for target_user_pk in &deduped_targets {
        let target_partition: Partition = target_user_pk.parse().unwrap_or(Partition::None);
        let followed = UserFollow::find_follower(&target_partition, user_pk)
            .await
            .map_err(|err| {
                prerequisite_check_error("Failed to verify follow prerequisite", err)
            })?
            .is_some();
        if !followed {
            return Ok(false);
        }
    }

    Ok(true)
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for SpaceUserRole
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        use crate::common::models::auth::User;
        use crate::common::models::space::{SpaceCommon, SpaceParticipant};
        use crate::features::spaces::{InvitationStatus, SpaceInvitationMember};
        tracing::debug!("extracting space from request parts. Path: {:?}", parts.uri);

        if let Some(space_role) = parts.extensions.get::<SpaceUserRole>() {
            return Ok(space_role.clone());
        }

        let space = SpaceCommon::from_request_parts(parts, state)
            .await
            .map_err(|err| serializable_role_error("Failed to load space for role", err))?;

        let user = User::from_request_parts(parts, state).await.ok();

        let public_space = space.is_public();

        if user.is_none() {
            if public_space {
                parts.extensions.insert(SpaceUserRole::Viewer);
                return Ok(SpaceUserRole::Viewer);
            } else {
                return Err(Error::UnauthorizedAccess);
            }
        }

        let user = user.unwrap();

        let user_pk = user.pk();
        let space_pk = space.partition();
        // `space.user_pk` is a natural-key string (`"USER#…"` / `"TEAM#…"`)
        // after the Postgres migration, not a `Partition` field anymore.
        let space_owner_pk: Partition = space.user_pk.parse().unwrap_or(Partition::None);

        // Individual creator check
        if user_pk.to_string() == space.user_pk {
            parts.extensions.insert(SpaceUserRole::Creator);
            return Ok(SpaceUserRole::Creator);
        }

        let conf = config::ServerConfig::default();
        let cli = conf.dynamodb();

        // Team admin check: if the space is owned by a team, check if the
        // user is an Owner or Admin on that team. Both roles should be
        // treated as Space Creator. Previously this used the legacy
        // `TeamGroupPermission::TeamAdmin` bit which only Owner role maps
        // to — team Admins therefore hit UnauthorizedAccess when editing.
        if matches!(&space_owner_pk, Partition::Team(_)) {
            use crate::features::posts::models::Team;

            let team_role = Team::get_user_role(cli, &space_owner_pk, &user_pk)
                .await
                .ok()
                .flatten();
            if let Some(role) = team_role {
                if role.is_admin_or_owner() {
                    parts.extensions.insert(SpaceUserRole::Creator);
                    return Ok(SpaceUserRole::Creator);
                }
            }
        }

        {
            use crate::common::models::space::SpaceAdmin;

            let space_admin = SpaceAdmin::get_admin(&space_pk, &user_pk).await.ok().flatten();
            if space_admin.is_some() {
                parts.extensions.insert(SpaceUserRole::Creator);
                return Ok(SpaceUserRole::Creator);
            }
        }

        // Check participant
        let participant = SpaceParticipant::get_participant(&space_pk, &user_pk)
            .await
            .ok()
            .flatten();

        if participant.is_some() {
            let role = if matches!(space.status, Some(crate::common::SpaceStatus::Open)) {
                SpaceUserRole::Candidate
            } else if matches!(
                space.status,
                Some(crate::common::SpaceStatus::Ongoing | crate::common::SpaceStatus::Finished)
            ) {
                let prerequisites_done = has_completed_prerequisite_actions(&space, &user)
                    .await
                    .map_err(|err| {
                        serializable_role_error(
                            "Failed to verify prerequisite actions for role",
                            err,
                        )
                    })?;
                let admitted = prerequisites_done
                    && crate::features::spaces::pages::apps::apps::sampling::services::admits_participant(
                        &space, &user_pk,
                    )
                    .await
                    .map_err(|err| {
                        serializable_role_error("Failed to verify sampling admission for role", err)
                    })?;
                if admitted {
                    SpaceUserRole::Participant
                } else {
                    SpaceUserRole::Candidate
                }
            } else {
                SpaceUserRole::Candidate
            };
            parts.extensions.insert(role);
            return Ok(role);
        }

        if !public_space {
            let invitation = SpaceInvitationMember::get_for(&space_pk, &user_pk)
                .await
                .ok()
                .flatten();

            if matches!(
                invitation.as_ref().map(|member| member.status),
                Some(InvitationStatus::Invited) | Some(InvitationStatus::Accepted)
            ) {
                parts.extensions.insert(SpaceUserRole::Viewer);
                return Ok(SpaceUserRole::Viewer);
            }

            // Sub-team broadcast / direct-message escape hatch. Audience
            // members (parent + recognized sub-teams) reach the Space
            // without an explicit `SpaceInvitationMember` row; without
            // this, `/user-role` returns 401 even though `get_space`
            // already let them through.
            if let Ok(post_pk) = space_pk.clone().to_post_key() {
                let post_uuid = match &post_pk {
                    Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
                    _ => None,
                };
                if let Some(post_uuid) = post_uuid {
                    if let Ok(Some(post)) =
                        crate::features::posts::models::Post::get_by_feed_id(post_uuid).await
                    {
                        if crate::features::sub_team::services::broadcast_access::is_broadcast_audience(
                            cli, &post, &user_pk,
                        )
                        .await
                        {
                            parts.extensions.insert(SpaceUserRole::Viewer);
                            return Ok(SpaceUserRole::Viewer);
                        }
                    }
                }
            }
        }

        // For public spaces, unauthenticated users are Viewers (handled above),
        // but authenticated non-participants are also Viewers.
        if public_space {
            parts.extensions.insert(SpaceUserRole::Viewer);
            return Ok(SpaceUserRole::Viewer);
        }

        Err(Error::UnauthorizedAccess)
    }
}
