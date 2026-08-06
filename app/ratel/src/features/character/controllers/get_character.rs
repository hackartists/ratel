use crate::common::*;
use crate::features::character::dto::CharacterResponse;

#[get("/api/me/character", user: crate::features::auth::User)]
pub async fn get_character_handler() -> Result<CharacterResponse> {
    use crate::features::character::models::{CharacterSkill, CharacterXp};

    let user_pk = user.pk();

    // Fan out the two reads — one CharacterXp single-row point read + the
    // entire CharacterSkill collection for the user.
    let (xp_res, skill_rows) = tokio::try_join!(
        CharacterXp::get_by_user(&user_pk),
        CharacterSkill::list_for_user(&user_pk),
    )?;

    let xp = xp_res.unwrap_or_else(|| CharacterXp::new(user_pk.clone()));
    let skills = CharacterSkill::levels_by_id(&skill_rows);

    Ok(CharacterResponse::from_parts(&xp, skills))
}
