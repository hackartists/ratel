use crate::common::*;
use crate::features::activity::models::SpaceScore;
use crate::features::character::leveling;
use crate::features::character::models::{CharacterXp, CharacterXpSource};

/// Apply the change in `SpaceScore.total_score` for a (user, space) into the
/// user's CharacterXp. Idempotent under stream replay: a re-delivered MODIFY
/// event with the same `score.total_score` produces zero delta and is a no-op.
///
/// `score`: the *new* SpaceScore (post-MODIFY image, or post-INSERT image).
pub async fn apply_character_xp_delta(score: SpaceScore) -> crate::common::Result<()> {
    let user_pk: Partition = match score.user_pk.clone() {
        crate::features::activity::types::AuthorPartition::User(id) => Partition::User(id),
        crate::features::activity::types::AuthorPartition::Team(id) => Partition::Team(id),
        crate::features::activity::types::AuthorPartition::Unknown => {
            tracing::warn!(
                space_pk = %score.space_pk,
                "apply_character_xp_delta: unknown author partition; skipping"
            );
            return Ok(());
        }
    };
    let space_pk_str = match &score.space_pk {
        Partition::Space(s) => s.clone(),
        _ => {
            tracing::warn!(
                user_pk = %user_pk,
                space_pk = %score.space_pk,
                "apply_character_xp_delta: unexpected space_pk variant; skipping"
            );
            return Ok(());
        }
    };

    let last_seen = CharacterXpSource::get_for(&user_pk, &space_pk_str)
        .await?
        .map(|r| r.last_seen_score)
        .unwrap_or(0);

    let new_total = score.total_score;
    let delta = new_total - last_seen;

    if delta == 0 {
        // Replay; nothing to do.
        return Ok(());
    }

    if delta < 0 {
        // Score decreased — spec Q3 says XP is monotonic. Don't debit, but
        // do advance last_seen so we don't re-apply the same negative delta.
        tracing::warn!(
            user_pk = %user_pk,
            space = %space_pk_str,
            last_seen,
            new_total,
            "negative SpaceScore delta — last_seen advanced, CharacterXp unchanged"
        );
        // Natural-key upsert — overwrite the last_seen marker even when the
        // row already exists.
        let _ = CharacterXpSource::new(user_pk.clone(), space_pk_str.clone(), new_total)
            .save()
            .await;
        return Ok(());
    }

    // Read current CharacterXp; carry the loaded (or fresh) row into `save()`
    // so the natural-key upsert preserves `id` / `created_at` on an existing
    // row and inserts a complete row on the very first delta for this user.
    let loaded = CharacterXp::get_by_user(&user_pk).await?;

    let prev_level = loaded.as_ref().map(|x| x.level).unwrap_or(1);
    let prev_total_sp_granted = loaded
        .as_ref()
        .map(|x| x.total_sp_granted)
        .unwrap_or_else(|| leveling::total_sp_granted(1));

    let mut xp = loaded.unwrap_or_else(|| CharacterXp::new(user_pk.clone()));

    let new_total_xp = xp.total_xp + delta;
    let new_level = leveling::level_from_xp(new_total_xp);
    let new_sp_granted = leveling::total_sp_granted(new_level);
    let now = crate::common::utils::time::get_now_timestamp_millis();

    xp.total_xp = new_total_xp;
    xp.level = new_level;
    xp.total_sp_granted = new_sp_granted;
    xp.updated_at = now;
    xp.save().await?;

    // Record last_seen so future deltas are correct.
    CharacterXpSource::new(user_pk.clone(), space_pk_str, new_total)
        .save()
        .await?;

    if new_level != prev_level {
        tracing::info!(
            user_pk = %user_pk,
            old_level = prev_level,
            new_level,
            new_sp = new_sp_granted - prev_total_sp_granted,
            "character level up"
        );
    }

    Ok(())
}
