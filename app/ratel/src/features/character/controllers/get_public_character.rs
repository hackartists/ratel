use crate::common::*;
use crate::features::character::dto::PublicCharacterResponse;

#[get("/api/users/{username}/character")]
pub async fn get_public_character_handler(username: String) -> Result<PublicCharacterResponse> {
    use crate::common::models::auth::User;
    use crate::features::character::models::CharacterXp;

    // `User` still lives in DynamoDB (owned by the auth feature), so the
    // username lookup keeps using the DynamoDB client.
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let opt = User::opt().limit(1);
    let (users, _) = User::find_by_username(cli, &username, opt).await?;
    let target = users
        .into_iter()
        .next()
        .ok_or_else(|| Error::NotFound(format!("no user with username {username}")))?;

    let xp = CharacterXp::get_by_user(&target.pk).await?;
    let level = xp.map(|x| x.level).unwrap_or(1);

    Ok(PublicCharacterResponse { level })
}
