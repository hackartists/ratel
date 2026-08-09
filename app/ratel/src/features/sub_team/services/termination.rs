use crate::common::*;
use crate::features::posts::models::Team;
use crate::features::sub_team::models::SubTeamLink;
use crate::features::sub_team::services::application_lifecycle::resolve_team_admins;
use crate::features::sub_team::types::SubTeamError;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Parse a `Partition::Team(id)` into its `Uuid` — Postgres `Team` rows are
/// keyed by the raw uuid, not the `"TEAM#…"` partition string.
#[cfg(feature = "server")]
fn team_uuid(team_pk: &Partition) -> Option<Uuid> {
    match team_pk {
        Partition::Team(id) => Uuid::parse_str(id).ok(),
        _ => None,
    }
}

/// Sever a single parent↔child relationship:
///   1. Delete the `SubTeamLink` row (Postgres)
///   2. Clear child `Team.parent_team_id` (DynamoDB)
/// Leaves all sub-team content (posts, spaces, members, messages) untouched.
///
/// **Migration note:** the DynamoDB version did both writes in one
/// `transact_write_items` call. The `SubTeamLink` now lives in Postgres while
/// `Team` stays in DynamoDB, so the two writes can no longer share a
/// transaction — the link delete happens first, then the child update. A crash
/// between them leaves an orphan `parent_team_id` on the child (recoverable via
/// leave-parent's orphan-clear path) but no dangling link.
#[cfg(feature = "server")]
pub async fn detach_sub_team_link(
    _cli: &aws_sdk_dynamodb::Client,
    parent_pk: &Partition,
    child_pk: &Partition,
    child_id: &str,
) -> Result<()> {
    let now = crate::common::utils::time::get_now_timestamp_millis();

    SubTeamLink::delete_link(parent_pk, child_id).await.map_err(|e| {
        crate::error!("detach_sub_team_link: link delete failed: {e}");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;

    let child_uuid = team_uuid(child_pk).ok_or_else(|| {
        crate::error!("detach_sub_team_link: unexpected child pk variant");
        Error::from(SubTeamError::ApplicationStateMismatch)
    })?;
    Team::repository()
        .update(
            child_uuid,
            Team::update().parent_team_id(None).updated_at(now),
        )
        .await
        .map_err(|e| {
            crate::error!("detach_sub_team_link: child clear failed: {:?}", e);
            Error::from(SubTeamError::ApplicationStateMismatch)
        })?;

    Ok(())
}

/// List all sub-team links under a given parent's pk. Used by the parent-delete
/// cascade to enumerate every child that needs detaching before Team removal.
#[cfg(feature = "server")]
pub async fn list_sub_team_links_for_cascade(parent_pk: &Partition) -> Result<Vec<SubTeamLink>> {
    SubTeamLink::list_for_parent(parent_pk).await
}

/// Notify every admin/owner of `target_pk` with the provided payload.
/// Best-effort — per-recipient failures are logged and swallowed.
#[cfg(feature = "server")]
pub async fn notify_team_admins(
    cli: &aws_sdk_dynamodb::Client,
    target_pk: &Partition,
    payload_for: impl Fn() -> InboxPayload,
) {
    let admins = resolve_team_admins(cli, target_pk).await.unwrap_or_default();
    for u in admins {
        let payload = payload_for();
        if let Err(e) = crate::common::utils::inbox::create_inbox_row(u, payload).await {
            crate::error!("notify_team_admins failed: {e}");
        }
    }
}

/// Sub-team-side landing for deregister / leave notifications.
#[cfg(feature = "server")]
pub async fn build_sub_team_parent_url(
    _cli: &aws_sdk_dynamodb::Client,
    sub_team_id: &str,
) -> String {
    let username = match Uuid::parse_str(sub_team_id) {
        Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
            .await
            .ok()
            .flatten()
            .map(|t| t.username)
            .unwrap_or_default(),
        Err(_) => String::new(),
    };
    if username.is_empty() {
        format!("/{sub_team_id}")
    } else {
        format!("/{username}/sub-teams/application")
    }
}

/// Parent-side sub-team management dashboard.
#[cfg(feature = "server")]
pub async fn build_parent_sub_teams_url(
    _cli: &aws_sdk_dynamodb::Client,
    parent_team_id: &str,
) -> String {
    let username = match Uuid::parse_str(parent_team_id) {
        Ok(uuid) => crate::features::posts::models::Team::get_by_id(uuid)
            .await
            .ok()
            .flatten()
            .map(|t| t.username)
            .unwrap_or_default(),
        Err(_) => String::new(),
    };
    if username.is_empty() {
        format!("/{parent_team_id}")
    } else {
        format!("/{username}/sub-teams/manage")
    }
}

/// Parent-delete cascade: enumerate every SubTeamLink under `parent_pk`,
/// detach each one, and notify the former sub-team admins. Sub-team CONTENT is
/// NEVER touched here — this only severs the relationship. Keeps the `cli`
/// argument for the external `Team` writes / inbox notifications.
#[cfg(feature = "server")]
pub async fn cascade_parent_delete_to_sub_teams(
    cli: &aws_sdk_dynamodb::Client,
    parent_pk: &Partition,
    parent_display_name: &str,
) -> Result<()> {
    let former_parent_team_id = match parent_pk {
        Partition::Team(id) => id.clone(),
        _ => return Ok(()),
    };
    let former_parent_team_name = parent_display_name.to_string();

    let links = list_sub_team_links_for_cascade(parent_pk).await?;
    if links.is_empty() {
        return Ok(());
    }

    for link in links {
        let child_id = link.child_team_id.clone();
        let child_pk: Partition = Partition::Team(child_id.clone());

        if let Err(e) = detach_sub_team_link(cli, parent_pk, &child_pk, &child_id).await {
            crate::error!(
                "cascade_parent_delete: detach failed for child={}: {e}",
                child_id
            );
            continue;
        }

        // Notify former sub-team admins.
        let fpt_id = former_parent_team_id.clone();
        let fpt_name = former_parent_team_name.clone();
        let cta_url = build_sub_team_parent_url(cli, &child_id).await;
        notify_team_admins(cli, &child_pk, move || {
            InboxPayload::SubTeamParentDeleted {
                former_parent_team_id: fpt_id.clone(),
                former_parent_team_name: fpt_name.clone(),
                cta_url: cta_url.clone(),
            }
        })
        .await;
    }

    Ok(())
}
