use crate::features::my_follower::controllers::dto::FollowUserProfile;
use crate::features::my_follower::*;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;
use std::collections::HashMap;

/// Resolve display profiles for a set of `Partition`s (users or teams).
///
/// Postgres migration note: DynamoDB `batch_get` fetched all rows for a
/// partition-key set in one round trip. The Postgres `Query` builder does not
/// expose the primary-key (`id`) column for `IN`-style lookups (pk lookups go
/// through `repository().get(id)` one at a time — see
/// `postgres-macros/src/entity/query.rs`), so this resolves each id
/// individually via `User::find_by_pk` / `Team::get_by_id`. Follow/following
/// pages are capped at a small page size, so the extra round trips are bounded
/// and the returned map/behavior is unchanged.
#[cfg(feature = "server")]
pub async fn build_profiles(
    target_pks: &[Partition],
) -> Result<HashMap<String, FollowUserProfile>> {
    let mut profiles = HashMap::new();

    for pk in target_pks {
        match pk {
            Partition::Team(id) => {
                let Ok(uuid) = uuid::Uuid::parse_str(id) else {
                    continue;
                };
                if let Some(team) = Team::get_by_id(uuid).await? {
                    profiles.insert(
                        pk.to_string(),
                        FollowUserProfile {
                            display_name: team.display_name,
                            profile_url: team.profile_url,
                            username: team.username,
                            user_type: UserType::Team,
                            description: team.description,
                        },
                    );
                }
            }
            _ => {
                if let Some(user) = crate::features::auth::User::find_by_pk(pk).await? {
                    profiles.insert(
                        pk.to_string(),
                        FollowUserProfile {
                            display_name: user.display_name,
                            profile_url: user.profile_url,
                            username: user.username,
                            user_type: user.user_type,
                            description: user.description,
                        },
                    );
                }
            }
        }
    }

    Ok(profiles)
}

#[cfg(not(feature = "server"))]
pub async fn build_profiles(
    _target_pks: &[Partition],
) -> Result<HashMap<String, FollowUserProfile>> {
    Ok(HashMap::new())
}
