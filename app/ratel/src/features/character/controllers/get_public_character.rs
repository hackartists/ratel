use crate::common::*;
use crate::features::character::dto::PublicCharacterResponse;

#[get("/api/users/{username}/character")]
pub async fn get_public_character_handler(username: String) -> Result<PublicCharacterResponse> {
    use crate::common::models::auth::User;
    use crate::features::character::models::CharacterXp;

    let target = User::find_by_username(&username)
        .await?
        .ok_or_else(|| Error::NotFound(format!("no user with username {username}")))?;

    let xp = CharacterXp::get_by_user(&target.pk()).await?;
    let level = xp.map(|x| x.level).unwrap_or(1);

    Ok(PublicCharacterResponse { level })
}
