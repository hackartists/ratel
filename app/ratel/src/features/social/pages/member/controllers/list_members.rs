use super::super::dto::*;
use super::super::*;

#[cfg(feature = "server")]
use crate::features::posts::models::TeamOwner;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
use std::collections::HashSet;

#[get("/api/teams/:team_pk/members?bookmark&limit", user: crate::features::auth::OptionalUser)]
pub async fn list_members_handler(
    team_pk: TeamPartition,
    bookmark: Option<String>,
    limit: Option<i32>,
) -> Result<ListItemsResponse<TeamMemberResponse>> {
    let team_pk: Partition = team_pk.into();
    let _ = user;

    let is_first_page = bookmark.is_none();
    let page_limit = limit.unwrap_or(50).min(100) as i64;

    // `bookmark` carries an opaque 1-based page number as a string (same
    // convention as the DynamoDB `opt_with_bookmark` this replaces).
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    // Query all UserTeam records for this team.
    let page_result = {
        use postgres::ops::StringOp;
        crate::features::auth::UserTeam::repository()
            .find(
                crate::features::auth::UserTeam::query()
                    .team_pk(StringOp::Eq(team_pk.to_string()))
                    .order_by(
                        crate::features::auth::UserTeamColumn::LastUsedAt,
                        postgres::Order::Desc,
                    )
                    .page(page)
                    .page_size(page_limit),
            )
            .await
            .map_err(crate::common::Error::from)?
    };
    let next_bookmark = if page < page_result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };
    let user_teams = page_result.items;

    // Fetch user records for display fields.
    let unique_user_pks: Vec<String> = {
        let mut seen = HashSet::new();
        user_teams
            .iter()
            .filter_map(|ut| {
                if seen.insert(ut.user_pk.clone()) {
                    Some(ut.user_pk.clone())
                } else {
                    None
                }
            })
            .collect()
    };

    let users: Vec<crate::features::auth::User> = futures::future::join_all(
        unique_user_pks
            .iter()
            .map(|pk| async move { crate::features::auth::User::find_by_pk_str(pk).await.ok().flatten() }),
    )
    .await
    .into_iter()
    .flatten()
    .collect();

    use std::collections::HashMap;
    let user_map: HashMap<String, crate::features::auth::User> =
        users.into_iter().map(|u| (u.pk().to_string(), u)).collect();

    let mut members: Vec<TeamMemberResponse> = Vec::new();
    for ut in user_teams {
        let user_pk_str = ut.user_pk.clone();
        let Some(u) = user_map.get(&user_pk_str) else {
            continue;
        };
        members.push(TeamMemberResponse {
            user_id: user_pk_str,
            username: u.username.clone(),
            display_name: u.display_name.clone(),
            profile_url: u.profile_url.clone(),
            role: ut.role.0,
            is_owner: matches!(ut.role.0, TeamRole::Owner),
        });
    }

    // Ensure owner record is on the first page (UserTeam.role may already
    // be Owner but we also sync from TeamOwner as the authoritative source).
    if is_first_page {
        let team_owner = if let Partition::Team(id) = &team_pk {
            match uuid::Uuid::parse_str(id) {
                Ok(uuid) => TeamOwner::find_by_team(uuid).await?,
                Err(_) => None,
            }
        } else {
            None
        };
        if let Some(team_owner) = team_owner {
            let owner_pk_str = team_owner.user_pk.to_string();
            let existing_idx = members.iter().position(|m| m.user_id == owner_pk_str);
            let entry = TeamMemberResponse {
                user_id: owner_pk_str.clone(),
                username: team_owner.username.clone(),
                display_name: team_owner.display_name.clone(),
                profile_url: team_owner.profile_url.clone(),
                role: TeamRole::Owner,
                is_owner: true,
            };
            if let Some(idx) = existing_idx {
                members.remove(idx);
            }
            members.insert(0, entry);
        }
    }

    Ok(ListItemsResponse {
        items: members,
        bookmark: next_bookmark,
    })
}
