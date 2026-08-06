use crate::common::*;
use crate::features::character::dto::CharacterResponse;
use crate::features::character::leveling;
use crate::features::character::types::{CharacterError, SkillId};

#[post("/api/me/skills/{skill_id}/level-up", user: crate::features::auth::User)]
pub async fn level_up_handler(skill_id: String) -> Result<CharacterResponse> {
    use crate::features::character::models::{CharacterSkill, CharacterXp};

    let id = SkillId::from_str(&skill_id).ok_or(CharacterError::SkillNotFound)?;
    if !id.is_mvp() {
        return Err(CharacterError::SkillNotReleased.into());
    }

    let user_pk = user.pk();

    // For computing unspent SP we need the "logical" CharacterXp — fall back
    // to a fresh row when the user has never accumulated XP. That fresh row
    // has the level-1 SP grant baked in, so first-time level-ups still work.
    // Carrying the loaded (or fresh) row into the upsert preserves both the
    // surrogate `id` and `created_at`.
    let mut xp = CharacterXp::get_by_user(&user_pk)
        .await?
        .unwrap_or_else(|| CharacterXp::new(user_pk.clone()));

    // Load the skill row (or a fresh level-0 one) so the upsert preserves its
    // `created_at`. `cur_level` is the on-disk level (0 when absent).
    let mut skill = CharacterSkill::get_for(&user_pk, id)
        .await?
        .unwrap_or_else(|| CharacterSkill::new(user_pk.clone(), id));
    let cur_level = skill.level;

    let cost = leveling::skill_cost_next(cur_level).ok_or(CharacterError::AlreadyMaxLevel)?;
    if xp.unspent_sp() < cost {
        return Err(CharacterError::InsufficientSp.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();

    // Persist the new skill level (natural-key upsert: insert if first,
    // in-place update otherwise).
    skill.level = cur_level + 1;
    skill.updated_at = now;
    skill.save().await?;

    // Bump total_sp_spent and persist. `save()` upserts on `user_pk`, so this
    // both inserts a first-ever row and updates an existing one — no separate
    // create/update branch (unlike DynamoDB's `update_item`).
    xp.total_sp_spent += cost;
    xp.updated_at = now;
    xp.save().await?;

    // Re-read assembled state for the response.
    let (xp_res, skill_rows) = tokio::try_join!(
        CharacterXp::get_by_user(&user_pk),
        CharacterSkill::list_for_user(&user_pk),
    )?;
    let xp = xp_res.ok_or_else(|| Error::NotFound("character row missing after spend".into()))?;
    let skills = CharacterSkill::levels_by_id(&skill_rows);

    Ok(CharacterResponse::from_parts(&xp, skills))
}
