use crate::common::*;
#[cfg(feature = "server")]
use crate::features::essence::models::Essence;
use crate::features::essence::types::*;
use crate::features::auth::User;

/// Remove an Essence row by its encoded id. Detach-only — the referenced
/// Post / Poll / Quiz / Comment is untouched. If the user later updates
/// the same source, a new Essence row will be recreated.
///
/// Routes through `Essence::detach_by_source_id` so the per-user counter row
/// is decremented in the same call.
#[delete("/api/essences/:essence_id", user: User)]
pub async fn delete_essence_handler(essence_id: String) -> Result<()> {
    // Confirm the row exists under the caller's pk before acting — guards
    // against a user deleting someone else's row via a guessed id.
    match Essence::get_for_user(&user.pk, &essence_id).await {
        Ok(Some(_)) => {}
        Ok(None) => return Err(EssenceError::NotFound.into()),
        Err(e) => {
            crate::error!("essence lookup for delete failed: {e}");
            return Err(EssenceError::DeleteFailed.into());
        }
    }

    Essence::detach_by_source_id(&user.pk, essence_id).await
}
