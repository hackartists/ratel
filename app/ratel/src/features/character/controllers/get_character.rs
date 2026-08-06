use crate::common::*;
use crate::features::character::dto::CharacterResponse;

#[get("/api/me/character", user: crate::features::auth::User)]
pub async fn get_character_handler() -> Result<CharacterResponse> {
    use crate::features::character::models::{CharacterSkill, CharacterXp};

    let user_pk = user.pk();

    // Sequential, NOT `tokio::try_join!`: racing two pooled-connection queries
    // means a cancellation (try_join! aborts the sibling the instant one errs)
    // can drop a query mid-`.await`, wedging its sqlx connection on the
    // untimed release-ping and permanently leaking that pool permit. Under the
    // shared test pool a few such leaks exhaust `max_connections` and later
    // requests hang ("pool timed out"). Each query here fully completes and
    // releases its connection before the next starts.
    let xp_res = CharacterXp::get_by_user(&user_pk).await?;
    let skill_rows = CharacterSkill::list_for_user(&user_pk).await?;

    let xp = xp_res.unwrap_or_else(|| CharacterXp::new(user_pk.clone()));
    let skills = CharacterSkill::levels_by_id(&skill_rows);

    Ok(CharacterResponse::from_parts(&xp, skills))
}
