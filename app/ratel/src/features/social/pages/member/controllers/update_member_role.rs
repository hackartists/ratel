use super::super::dto::{TeamMemberResponse, UpdateMemberRoleRequest};
use super::super::*;

#[cfg(feature = "server")]
use crate::features::posts::models::{Team, TeamOwner};

#[patch("/api/teams/:team_pk/members/role", user: crate::features::auth::User, team: Team, role: crate::features::social::pages::member::dto::TeamRole)]
pub async fn update_member_role_handler(
    team_pk: TeamPartition,
    body: UpdateMemberRoleRequest,
) -> Result<TeamMemberResponse> {
    let team_pk: Partition = team_pk.into();
    let _ = team;

    if !role.is_admin_or_owner() {
        return Err(Error::NoPermission);
    }

    // Cannot change own role.
    if body.user_pk == user.pk().to_string() {
        return Err(MemberError::CannotChangeOwnRole.into());
    }

    // Cannot change owner's role.
    let team_owner = if let Partition::Team(id) = &team_pk {
        match uuid::Uuid::parse_str(id) {
            Ok(uuid) => TeamOwner::find_by_team(uuid).await?,
            Err(_) => None,
        }
    } else {
        None
    };
    if let Some(team_owner) = team_owner {
        if team_owner.user_pk.to_string() == body.user_pk {
            return Err(MemberError::CannotChangeOwnerRole.into());
        }
    }

    // Verify target user exists.
    let target_user = crate::features::auth::User::find_by_pk_str(&body.user_pk)
        .await?
        .ok_or(MemberError::UserNotFound)?;

    let mut existing =
        crate::features::auth::UserTeam::get_membership(&target_user.pk(), &team_pk)
            .await?
            .ok_or(MemberError::UserNotFound)?;

    // No-op if role is already what was requested.
    if existing.role.0 == body.role {
        return Ok(TeamMemberResponse {
            user_id: target_user.pk().to_string(),
            username: target_user.username.clone(),
            display_name: target_user.display_name.clone(),
            profile_url: target_user.profile_url.clone(),
            role: body.role,
            is_owner: false,
        });
    }

    existing.role = crate::features::auth::TeamRoleJson(body.role);
    existing.save().await.map_err(|e| {
        crate::error!("update_member_role failed: {e}");
        MemberError::RoleChangeFailed
    })?;

    Ok(TeamMemberResponse {
        user_id: target_user.pk().to_string(),
        username: target_user.username.clone(),
        display_name: target_user.display_name.clone(),
        profile_url: target_user.profile_url.clone(),
        role: body.role,
        is_owner: false,
    })
}
