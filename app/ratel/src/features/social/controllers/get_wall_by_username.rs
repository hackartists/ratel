#[cfg(feature = "server")]
use crate::auth::UserTeam;
use crate::features::social::*;
#[cfg(feature = "server")]
use crate::features::sub_team::models::{SubTeamApplication, SubTeamApplicationStatus};
use crate::social::pages::member::dto::TeamRole;
use crate::{auth::User, *};

/// Returns the **applicant team's** username if the viewer is admin/owner
/// of some team that has an in-flight application (Pending / Returned)
/// targeting `wall_team_id`. Returns `None` otherwise. The lookup walks
/// the viewer's UserTeam rows (filtered for admin/owner role) and
/// queries `SubTeamApplication::find_by_applicant_all` for each.
/// In practice the list is short — most users belong to 1–2 teams.
#[cfg(feature = "server")]
async fn viewer_has_independent_team(viewer_pk: &Partition) -> bool {
    let Ok(user_teams) = UserTeam::find_by_user(viewer_pk).await else {
        return false;
    };

    for ut in user_teams {
        if !ut.role.0.is_admin_or_owner() {
            continue;
        }
        let team_pk: Partition = match ut.team_pk.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };
        let team_uuid = match &team_pk {
            Partition::Team(id) => match uuid::Uuid::parse_str(id) {
                Ok(uuid) => uuid,
                Err(_) => continue,
            },
            _ => continue,
        };
        let team = match crate::posts::models::Team::get_by_id(team_uuid).await {
            Ok(Some(t)) => t,
            _ => continue,
        };
        if team.parent_team_id.is_none() && team.pending_parent_team_id.is_none() {
            return true;
        }
    }
    false
}

#[cfg(feature = "server")]
async fn find_viewer_pending_application_for(
    viewer_pk: &Partition,
    wall_team_id: &TeamPartition,
) -> Option<String> {
    let wall_team_uuid = wall_team_id.0.clone();

    let user_teams = UserTeam::find_by_user(viewer_pk).await.ok()?;

    for ut in user_teams {
        if !ut.role.0.is_admin_or_owner() {
            continue;
        }
        let applicant_pk: Partition = match ut.team_pk.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let Ok(apps) = SubTeamApplication::find_by_applicant_all(&applicant_pk).await else {
            continue;
        };

        // Any application that the applicant might still want to
        // review on the status page — Pending (waiting), Returned
        // (revise & resubmit), Approved (welcome message + post-decision
        // info), or Rejected (rejection reason). Only `Draft` (never
        // submitted) and `Cancelled` are skipped — those have no
        // meaningful status view.
        let matched = apps.iter().any(|a| {
            a.parent_team_id == wall_team_uuid
                && matches!(
                    a.status,
                    SubTeamApplicationStatus::Pending
                        | SubTeamApplicationStatus::Returned
                        | SubTeamApplicationStatus::Approved
                        | SubTeamApplicationStatus::Rejected
                )
        });
        if matched {
            return Some(ut.username.clone());
        }
    }
    None
}

