use crate::common::models::auth::AdminUser;
use crate::features::admin::*;
#[cfg(feature = "server")]
use crate::features::auth::UserTeam;
#[cfg(feature = "server")]
use crate::features::posts::models::TeamOwner;
use crate::features::social::pages::member::dto::TeamRole;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct BackfillTeamOwnerRoleResponse {
    pub team_owners_scanned: usize,
    pub user_team_missing: usize,
    pub skipped_already_set: usize,
    pub updated: usize,
}

/// Backfill `UserTeam.role = Owner` for every team's recorded owner.
///
/// Why TeamOwner-driven instead of UserTeam-driven:
/// `TeamOwner` exists once per team and is the single source of truth for
/// ownership. Scanning these rows is far cheaper than sweeping the entire
/// membership table, and the lookup direction (owner → membership) cannot
/// produce false positives — every TeamOwner row implies exactly one
/// `UserTeam` row that should carry `role = Owner`.
///
/// Idempotency:
/// The original DynamoDB implementation did a raw `GetItem` to check whether
/// the `role` attribute was physically *present* on disk (independent of
/// serde's default-on-missing behaviour). Postgres has no sparse-attribute
/// equivalent — the `role` column is NOT NULL, so every row already carries
/// a concrete value. This version instead treats any already-non-`Member`
/// role as "already set" (mirrors `backfill_user_team_role`'s idempotency
/// check), so a manually-demoted owner is never silently re-promoted, but a
/// row that was never explicitly set (still defaulted to `Member`) is.
#[post("/api/admin/migrations/backfill-team-owner-role", _user: AdminUser)]
pub async fn backfill_team_owner_role() -> Result<BackfillTeamOwnerRoleResponse> {
    use crate::features::auth::TeamRoleJson;
    use postgres::PostgresEntity;
    use postgres::ops::StringOp;

    let mut response = BackfillTeamOwnerRoleResponse::default();

    const PAGE_SIZE: i64 = 100;
    let mut page_num: i64 = 1;
    loop {
        let page = TeamOwner::repository()
            .find(TeamOwner::query().page(page_num).page_size(PAGE_SIZE))
            .await
            .map_err(|e| {
                crate::error!("scan failed: {e}");
                crate::common::Error::NotFound(format!("scan failed: {e}"))
            })?;

        if page.items.is_empty() {
            break;
        }

        for team_owner in page.items {
            response.team_owners_scanned += 1;

            let team_pk_str = Partition::Team(team_owner.team_id.to_string()).to_string();

            let existing = UserTeam::repository()
                .find_one(
                    UserTeam::query()
                        .user_pk(StringOp::Eq(team_owner.user_pk.clone()))
                        .team_pk(StringOp::Eq(team_pk_str.clone())),
                )
                .await
                .map_err(|e| {
                    crate::error!(
                        "UserTeam lookup failed for user={} team={}: {e}",
                        team_owner.user_pk, team_pk_str,
                    );
                    crate::common::Error::NotFound(format!("lookup failed: {e}"))
                })?;

            let Some(user_team) = existing else {
                // TeamOwner exists but no membership row — data
                // inconsistency from legacy. Log + skip rather than
                // upserting a partial row.
                tracing::warn!(
                    user_pk = %team_owner.user_pk,
                    team_pk = %team_pk_str,
                    "TeamOwner has no matching UserTeam row — skipping"
                );
                response.user_team_missing += 1;
                continue;
            };

            if !matches!(user_team.role.0, TeamRole::Member) {
                response.skipped_already_set += 1;
                continue;
            }

            UserTeam::repository()
                .update(
                    user_team.id,
                    UserTeam::update().role(TeamRoleJson(TeamRole::Owner)),
                )
                .await
                .map_err(|e| {
                    crate::error!(
                        "UserTeam update failed for user={} team={}: {e}",
                        team_owner.user_pk, team_pk_str,
                    );
                    crate::common::Error::NotFound(format!("update failed: {e}"))
                })?;
            response.updated += 1;
        }

        if page_num >= page.total_pages {
            break;
        }
        page_num += 1;
    }

    tracing::info!(
        team_owners_scanned = response.team_owners_scanned,
        updated = response.updated,
        skipped_already_set = response.skipped_already_set,
        user_team_missing = response.user_team_missing,
        "TeamOwner-driven role backfill complete"
    );

    Ok(response)
}
