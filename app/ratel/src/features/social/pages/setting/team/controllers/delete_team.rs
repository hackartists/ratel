use super::dto::DeleteTeamResponse;
use super::super::*;
use crate::features::social::types::SocialError;

#[cfg(feature = "server")]
use crate::features::posts::models::{Team, TeamGroup, TeamOwner};
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[delete("/api/teams/:username/settings", user: crate::features::auth::User, team: Team)]
pub async fn delete_team_handler(username: String) -> Result<DeleteTeamResponse> {
    let conf = super::super::config::get();
    let cli = conf.common.dynamodb();

    let team_pk = team.partition();

    let team_owner = TeamOwner::find_by_team(team.id)
        .await?
        .ok_or(Error::NotFound("Team owner not found".into()))?;

    if team_owner.user_pk != user.pk().to_string() {
        return Err(SocialError::SessionNotFound.into());
    }

    // ── Pre-delete cascade: detach any recognized sub-teams ────────
    // Before removing the Team row, sever each parent→child relationship so
    // the former sub-teams become standalone and their admins are notified.
    // Sub-team CONTENT (posts, spaces, members, messages) is not touched.
    if let Err(e) =
        crate::features::sub_team::services::termination::cascade_parent_delete_to_sub_teams(
            cli,
            &team_pk,
            &team.display_name,
        )
        .await
    {
        crate::error!("delete_team: sub-team cascade failed (proceeding anyway): {e}");
    }

    // Every deletion below runs in a single Postgres transaction — strictly
    // more atomic than the old DynamoDB transact-write (which itself
    // chunked into batches of 25 and thus wasn't atomic across the whole
    // set once a team had more than 25 total rows to remove).
    let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
    let mut deleted_count = 0usize;

    let team_groups = {
        use postgres::ops::UuidOp;
        TeamGroup::repository()
            .with_tx(&tx)
            .find(TeamGroup::query().team_id(UuidOp::Eq(team.id)))
            .await
            .map_err(crate::common::Error::from)?
            .items
    };
    for group in &team_groups {
        TeamGroup::repository()
            .with_tx(&tx)
            .delete(group.id)
            .await
            .map_err(crate::common::Error::from)?;
        deleted_count += 1;
    }

    let user_teams = crate::features::auth::UserTeam::repository()
        .with_tx(&tx)
        .find({
            use postgres::ops::StringOp;
            crate::features::auth::UserTeam::query().team_pk(StringOp::Eq(team_pk.to_string()))
        })
        .await
        .map_err(crate::common::Error::from)?
        .items;
    for user_team in &user_teams {
        crate::features::auth::UserTeam::repository()
            .with_tx(&tx)
            .delete(user_team.id)
            .await
            .map_err(crate::common::Error::from)?;
        deleted_count += 1;
    }

    let user_team_groups = crate::features::auth::UserTeamGroup::repository()
        .with_tx(&tx)
        .find({
            use postgres::ops::StringOp;
            crate::features::auth::UserTeamGroup::query()
                .team_pk(StringOp::Eq(team_pk.to_string()))
        })
        .await
        .map_err(crate::common::Error::from)?
        .items;
    for utg in &user_team_groups {
        crate::features::auth::UserTeamGroup::repository()
            .with_tx(&tx)
            .delete(utg.id)
            .await
            .map_err(crate::common::Error::from)?;
        deleted_count += 1;
    }

    TeamOwner::repository()
        .with_tx(&tx)
        .delete(team_owner.id)
        .await
        .map_err(crate::common::Error::from)?;
    deleted_count += 1;

    Team::repository()
        .with_tx(&tx)
        .delete(team.id)
        .await
        .map_err(crate::common::Error::from)?;
    deleted_count += 1;

    tx.commit().await.map_err(|e| {
        crate::error!("Failed to delete team entities: {e}");
        SocialError::TeamDeleteFailed
    })?;

    Ok(DeleteTeamResponse {
        message: format!("Team '{}' has been successfully deleted", username),
        deleted_count,
    })
}
