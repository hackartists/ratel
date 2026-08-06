use crate::common::models::auth::UserFollow;
use crate::common::models::space::SpaceCommon;
use crate::features::posts::models::Team;
use crate::features::spaces::pages::actions::actions::follow::models::SpaceFollowUser;
use crate::features::spaces::pages::actions::actions::follow::*;
use std::collections::HashSet;
use std::str::FromStr;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct FollowUserItem {
    pub user_pk: Partition,
    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub description: String,
    pub user_type: UserType,
    pub subscribed: bool,
}

#[get(
    "/api/spaces/{space_id}/follows/users?bookmark",
    role: SpaceUserRole,
    user: crate::features::auth::OptionalUser
)]
pub async fn list_follow_users(
    space_id: SpacePartition,
    bookmark: Option<String>,
) -> Result<ListResponse<FollowUserItem>> {
    let space_pk: Partition = space_id.clone().into();
    let is_first_page = bookmark.is_none();

    // Postgres: one page of follow-target rows for this space.
    let (users, bookmark) = SpaceFollowUser::list_by_space(&space_id, bookmark, 10).await?;
    let none_str = Partition::None.to_string();
    let users: Vec<SpaceFollowUser> = users
        .into_iter()
        .filter(|u| u.user_pk != none_str)
        .collect();

    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;
    let (creator_pk, creator_profile) = {
        let mut creator_profile = (
            space.author_display_name.clone(),
            space.author_profile_url.clone(),
            space.author_username.clone(),
            String::new(),
        );
        // Postgres migration: `SpaceCommon.user_pk` is now the bare serialized
        // `Partition` string — parse it back the same way serde would.
        let mut creator_pk: Partition =
            Partition::from_str(&space.user_pk).unwrap_or(Partition::None);

        let mut resolved = false;
        if let Ok(Some(team)) = Team::find_by_username(&space.author_username).await {
            creator_pk = team.partition();
            creator_profile = (
                team.display_name,
                team.profile_url,
                team.username,
                team.description,
            );
            resolved = true;
        }

        if !resolved {
            let found_user = match crate::common::models::auth::User::find_by_username(
                &space.author_username,
            )
            .await
            {
                Ok(user) => user,
                Err(err) => {
                    error!("Failed to query user by username: {:?}", err);
                    None
                }
            };
            if let Some(user) = found_user {
                creator_pk = user.pk();
                creator_profile = (
                    user.display_name,
                    user.profile_url,
                    user.username,
                    user.description,
                );
            }
        }

        (creator_pk, creator_profile)
    };

    let viewer_pk = user.0.as_ref().map(|u| u.pk());
    let subscribed_targets = if let Some(viewer_pk) = viewer_pk.as_ref() {
        let mut targets: Vec<Partition> = users.iter().map(|target| target.user_partition()).collect();
        if !targets.iter().any(|t| *t == creator_pk) {
            targets.push(creator_pk.clone());
        }

        let subs: Vec<UserFollow> = UserFollow::following_targets_in(viewer_pk, &targets).await?;

        subs.into_iter()
            .map(|sub| sub.target_user_pk.to_string())
            .collect::<HashSet<String>>()
    } else {
        HashSet::new()
    };

    let mut items: Vec<FollowUserItem> = users
        .into_iter()
        .map(|u| {
            let user_pk = u.user_partition();
            let subscribed = subscribed_targets.contains(&user_pk.to_string());
            FollowUserItem {
                user_pk,
                display_name: u.display_name,
                profile_url: u.profile_url,
                username: u.username,
                description: u.description,
                user_type: u.user_type.0,
                subscribed,
            }
        })
        .collect();

    if let Some(creator) = items.iter_mut().find(|u| u.user_pk == creator_pk) {
        if creator.description.is_empty() {
            creator.description = creator_profile.3.clone();
        }
    }

    let creator_item = if let Some(idx) = items.iter().position(|u| u.user_pk == creator_pk) {
        let item = items.remove(idx);
        if is_first_page {
            Some(item)
        } else {
            None
        }
    } else {
        if is_first_page {
            let creator = SpaceFollowUser::get_one(&space_id, &creator_pk)
                .await?
                .map(|u| {
                    let user_pk = u.user_partition();
                    let subscribed = subscribed_targets.contains(&user_pk.to_string());
                    FollowUserItem {
                        user_pk,
                        display_name: u.display_name,
                        profile_url: u.profile_url,
                        username: u.username,
                        description: u.description,
                        user_type: u.user_type.0,
                        subscribed,
                    }
                });
            // Only hit the User table when creator_pk is actually a User
            // partition — Team creators fall through to creator_profile below.
            let user_lookup = if matches!(&creator_pk, Partition::User(_)) {
                crate::common::models::auth::User::find_by_pk(&creator_pk).await?
            } else {
                None
            };
            if creator.is_some() {
                creator
            } else if let Some(user) = user_lookup
            {
                Some(FollowUserItem {
                    user_pk: creator_pk.clone(),
                    display_name: user.display_name,
                    profile_url: user.profile_url,
                    username: user.username,
                    description: user.description,
                    user_type: user.user_type,
                    subscribed: subscribed_targets.contains(&creator_pk.to_string()),
                })
            } else {
                Some(FollowUserItem {
                    user_pk: creator_pk.clone(),
                    display_name: creator_profile.0,
                    profile_url: creator_profile.1,
                    username: creator_profile.2,
                    description: creator_profile.3,
                    user_type: match &creator_pk {
                        Partition::Team(_) => UserType::Team,
                        _ => UserType::Individual,
                    },
                    subscribed: subscribed_targets.contains(&creator_pk.to_string()),
                })
            }
        } else {
            None
        }
    };

    if let Some(creator_item) = creator_item {
        items.insert(0, creator_item);
    }

    Ok(ListResponse { items, bookmark })
}
