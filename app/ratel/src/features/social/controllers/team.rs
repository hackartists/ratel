use crate::features::social::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreateTeamRequest {
    pub username: String,
    pub nickname: String,
    pub profile_url: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreateTeamResponse {
    pub team_pk: String,
    /// Epoch-ms of the new team's creation. Returned so the client can
    /// optimistically insert a fully-formed `TeamItem` without re-fetching.
    #[serde(default)]
    pub created_at: i64,
}

#[post("/api/user-shell/teams/create", session: Extension<tower_sessions::Session>)]
pub async fn create_team_handler(
    body: CreateTeamRequest,
) -> crate::features::social::Result<CreateTeamResponse> {
    let Extension(session) = session;
    let user_pk: String = session
        .get::<String>("user_id")
        .await
        .map_err(|e| {
            crate::error!("session: {e}");
            crate::features::social::types::SocialError::SessionNotFound
        })?
        .ok_or(crate::features::social::types::SocialError::SessionNotFound)?;

    let cli = crate::features::social::config::get().dynamodb();
    let user_pk: crate::common::types::Partition = user_pk.parse().unwrap_or_default();

    // Validate username format: lowercase alphanumeric + underscores, min 3 chars
    let username = body.username.to_lowercase();
    if username.len() < 3
        || !username
            .chars()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_')
    {
        return Err(crate::features::social::types::SocialError::InvalidTeamName.into());
    }

    // Check username uniqueness against teams
    use crate::features::posts::models::Team;
    let existing = Team::find_by_username(&username).await?;

    if existing.is_some() {
        return Err(crate::features::social::types::SocialError::TeamNameTaken.into());
    }

    // Check username uniqueness against users
    let existing_user = crate::common::models::User::find_by_username(&username).await?;

    if existing_user.is_some() {
        return Err(crate::features::social::types::SocialError::TeamNameTaken.into());
    }

    // Get the user
    use crate::common::models::User;
    let user: User = User::find_by_pk(&user_pk)
        .await?
        .ok_or(crate::features::social::types::SocialError::UserNotFound)?;

    let (team_pk, created_at) = Team::create_new_team(
        &user,
        cli,
        body.nickname,
        body.profile_url,
        username,
        body.description,
    )
    .await?;

    Ok(CreateTeamResponse {
        team_pk: team_pk.to_string(),
        created_at,
    })
}

#[mcp_tool(
    name = "list_teams",
    description = "List all teams the user belongs to with their role and permissions. Use team_id from the result as the team_id parameter in create_post to post under a team."
)]
#[get("/api/me/teams", user: crate::features::auth::User)]
pub async fn get_user_teams_handler(
) -> crate::features::social::Result<crate::common::types::ListResponse<crate::common::TeamItem>> {
    let cli = crate::features::social::config::get().dynamodb();
    let user_pk = user.pk();

    let user_teams = crate::features::auth::UserTeam::find_by_user(&user_pk).await?;
    let next_bookmark: Option<String> = None;

    let mut items: Vec<crate::common::TeamItem> = Vec::new();
    for ut in user_teams {
        let team_pk = ut.team_pk.clone();
        let (permissions, description) = if team_pk.is_empty() {
            (Vec::new(), String::new())
        } else {
            let team_pk_part: crate::common::types::Partition = team_pk.parse().unwrap_or_default();
            let role =
                crate::features::posts::models::Team::get_user_role(cli, &team_pk_part, &user_pk)
                    .await
                    .ok()
                    .flatten()
                    .unwrap_or_default();
            let perms: crate::features::posts::types::TeamGroupPermissions =
                role.to_legacy_permissions().into();
            let description = if let crate::common::types::Partition::Team(id) = &team_pk_part {
                match uuid::Uuid::parse_str(id) {
                    Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
                        .await
                        .ok()
                        .flatten()
                        .map(|team| team.description)
                        .unwrap_or_default(),
                    Err(_) => String::new(),
                }
            } else {
                String::new()
            };
            (perms.0.into_iter().map(|p| p as u8).collect(), description)
        };

        items.push(crate::common::TeamItem {
            pk: team_pk,
            nickname: ut.display_name,
            username: ut.username,
            profile_url: ut.profile_url,
            user_type: crate::common::types::UserType::Team,
            permissions,
            description,
            created_at: 0,
            member_count: 0,
        });
    }

    Ok((items, next_bookmark).into())
}

// ── List teams where the caller has admin/owner role ────────────
//
// Filters `UserTeam` rows by the persisted `role` enum (canonical
// authority for team membership — `permissions` is legacy). Used by
// the sub-team apply page's team picker so the dropdown only shows
// teams the user can submit an application for.
#[post("/api/user-shell/teams/admin?bookmark", user: crate::features::auth::User)]
pub async fn list_admin_teams_handler(
    bookmark: Option<String>,
) -> crate::features::social::Result<crate::common::types::ListResponse<crate::common::TeamItem>> {
    let cli = crate::features::social::config::get().dynamodb();
    let user_pk = user.pk();

    // `bookmark` carries an opaque 1-based page number as a string (same
    // convention as the DynamoDB `opt_with_bookmark` this replaces).
    const PAGE_SIZE: i64 = 20;
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let page_result = {
        use postgres::ops::StringOp;
        crate::features::auth::UserTeam::repository()
            .find(
                crate::features::auth::UserTeam::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(
                        crate::features::auth::UserTeamColumn::LastUsedAt,
                        postgres::Order::Desc,
                    )
                    .page(page)
                    .page_size(PAGE_SIZE),
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

    let mut items: Vec<crate::common::TeamItem> = Vec::new();
    for ut in user_teams {
        if !ut.role.0.is_admin_or_owner() {
            continue;
        }
        let team_pk = ut.team_pk.clone();
        // For each admin/owner team we also fetch the Team row to get
        // `description` + `created_at` and run a paged member count.
        // The apply page's eligibility panel uses `created_at` to evaluate
        // the parent's `min_sub_team_age_days` requirement and
        // `member_count` for `min_sub_team_members`.
        let (permissions, description, created_at, member_count) = if team_pk.is_empty() {
            (Vec::new(), String::new(), 0i64, 0i64)
        } else {
            let team_pk_part: crate::common::types::Partition = team_pk.parse().unwrap_or_default();
            let perms: crate::features::posts::types::TeamGroupPermissions =
                ut.role.0.to_legacy_permissions().into();
            let team_row = if let crate::common::types::Partition::Team(id) = &team_pk_part {
                match uuid::Uuid::parse_str(id) {
                    Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
                        .await
                        .ok()
                        .flatten(),
                    Err(_) => None,
                }
            } else {
                None
            };
            let description = team_row
                .as_ref()
                .map(|t| t.description.clone())
                .unwrap_or_default();
            let created_at = team_row.as_ref().map(|t| t.created_at).unwrap_or(0);
            let member_count =
                crate::features::sub_team::services::count_team_members(cli, &team_pk_part)
                    .await
                    .unwrap_or(0);
            (
                perms.0.into_iter().map(|p| p as u8).collect(),
                description,
                created_at,
                member_count,
            )
        };

        items.push(crate::common::TeamItem {
            pk: team_pk,
            nickname: ut.display_name,
            username: ut.username,
            profile_url: ut.profile_url,
            user_type: crate::common::types::UserType::Team,
            permissions,
            description,
            created_at,
            member_count,
        });
    }

    Ok((items, next_bookmark).into())
}
