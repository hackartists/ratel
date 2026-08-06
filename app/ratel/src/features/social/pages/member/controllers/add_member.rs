use super::super::dto::{AddTeamMemberRequest, AddTeamMemberResponse};
use super::super::*;

#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use std::collections::HashSet;

#[post("/api/teams/:team_pk/members", user: crate::features::auth::User, team: Team, role: crate::features::social::pages::member::dto::TeamRole)]
pub async fn add_team_member_handler(
    team_pk: TeamPartition,
    body: AddTeamMemberRequest,
) -> Result<AddTeamMemberResponse> {
    let _ = team_pk;

    if body.user_pks.len() > 100 {
        return Err(MemberError::TooManyInvitations.into());
    }

    if !role.is_admin_or_owner() {
        return Err(Error::UnauthorizedAccess);
    }

    // Deduplicate requested user pks.
    let mut seen = HashSet::new();
    let mut failed_pks = vec![];
    let unique_pks: Vec<String> = body
        .user_pks
        .iter()
        .filter_map(|pk| {
            if seen.insert(pk.clone()) {
                Some(pk.clone())
            } else {
                failed_pks.push(pk.clone());
                None
            }
        })
        .collect();

    if unique_pks.is_empty() {
        return Ok(AddTeamMemberResponse {
            total_added: 0,
            failed_pks,
        });
    }

    // Fetch users to verify they exist.
    let user_results: Vec<(String, Option<crate::features::auth::User>)> =
        futures::future::join_all(unique_pks.iter().map(|pk| async move {
            let user = crate::features::auth::User::find_by_pk_str(pk)
                .await
                .ok()
                .flatten();
            (pk.clone(), user)
        }))
        .await;

    let mut found_users = Vec::new();
    for (pk, user) in user_results {
        match user {
            Some(u) => found_users.push(u),
            None => failed_pks.push(pk),
        }
    }

    // Check existing UserTeam memberships to skip duplicates.
    let team_pk = team.partition();
    let membership_checks = futures::future::join_all(found_users.iter().map(|u| {
        let user_pk = u.pk();
        let team_pk = team_pk.clone();
        async move {
            crate::features::auth::UserTeam::get_membership(&user_pk, &team_pk)
                .await
                .ok()
                .flatten()
        }
    }))
    .await;

    let new_members: Vec<_> = found_users
        .into_iter()
        .zip(membership_checks)
        .filter_map(|(u, existing)| if existing.is_none() { Some(u) } else { None })
        .collect();
    let success_count = new_members.len() as i64;

    // Insert UserTeam rows inside one transaction — natural-key upsert (no
    // condition check) avoids a unique-violation race between our read and
    // this write, matching the old unconditional DynamoDB upsert-transact.
    if !new_members.is_empty() {
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        for u in &new_members {
            let user_team = crate::features::auth::UserTeam::new(
                u.pk(),
                team.partition(),
                team.display_name.clone(),
                team.profile_url.clone(),
                team.username.clone(),
                team.dao_address.clone(),
                body.role,
            );
            crate::features::auth::UserTeam::repository()
                .with_tx(&tx)
                .upsert_on(&["user_pk", "team_pk"], &user_team)
                .await
                .map_err(crate::common::Error::from)?;
        }
        tx.commit().await.map_err(crate::common::Error::from)?;
    }

    Ok(AddTeamMemberResponse {
        total_added: success_count,
        failed_pks,
    })
}
