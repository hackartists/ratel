use crate::common::models::auth::{AdminUser, User};
use crate::features::admin::*;
use crate::features::admin::types::AdminError;
#[cfg(feature = "server")]
use crate::features::membership::models::{
    ensure_team_membership_monthly_refill, ensure_user_membership_monthly_refill,
};
use crate::features::membership::models::{
    Membership, MembershipTier, TeamMembership, UserMembership,
};
#[cfg(feature = "server")]
use crate::features::posts::models::Team;

use super::MembershipGrantTargetType;

const ENTERPRISE_NAME: &str = "Enterprise";
const PAGE_SIZE: i32 = 10;
const USER_BOOKMARK_PREFIX: &str = "user:";
const TEAM_BOOKMARK_PREFIX: &str = "team:";
const TEAM_PHASE_BOOKMARK: &str = "team";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct EnterpriseMembershipGrantListItem {
    pub target_type: MembershipGrantTargetType,
    pub username: String,
    pub remaining_credits: i64,
    pub max_credits_per_space: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
enum EnterpriseMembershipPhase {
    #[default]
    User,
    Team,
}

/// `page` is a 1-based page number into the (user or team) membership listing
/// for the enterprise tier — the Postgres-era replacement for the old
/// DynamoDB opaque scan continuation token.
fn parse_bookmark(bookmark: Option<String>) -> Result<(EnterpriseMembershipPhase, i64)> {
    match bookmark {
        None => Ok((EnterpriseMembershipPhase::User, 1)),
        Some(bookmark) if bookmark == TEAM_PHASE_BOOKMARK => {
            Ok((EnterpriseMembershipPhase::Team, 1))
        }
        Some(bookmark) if bookmark.starts_with(USER_BOOKMARK_PREFIX) => {
            let page = bookmark[USER_BOOKMARK_PREFIX.len()..]
                .parse::<i64>()
                .map_err(|_| AdminError::InvalidBookmark)?;
            Ok((EnterpriseMembershipPhase::User, page))
        }
        Some(bookmark) if bookmark.starts_with(TEAM_BOOKMARK_PREFIX) => {
            let page = bookmark[TEAM_BOOKMARK_PREFIX.len()..]
                .parse::<i64>()
                .map_err(|_| AdminError::InvalidBookmark)?;
            Ok((EnterpriseMembershipPhase::Team, page))
        }
        Some(bookmark) => {
            crate::error!("invalid bookmark: {bookmark}");
            Err(AdminError::InvalidBookmark.into())
        }
    }
}

#[get("/api/admin/memberships/enterprise?bookmark", _user: AdminUser)]
pub async fn list_enterprise_memberships(
    bookmark: Option<String>,
) -> Result<ListResponse<EnterpriseMembershipGrantListItem>> {
    use postgres::PostgresEntity;
    use postgres::ops::EnumOp;

    let enterprise_tier = MembershipTier::Enterprise(ENTERPRISE_NAME.to_string());
    let Some(enterprise_membership) = Membership::repository()
        .find_one(Membership::query().tier(EnumOp::Eq(enterprise_tier.clone())))
        .await
        .map_err(Error::from)?
    else {
        return Ok(ListResponse::default());
    };

    let (phase, page) = parse_bookmark(bookmark)?;
    let max_credits_per_space = enterprise_membership.max_credits_per_space;
    let mut items = Vec::with_capacity(PAGE_SIZE as usize);

    if matches!(phase, EnterpriseMembershipPhase::User) {
        let user_page = UserMembership::find_by_membership_page(
            enterprise_tier.clone(),
            page,
            PAGE_SIZE as i64,
        )
        .await?;

        for membership in user_page.items {
            let membership = ensure_user_membership_monthly_refill(membership).await?;

            let Some(user) = User::find_by_pk_str(&membership.user_pk).await? else {
                continue;
            };

            items.push(EnterpriseMembershipGrantListItem {
                target_type: MembershipGrantTargetType::User,
                username: user.username,
                remaining_credits: membership.remaining_credits,
                max_credits_per_space,
            });
        }

        if page < user_page.total_pages {
            return Ok(ListResponse {
                items,
                bookmark: Some(format!("{USER_BOOKMARK_PREFIX}{}", page + 1)),
            });
        }

        let team_probe =
            TeamMembership::find_by_membership_page(enterprise_tier.clone(), 1, 1).await?;

        return Ok(ListResponse {
            items,
            bookmark: if team_probe.items.is_empty() {
                None
            } else {
                Some(TEAM_PHASE_BOOKMARK.to_string())
            },
        });
    }

    let team_page = TeamMembership::find_by_membership_page(
        enterprise_tier,
        page,
        PAGE_SIZE as i64,
    )
    .await?;

    for membership in team_page.items {
        let membership = ensure_team_membership_monthly_refill(membership).await?;

        let team = {
            use std::str::FromStr;
            match Partition::from_str(&membership.team_pk) {
                Ok(Partition::Team(team_id)) => match uuid::Uuid::parse_str(&team_id) {
                    Ok(team_id) => Team::get_by_id(team_id).await?,
                    Err(_) => None,
                },
                _ => None,
            }
        };
        let Some(team) = team else {
            continue;
        };

        items.push(EnterpriseMembershipGrantListItem {
            target_type: MembershipGrantTargetType::Team,
            username: team.username,
            remaining_credits: membership.remaining_credits,
            max_credits_per_space,
        });
    }

    Ok(ListResponse {
        items,
        bookmark: if page < team_page.total_pages {
            Some(format!("{TEAM_BOOKMARK_PREFIX}{}", page + 1))
        } else {
            None
        },
    })
}
