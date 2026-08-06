use crate::common::models::auth::{AdminUser, User};
use crate::features::admin::*;
use crate::features::admin::types::AdminError;
use crate::features::membership::models::{
    ENTERPRISE_MAX_CREDITS_PER_SPACE, ENTERPRISE_MONTHLY_REFILL_CREDITS, Membership,
    MembershipResponse, MembershipTier, TeamMembership, UserMembership,
};
use crate::features::posts::models::Team;

const ENTERPRISE_DISPLAY_ORDER: i32 = 999;
const ENTERPRISE_NAME: &str = "Enterprise";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum MembershipGrantTargetType {
    #[default]
    User,
    Team,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct GrantEnterpriseMembershipRequest {
    pub username: String,
    pub target_type: MembershipGrantTargetType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GrantEnterpriseMembershipResponse {
    pub username: String,
    pub target_type: MembershipGrantTargetType,
    pub membership: MembershipResponse,
    pub remaining_credits: i64,
    pub max_credits_per_space: i64,
}

fn build_enterprise_membership(existing: Option<Membership>) -> Membership {
    let now = crate::common::utils::time::now();
    let tier = MembershipTier::Enterprise(ENTERPRISE_NAME.to_string());
    let created_at = existing
        .as_ref()
        .map_or(now, |membership| membership.created_at);
    let id = existing
        .as_ref()
        .map_or_else(uuid::Uuid::now_v7, |membership| membership.id);

    Membership {
        id,
        tier,
        created_at,
        updated_at: now,
        credits: ENTERPRISE_MONTHLY_REFILL_CREDITS,
        price_dollars: 0,
        price_won: 0,
        display_order: ENTERPRISE_DISPLAY_ORDER,
        duration_days: -1,
        max_credits_per_space: ENTERPRISE_MAX_CREDITS_PER_SPACE,
        is_active: true,
    }
}

#[post("/api/admin/memberships/enterprise", _user: AdminUser)]
pub async fn grant_enterprise_membership(
    req: GrantEnterpriseMembershipRequest,
) -> Result<GrantEnterpriseMembershipResponse> {
    use postgres::PostgresEntity;
    use postgres::ops::EnumOp;

    let username = req.username.trim().to_string();
    if username.is_empty() {
        return Err(AdminError::UsernameRequired.into());
    }

    let enterprise_tier = MembershipTier::Enterprise(ENTERPRISE_NAME.to_string());
    let existing_membership = Membership::repository()
        .find_one(Membership::query().tier(EnumOp::Eq(enterprise_tier.clone())))
        .await
        .map_err(Error::from)?;
    let enterprise_membership = build_enterprise_membership(existing_membership);
    Membership::repository()
        .upsert_on(&["tier"], &enterprise_membership)
        .await
        .map_err(Error::from)?;

    let remaining_credits = match req.target_type {
        MembershipGrantTargetType::User => {
            let user = User::find_by_username(&username)
                .await?
                .filter(|user| user.username == username)
                .ok_or_else(|| Error::NotFound("User not found".to_string()))?;

            let mut user_membership = UserMembership::new(
                user.pk().into(),
                enterprise_membership.tier.clone(),
                enterprise_membership.duration_days,
                enterprise_membership.credits,
            )?;
            user_membership.auto_renew = false;
            user_membership.next_membership = None;
            user_membership.monthly_refill_credits = ENTERPRISE_MONTHLY_REFILL_CREDITS;
            user_membership.next_refill_at =
                crate::common::utils::time::add_one_month(crate::common::utils::time::now())
                    .unwrap_or(crate::common::utils::time::now() + 30 * 24 * 60 * 60 * 1_000);
            user_membership.save().await?;
            user_membership.remaining_credits
        }
        MembershipGrantTargetType::Team => {
            let team = Team::find_by_username(&username)
                .await?
                .filter(|team| team.username == username)
                .ok_or_else(|| Error::NotFound("Team not found".to_string()))?;

            let mut team_membership = TeamMembership::new(
                team.partition().into(),
                enterprise_membership.tier.clone(),
                enterprise_membership.duration_days,
                enterprise_membership.credits,
            )?;
            team_membership.auto_renew = false;
            team_membership.next_membership = None;
            team_membership.monthly_refill_credits = ENTERPRISE_MONTHLY_REFILL_CREDITS;
            team_membership.next_refill_at =
                crate::common::utils::time::add_one_month(crate::common::utils::time::now())
                    .unwrap_or(crate::common::utils::time::now() + 30 * 24 * 60 * 60 * 1_000);
            team_membership.save().await?;
            team_membership.remaining_credits
        }
    };

    Ok(GrantEnterpriseMembershipResponse {
        username,
        target_type: req.target_type,
        membership: enterprise_membership.into(),
        remaining_credits,
        max_credits_per_space: ENTERPRISE_MAX_CREDITS_PER_SPACE,
    })
}
