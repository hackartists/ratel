use crate::features::auth::*;

use crate::features::membership::models::{
    Membership, MembershipTier, UserMembership, UserMembershipResponse,
};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct GetMeResponse {
    pub user: Option<User>,
    pub membership: Option<UserMembershipResponse>,
}

#[mcp_tool(name = "get_me", description = "Get current user info and membership details.")]
#[get("/api/auth/me", user: OptionalUser)]
pub async fn get_me_handler() -> Result<GetMeResponse> {
    // Treat a soft-deleted (tombstoned) account as logged-out.
    let user: Option<User> = Option::<User>::from(user).filter(|u| u.deleted_at.is_none());

    let membership = {
        match &user {
            Some(u) => {
                let user_pk = u.pk().to_string();
                match UserMembership::find_by_user(&user_pk).await {
                    Ok(Some(um)) => {
                        let mut resp: UserMembershipResponse = um.clone().into();
                        if let Ok(m) = Membership::get_by_membership_tier(&um.membership_pk).await
                        {
                            resp.max_credits_per_space = m.max_credits_per_space;
                        }
                        Some(resp)
                    }
                    Ok(None) => {
                        // Create a default Free membership if none exists
                        let free_tier = MembershipTier::Free;
                        match Membership::get_by_membership_tier(&free_tier).await {
                            Ok(free_membership) => {
                                let um = UserMembership::new(
                                    u.pk().into(),
                                    free_membership.tier.clone(),
                                    free_membership.duration_days,
                                    free_membership.credits,
                                )
                                .ok();
                                if let Some(ref um) = um {
                                    let _ = um.save().await;
                                }
                                um.map(|m| {
                                    let mut resp: UserMembershipResponse = m.into();
                                    resp.max_credits_per_space =
                                        free_membership.max_credits_per_space;
                                    resp
                                })
                            }
                            _ => None,
                        }
                    }
                    Err(_) => None,
                }
            }
            None => None,
        }
    };

    Ok(GetMeResponse {
        user,
        membership,
    })
}

