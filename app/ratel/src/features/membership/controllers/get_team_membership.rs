use super::*;
use crate::features::auth::User;
use crate::features::membership::controllers::normalize_error;
#[cfg(feature = "server")]
use crate::features::membership::models::ensure_team_membership_monthly_refill;
use crate::features::membership::models::{
    Membership, MembershipTier, TeamMembership, TeamMembershipResponse,
};
use crate::features::membership::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;

#[get("/v3/teams/:username/memberships", user: User, team: Team, role: TeamRole)]
pub async fn get_team_membership_handler(username: String) -> Result<TeamMembershipResponse> {
    let result = async {
        let _ = user;

        if !role.is_admin_or_owner() {
            return Err(Error::NotFound("Permission denied".to_string()));
        }

        let team_membership = TeamMembership::find_by_team(&team.partition().to_string()).await?;

        let (team_membership, membership) = match team_membership {
            Some(team_membership) => {
                let team_membership =
                    ensure_team_membership_monthly_refill(team_membership).await?;
                let membership =
                    Membership::get_by_membership_tier(&team_membership.membership_pk).await?;
                (team_membership, membership)
            }
            None => {
                let free_membership =
                    Membership::get_by_membership_tier(&MembershipTier::Free).await?;

                let team_membership = TeamMembership::new(
                    team.partition().into(),
                    free_membership.tier.clone(),
                    free_membership.duration_days,
                    free_membership.credits,
                )?;
                team_membership.save().await?;

                (team_membership, free_membership)
            }
        };

        let mut resp: TeamMembershipResponse = team_membership.into();
        resp.max_credits_per_space = membership.max_credits_per_space;
        Ok(resp)
    }
    .await;

    result.map_err(normalize_error)
}
