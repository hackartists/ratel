use super::dto::{TeamResponse, UpdateTeamRequest};
use super::super::*;
use crate::features::social::types::SocialError;

#[cfg(feature = "server")]
use crate::features::posts::models::Team;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[patch("/api/teams/:username/settings", user: crate::features::auth::User, team: Team, role: crate::features::social::pages::member::dto::TeamRole)]
pub async fn update_team_handler(
    username: String,
    body: UpdateTeamRequest,
) -> Result<TeamResponse> {
    let mut team = team;
    if !role.is_admin_or_owner() {
        return Err(SocialError::SessionNotFound.into());
    }

    let mut need_update_user_team = false;
    let mut updater = Team::update();

    if let Some(nickname) = body.nickname {
        updater = updater.display_name(nickname.clone());
        team.display_name = nickname;
        need_update_user_team = true;
    }
    if let Some(description) = body.description {
        updater = updater.description(description.clone());
        team.description = description;
        need_update_user_team = true;
    }
    if let Some(profile_url) = body.profile_url {
        updater = updater.profile_url(profile_url.clone());
        team.profile_url = profile_url;
        need_update_user_team = true;
    }
    if let Some(dao_address) = body.dao_address {
        updater = updater.dao_address(dao_address.clone());
        team.dao_address = Some(dao_address);
        need_update_user_team = true;
    }
    if let Some(thumbnail_url) = body.thumbnail_url {
        updater = updater.thumbnail_url(thumbnail_url.clone());
        team.thumbnail_url = Some(thumbnail_url);
    }
    let now = chrono::Utc::now().timestamp_millis();
    updater = updater.updated_at(now);
    team.updated_at = now;
    let team = Team::repository().update(team.id, updater).await?;

    if need_update_user_team {
        let team_pk = team.partition();
        let user_teams = crate::features::auth::UserTeam::find_by_team(&team_pk).await?;
        for mut user_team in user_teams {
            user_team.display_name = team.display_name.clone();
            user_team.profile_url = team.profile_url.clone();
            if let Some(ref dao_address) = team.dao_address {
                user_team.dao_address = Some(dao_address.clone());
            }
            user_team.save().await?;
        }
    }

    Ok(TeamResponse::from((team, role.to_legacy_permissions())))
}
