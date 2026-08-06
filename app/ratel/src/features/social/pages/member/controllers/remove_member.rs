use super::super::dto::{RemoveMemberRequest, RemoveMemberResponse};
use super::super::*;

use crate::features::posts::models::Team;

#[delete("/api/teams/:team_pk/members", user: crate::features::auth::User, team: Team, role: crate::features::social::pages::member::dto::TeamRole)]
pub async fn remove_team_member_handler(
    team_pk: TeamPartition,
    body: RemoveMemberRequest,
) -> Result<RemoveMemberResponse> {
    let team_pk: Partition = team_pk.into();

    if !role.is_admin_or_owner() {
        return Err(Error::NoPermission);
    }

    let mut success_count = 0i64;
    let mut failed_pks = vec![];

    for member_pk in &body.user_pks {
        let user = crate::features::auth::User::find_by_pk_str(member_pk).await?;
        let Some(user) = user else {
            failed_pks.push(member_pk.to_string());
            continue;
        };

        if let Some(existing) =
            crate::features::auth::UserTeam::get_membership(&user.pk(), &team_pk).await?
        {
            crate::features::auth::UserTeam::repository()
                .delete(existing.id)
                .await
                .map_err(crate::common::Error::from)?;
        }

        success_count += 1;
    }

    Ok(RemoveMemberResponse {
        total_removed: success_count,
        failed_pks,
    })
}
