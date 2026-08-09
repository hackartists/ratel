#[cfg(feature = "server")]
use crate::common::models::auth::UserFollow;
use crate::features::auth::OptionalUser;
use crate::features::my_follower::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::features::posts::models::Team;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct FollowStatusResponse {
    pub target_pk: Partition,
    pub target_display_name: String,
    pub target_profile_url: String,
    pub target_description: String,
    pub target_followers_count: i64,
    pub target_followings_count: i64,
    pub is_following: bool,
}

#[get("/api/my-follower/status?target_username", user: OptionalUser)]
pub async fn check_follow_status_handler(
    target_username: String,
) -> Result<FollowStatusResponse> {
    let user: Option<crate::features::auth::User> = user.into();

    // Try user lookup first; treat any lookup failure as "no user found"
    // (mirrors the old catch-all: a lookup error must not fail the whole
    // request — fall through to the team lookup instead).
    let user_lookup = crate::features::auth::User::find_by_username(&target_username)
        .await
        .unwrap_or(None);

    let (target_pk, display_name, profile_url, description, followers_count, followings_count) =
        if let Some(u) = user_lookup {
            (
                u.pk(),
                u.display_name,
                u.profile_url,
                u.description,
                u.followers_count,
                u.followings_count,
            )
        } else {
            // Fallback to team lookup.
            let team = Team::find_by_username(&target_username)
                .await?
                .ok_or(Error::NotFound(format!("Not found: {}", target_username)))?;
            (
                team.partition(),
                team.display_name,
                team.profile_url,
                team.description,
                team.followers,
                0i64,
            )
        };

    let is_following = if let Some(ref user) = user {
        UserFollow::find_follower(&target_pk, &user.pk())
            .await?
            .is_some()
    } else {
        false
    };

    Ok(FollowStatusResponse {
        target_pk,
        target_display_name: display_name,
        target_profile_url: profile_url,
        target_description: description,
        target_followers_count: followers_count,
        target_followings_count: followings_count,
        is_following,
    })
}
