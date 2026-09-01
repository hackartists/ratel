#[cfg(feature = "server")]
use crate::features::posts::models::Team;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::follow::models::SpaceFollowUser;
use crate::features::spaces::pages::actions::actions::follow::*;
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AddFollowUsersRequest {
    pub identifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AddFollowUsersResponse {
    pub added_identifiers: Vec<String>,
}

#[cfg(feature = "server")]
fn normalize_identifier(raw: &str) -> Option<(String, bool)> {
    let value = raw.trim().trim_start_matches('@').to_ascii_lowercase();
    if value.is_empty() {
        return None;
    }
    let is_email = value.contains('@');
    Some((value, is_email))
}

#[post("/api/spaces/{space_id}/follows/users", role: SpaceUserRole)]
pub async fn add_follow_users(
    space_id: SpacePartition,
    req: AddFollowUsersRequest,
) -> Result<AddFollowUsersResponse> {
    SpaceFollowAction::can_edit(&role)?;

    let mut added_identifiers = vec![];
    let mut seen = std::collections::HashSet::<String>::new();

    for raw_identifier in req.identifiers {
        let (identifier, is_email) = normalize_identifier(&raw_identifier)
            .ok_or_else(|| SpaceFollowError::InvalidTarget)?;
        let de_key = if is_email {
            format!("email:{}", identifier)
        } else {
            format!("username:{}", identifier)
        };
        if !seen.insert(de_key) {
            continue;
        }

        let target_user = if is_email {
            crate::common::models::auth::User::find_by_email(&identifier).await?
        } else {
            match crate::common::models::auth::User::find_by_username(&identifier).await {
                Ok(user) => user,
                Err(err) => {
                    error!("Failed to query user by username: {:?}", err);
                    None
                }
            }
        };
        let follow_user = if let Some(target_user) = target_user {
            SpaceFollowUser::new(
                space_id.clone(),
                target_user.pk(),
                target_user.display_name,
                target_user.profile_url,
                target_user.username,
                target_user.user_type,
                target_user.description,
            )
        } else if !is_email {
            let target_team = Team::find_by_username(&identifier).await?;
            if let Some(team) = target_team {
                SpaceFollowUser::new(
                    space_id.clone(),
                    team.partition(),
                    team.display_name,
                    team.profile_url,
                    team.username,
                    UserType::Team,
                    team.description,
                )
            } else {
                return Err(Error::NotFound(format!("User not found: {}", identifier)));
            }
        } else {
            return Err(Error::NotFound(format!("User not found: {}", identifier)));
        };

        if SpaceFollowUser::get_one(&space_id, &follow_user.user_partition())
            .await?
            .is_some()
        {
            continue;
        }

        follow_user.save().await?;
        added_identifiers.push(identifier);
    }

    Ok(AddFollowUsersResponse { added_identifiers })
}