#[get("/api/social/:username", user: OptionalUser)]
pub async fn get_wall_by_username(username: String) -> Result<Wall> {
    use crate::auth::UserFollow;

    let users = WallUser::find_by_username(username).await?;

    if users.is_empty() {
        Err(SocialError::InvalidUserName)?;
    }

    let user = user.0;

    let is_following = if let Some(u) = &user {
        let target_pk = match &users[0] {
            WallUser::User(u) => u.pk(),
            WallUser::Team(t) => t.partition(),
        };
        UserFollow::find_follower(&target_pk, &u.pk())
            .await?
            .is_some()
    } else {
        false
    };

    let mut wall = users[0].clone().into();

    match &mut wall {
        Wall::User {
            id,
            can_edit,
            following,
            ..
        } => {
            *following = is_following;
            if let Some(u) = user {
                let pk_id: UserPartition = u.pk().into();
                if &pk_id == id {
                    *can_edit = true;
                }
            }
        }
        Wall::Team {
            id,
            role,
            following,
            viewer_pending_applicant_username,
            viewer_has_eligible_applicant_team,
            ..
        } => {
            *following = is_following;
            if let Some(u) = user {
                let team_pk: Partition = id.clone().into();

                // Member check
                let member = UserTeam::get_membership(&u.pk(), &team_pk).await?;
                if let Some(m) = member {
                    *role = Some(m.role.0);
                }

                // Pending application check — only fill if viewer is
                // NOT yet a member; otherwise the HUD already routes
                // to the management page and we can skip the query
                // cost. Scans the viewer's admin/owner teams and asks
                // each one's application history for a row whose
                // parent matches this wall team and whose status is
                // still in-flight (Pending / Returned).
                if role.is_none() {
                    *viewer_pending_applicant_username =
                        find_viewer_pending_application_for(&u.pk(), id).await;
                    if viewer_pending_applicant_username.is_none() {
                        *viewer_has_eligible_applicant_team =
                            viewer_has_independent_team(&u.pk()).await;
                    }
                }
            }
        }
    }

    Ok(wall)
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "user_type")]
pub enum Wall {
    User {
        id: UserPartition,
        display_name: String,
        username: String,
        profile_url: String,
        description: String,
        can_edit: bool,
        following: bool,
        created_at: i64,
    },
    Team {
        id: TeamPartition,
        display_name: String,
        username: String,
        profile_url: String,
        description: String,
        role: Option<TeamRole>,
        following: bool,
        created_at: i64,
        #[serde(default)]
        is_parent_eligible: bool,
        #[serde(default)]
        min_sub_team_members: i32,
        #[serde(default)]
        min_sub_team_age_days: i32,
        #[serde(default)]
        viewer_pending_applicant_username: Option<String>,
        #[serde(default)]
        viewer_has_eligible_applicant_team: bool,
    },
}

/// Union of the two entity kinds a `/social/:username` wall can resolve to.
///
/// Postgres migration: `User` and `Team` are now independent Postgres
/// entities (no shared DynamoDB `gsi2` "find_by_username" index spanning
/// both), so the old `#[derive(DynamoEntity)]` single-query lookup is
/// replaced by [`WallUser::find_by_username`] probing each entity's own
/// `find_by_username`. `Team` is server-only, so this whole type is
/// server-gated — it is never sent over the wire (`Wall` is the public DTO).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum WallUser {
    User(User),
    Team(crate::posts::models::Team),
}

#[cfg(feature = "server")]
impl WallUser {
    /// Probes `User::find_by_username` then `Team::find_by_username` for an
    /// exact match, mirroring the old shared-GSI lookup (which could in
    /// principle return either kind for a given username).
    pub async fn find_by_username(username: String) -> Result<Vec<Self>> {
        let mut results = Vec::new();
        if let Some(user) = User::find_by_username(&username).await? {
            results.push(WallUser::User(user));
        }
        if let Some(team) = crate::posts::models::Team::find_by_username(&username).await? {
            results.push(WallUser::Team(team));
        }
        Ok(results)
    }
}

#[cfg(feature = "server")]
impl Into<Wall> for WallUser {
    fn into(self) -> Wall {
        match self {
            WallUser::User(u) => Wall::User {
                id: u.pk().into(),
                display_name: u.display_name,
                username: u.username,
                profile_url: u.profile_url,
                description: u.description,
                can_edit: false,
                following: false,
                created_at: u.created_at,
            },
            WallUser::Team(t) => Wall::Team {
                id: t.partition().into(),
                display_name: t.display_name,
                username: t.username,
                profile_url: t.profile_url,
                description: t.description,
                role: None,
                following: false,
                created_at: t.created_at,
                is_parent_eligible: t.is_parent_eligible,
                min_sub_team_members: t.min_sub_team_members,
                min_sub_team_age_days: t.min_sub_team_age_days,
                viewer_pending_applicant_username: None,
                viewer_has_eligible_applicant_team: false,
            },
        }
    }
}
