use super::super::*;
#[cfg(feature = "server")]
use crate::features::membership::models::ensure_user_membership_monthly_refill;
use crate::features::membership::models::UserMembership;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "MembershipGetMembershipMembershipResponse"))]
pub struct MembershipResponse {
    pub tier: String,
    pub total_credits: i64,
    pub remaining_credits: i64,
    pub expired_at: i64,
    pub next_membership: Option<String>,
}

#[get("/api/me/membership", user: crate::features::auth::User)]
pub async fn get_membership_handler() -> Result<MembershipResponse> {
    let membership = UserMembership::find_by_user(&user.pk().to_string()).await?;

    match membership {
        Some(membership) => {
            let m = ensure_user_membership_monthly_refill(membership).await?;
            Ok(MembershipResponse {
                tier: m.membership_pk.to_string(),
                total_credits: m.total_credits,
                remaining_credits: m.remaining_credits,
                expired_at: m.expired_at,
                next_membership: m.next_membership.map(|next| next.to_string()),
            })
        }
        None => Ok(MembershipResponse {
            tier: "Free".to_string(),
            total_credits: 0,
            remaining_credits: 0,
            expired_at: i64::MAX,
            next_membership: None,
        }),
    }
}
