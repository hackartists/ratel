#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use crate::features::spaces::pages::actions::actions::follow::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CheckFollowUsersRequest {
    pub identifiers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CheckFollowUsersResponse {
    pub existing_identifiers: Vec<String>,
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

#[post("/api/spaces/{space_id}/follows/users/check", role: SpaceUserRole)]
pub async fn check_follow_users(
    space_id: SpacePartition,
    req: CheckFollowUsersRequest,
) -> Result<CheckFollowUsersResponse> {
    SpaceFollowAction::can_edit(&role)?;

    let mut existing_identifiers = vec![];
    let mut seen = std::collections::HashSet::<String>::new();

    for raw_identifier in req.identifiers {
        let Some((identifier, is_email)) = normalize_identifier(&raw_identifier) else {
            continue;
        };
        let de_key = if is_email {
            format!("email:{}", identifier)
        } else {
            format!("username:{}", identifier)
        };
        if !seen.insert(de_key) {
            continue;
        }

        if is_email {
            let user = crate::common::models::auth::User::find_by_email(&identifier).await?;
            if user.is_some() {
                existing_identifiers.push(identifier);
            }
            continue;
        }

        let user = match crate::common::models::auth::User::find_by_username(&identifier).await {
            Ok(user) => user,
            Err(err) => {
                error!("Failed to query user by username: {:?}", err);
                None
            }
        };

        if user.is_some() {
            existing_identifiers.push(identifier);
            continue;
        }

        if let Some(team) = Team::find_by_username(&identifier).await? {
            if team.username == identifier {
                existing_identifiers.push(identifier);
            }
        }
    }

    Ok(CheckFollowUsersResponse {
        existing_identifiers,
    })
}
