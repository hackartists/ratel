pub mod delete_material;
pub mod get_ai_moderator_config;
pub mod list_materials;
pub mod update_ai_moderator_config;
pub mod upload_material;

pub use delete_material::*;
pub use get_ai_moderator_config::*;
pub use list_materials::*;
pub use update_ai_moderator_config::*;
pub use upload_material::*;

use super::*;

#[cfg(feature = "server")]
pub(crate) async fn require_premium(user: &crate::features::auth::User) -> Result<()> {
    use crate::features::membership::models::{MembershipTier, UserMembership};

    let membership = UserMembership::find_by_user(&user.pk().to_string()).await?;

    let is_paid = membership
        .as_ref()
        .map_or(false, |m| m.membership_pk != MembershipTier::Free);

    if !is_paid {
        return Err(AiModeratorError::PremiumRequired.into());
    }
    Ok(())
}
