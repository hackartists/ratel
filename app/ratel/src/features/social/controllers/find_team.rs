use crate::features::social::controllers::dto::TeamResponse;
use crate::features::social::*;

use crate::features::auth::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;

#[get("/api/teams/find?username", user: OptionalUser)]
pub async fn find_team_handler(username: String) -> Result<TeamResponse> {
    let conf = crate::features::social::config::get();
    let cli = conf.dynamodb();

    let team = Team::find_by_username(&username)
        .await?
        .ok_or(Error::NotFound("Team not found".to_string()))?;

    let user: Option<User> = user.into();

    let role = if let Some(user) = user {
        Team::get_user_role(cli, &team.partition(), &user.pk())
            .await
            .unwrap_or(None)
    } else {
        None
    };

    Ok(TeamResponse::from((team, role)).with_parent_username(cli).await)
}
