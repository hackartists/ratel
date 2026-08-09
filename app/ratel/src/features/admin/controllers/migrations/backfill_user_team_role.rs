use crate::common::models::auth::AdminUser;
use crate::features::admin::*;
#[cfg(feature = "server")]
use crate::features::auth::{TeamRoleJson, UserTeam, UserTeamGroup};
#[cfg(feature = "server")]
use crate::features::posts::models::TeamOwner;
#[cfg(feature = "server")]
use crate::features::posts::types::TeamGroupPermissions;
use crate::features::social::pages::member::dto::TeamRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BackfillUserTeamRoleResponse {
    pub scanned: usize,
    pub updated: usize,
    pub owners_set: usize,
    pub admins_set: usize,
    pub members_set: usize,
    pub skipped_already_set: usize,
}

/// One-shot migration that populates `UserTeam.role` for every membership.
///
/// - If the user is the team's `TeamOwner` → `TeamRole::Owner`
/// - Else combine all of the user's `UserTeamGroup.team_group_permissions`
///   for this team:
///     - `TeamAdmin` bit set → `Owner` (defensive; TeamOwner should cover this)
///     - `TeamEdit` bit set → `Admin`
///     - otherwise          → `Member`
///
/// Idempotent: if a record already has a non-default role the migration
/// does not overwrite it unless `overwrite=true` is passed.
#[post("/api/admin/migrations/user-team-role?overwrite", _user: AdminUser)]
pub async fn backfill_user_team_role(
    overwrite: Option<bool>,
) -> Result<BackfillUserTeamRoleResponse> {
    use crate::features::posts::types::TeamGroupPermission;
    use postgres::PostgresEntity;
    use postgres::ops::StringOp;

    let overwrite = overwrite.unwrap_or(false);

    let mut response = BackfillUserTeamRoleResponse::default();

    // Sweep every UserTeam row, page by page. Postgres migration replaces the
    // old raw DynamoDB `sk begins_with USER_TEAM#` scan with a plain
    // unfiltered paginated query — `UserTeam` is its own table now, so no
    // prefix filter is needed.
    const PAGE_SIZE: i64 = 100;
    let mut page_num: i64 = 1;
    loop {
        let page = UserTeam::repository()
            .find(UserTeam::query().page(page_num).page_size(PAGE_SIZE))
            .await
            .map_err(|e| {
                crate::error!("scan failed: {e}");
                crate::common::Error::NotFound(format!("scan failed: {e}"))
            })?;

        if page.items.is_empty() {
            break;
        }

        for user_team in page.items {
            response.scanned += 1;

            if !overwrite && !matches!(user_team.role.0, TeamRole::Member) {
                // Already has a non-default role; skip.
                response.skipped_already_set += 1;
                continue;
            }

            let team_pk_str = user_team.team_pk.clone();
            let team_pk: Partition = team_pk_str.parse().unwrap_or_default();

            // Owner check.
            let mut role = TeamRole::Member;
            let team_uuid = match &team_pk {
                Partition::Team(id) => uuid::Uuid::parse_str(id).ok(),
                _ => None,
            };
            if let Some(team_uuid) = team_uuid {
                if let Ok(Some(owner)) = TeamOwner::find_by_team(team_uuid).await {
                    if owner.user_pk == user_team.user_pk {
                        role = TeamRole::Owner;
                    }
                }
            }

            // If not owner, combine this user's UserTeamGroup permissions for
            // this team to derive role. Owner is authoritative only via the
            // TeamOwner record — the TeamAdmin permission bit was granted to
            // every member of the legacy `admin_group`, so treating that bit
            // as Owner would incorrectly promote every admin_group member.
            if matches!(role, TeamRole::Member) {
                if let Ok(groups) = UserTeamGroup::repository()
                    .find(
                        UserTeamGroup::query()
                            .user_pk(StringOp::Eq(user_team.user_pk.clone()))
                            .team_pk(StringOp::Eq(team_pk_str.clone()))
                            .page_size(50),
                    )
                    .await
                    .map(|p| p.items)
                {
                    let mut mask = 0i64;
                    for g in groups {
                        mask |= g.team_group_permissions;
                    }
                    let perms: TeamGroupPermissions = mask.into();
                    if perms.contains(TeamGroupPermission::TeamAdmin)
                        || perms.contains(TeamGroupPermission::TeamEdit)
                        || perms.contains(TeamGroupPermission::GroupEdit)
                    {
                        role = TeamRole::Admin;
                    }
                }
            }

            if matches!(role, TeamRole::Member) && matches!(user_team.role.0, TeamRole::Member) {
                // Nothing to change.
                continue;
            }

            UserTeam::repository()
                .update(user_team.id, UserTeam::update().role(TeamRoleJson(role)))
                .await
                .map_err(|e| {
                    crate::error!("failed to update UserTeam.role: {e}");
                    crate::common::Error::NotFound(format!("update failed: {e}"))
                })?;

            response.updated += 1;
            match role {
                TeamRole::Owner => response.owners_set += 1,
                TeamRole::Admin => response.admins_set += 1,
                TeamRole::Member => response.members_set += 1,
            }
        }

        if page_num >= page.total_pages {
            break;
        }
        page_num += 1;
    }

    Ok(response)
}
