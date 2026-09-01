use super::*;
use crate::features::auth::User;
use crate::features::membership::controllers::normalize_error;
#[cfg(feature = "server")]
use crate::features::membership::models::ensure_user_membership_monthly_refill;
use crate::features::membership::models::{
    Membership, MembershipTier, UserMembership, UserMembershipResponse,
};
use crate::features::membership::*;

#[get("/v3/me/memberships", user: User)]
pub async fn get_membership_handler() -> Result<UserMembershipResponse> {
    let result = async {
        let user_membership = UserMembership::find_by_user(&user.pk().to_string()).await?;

        let (user_membership, membership) = match user_membership {
            Some(user_membership) => {
                let user_membership =
                    ensure_user_membership_monthly_refill(user_membership).await?;
                let membership =
                    Membership::get_by_membership_tier(&user_membership.membership_pk).await?;
                (user_membership, membership)
            }
            None => {
                let free_membership =
                    Membership::get_by_membership_tier(&MembershipTier::Free).await?;

                let user_membership = UserMembership::new(
                    user.pk().into(),
                    free_membership.tier.clone(),
                    free_membership.duration_days,
                    free_membership.credits,
                )?;
                user_membership.save().await?;

                (user_membership, free_membership)
            }
        };

        let mut resp: UserMembershipResponse = user_membership.into();
        resp.max_credits_per_space = membership.max_credits_per_space;
        Ok(resp)
    }
    .await;

    result.map_err(normalize_error)
}
