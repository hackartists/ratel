use crate::features::spaces::pages::apps::apps::general::*;
use crate::features::spaces::pages::apps::types::SpaceAppError;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;
#[cfg(feature = "server")]
use crate::features::auth::User;
#[cfg(feature = "server")]
use crate::spaces::{InvitationStatus, SpaceInvitationMember};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct InviteSpaceParticipantsRequest {
    pub emails: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct InviteSpaceParticipantsResponse {
    pub invited_emails: Vec<String>,
}

#[cfg(feature = "server")]
fn normalize_email(raw: &str) -> Option<String> {
    let email = raw.trim().to_ascii_lowercase();
    if email.is_empty() || !email.contains('@') {
        return None;
    }
    Some(email)
}

#[post(
    "/api/spaces/{space_id}/participants/invitations",
    role: SpaceUserRole
)]
pub async fn invite_space_participants(
    space_id: SpacePartition,
    req: InviteSpaceParticipantsRequest,
) -> crate::common::Result<InviteSpaceParticipantsResponse> {
    use crate::common::models::space::{SpaceCommon, SpaceParticipant};
    use crate::common::types::{InboxPayload, SpacePublishState};
    use crate::features::posts::models::Post;
    use std::collections::HashSet;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_id.into();
    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    let mut invite_targets = vec![];
    let mut invited_emails = vec![];
    let mut seen = HashSet::<String>::new();

    for raw_email in req.emails {
        let email =
            normalize_email(&raw_email).ok_or_else(|| SpaceAppError::InvalidInvitationEmail)?;

        if !seen.insert(email.clone()) {
            continue;
        }

        let target_user = User::find_by_email(&email)
            .await?
            .ok_or_else(|| Error::NotFound(format!("User not found: {}", email)))?;

        let target_user_pk = target_user.pk();

        if SpaceParticipant::get_participant(&space_pk, &target_user_pk)
            .await?
            .is_some()
        {
            continue;
        }

        if let Some(existing_invitation) =
            SpaceInvitationMember::get_for(&space_pk, &target_user_pk).await?
        {
            if matches!(
                existing_invitation.status,
                InvitationStatus::Pending | InvitationStatus::Invited
            ) {
                continue;
            }
        }

        invite_targets.push((email, target_user));
    }

    let mut invited_user_pks: Vec<Partition> = Vec::new();
    for (email, target_user) in invite_targets {
        let invitee_pk = target_user.pk();
        let mut invitation = SpaceInvitationMember::new(space_pk.clone(), target_user);
        invitation.status = if space.publish_state == SpacePublishState::Published {
            InvitationStatus::Invited
        } else {
            InvitationStatus::Pending
        };

        invitation.save().await?;
        invited_emails.push(email);
        invited_user_pks.push(invitee_pk);
    }

    // Fan inbox rows per invited user (idempotent per space+invitee).
    // SpaceCommon does not hold a title; the Feed post title is the canonical title.
    if !invited_user_pks.is_empty() {
        let space_partition = space.partition();
        let space_id_for_inbox: SpacePartition = space_partition.clone().into();
        let space_title = 'title: {
            let Ok(post_pk) = space_partition.clone().to_post_key() else {
                break 'title String::new();
            };
            let Partition::Feed(id) = &post_pk else {
                break 'title String::new();
            };
            let Ok(post_id) = uuid::Uuid::parse_str(id) else {
                break 'title String::new();
            };
            Post::get_by_feed_id(post_id)
                .await
                .ok()
                .flatten()
                .map(|p| p.title)
                .unwrap_or_default()
        };
        let inviter_name = if !space.author_display_name.is_empty() {
            space.author_display_name.clone()
        } else {
            space.author_username.clone()
        };
        let cta_url = match &space_partition {
            Partition::Space(id) => {
                format!("https://ratel.foundation/spaces/SPACE%23{}", id)
            }
            _ => String::new(),
        };

        for invitee_pk in &invited_user_pks {
            let payload = InboxPayload::SpaceInvitation {
                space_id: space_id_for_inbox.clone(),
                space_title: space_title.clone(),
                inviter_name: inviter_name.clone(),
                cta_url: cta_url.clone(),
            };
            let dedup_source = format!("{}#{}", space.space_pk, invitee_pk);
            if let Err(e) = crate::common::utils::inbox::create_inbox_row_once(
                invitee_pk.clone(),
                payload,
                &dedup_source,
            )
            .await
            {
                crate::error!("space-invitation inbox row failed: {e}");
            }
        }
    }

    // TODO(main-api parity): send invitation emails for published spaces.
    // TODO(main-api parity): send invitation push notifications via FCM.

    Ok(InviteSpaceParticipantsResponse { invited_emails })
}
