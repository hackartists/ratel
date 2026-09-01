use crate::common::models::space::SpaceAdmin;
use crate::features::spaces::pages::apps::apps::general::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SpaceAdminListItem {
    pub user_id: String,
    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub is_owner: bool,
    pub created_at: i64,
}

#[get("/api/spaces/{space_id}/admins", role: SpaceUserRole)]
pub async fn list_space_admins(
    space_id: SpacePartition,
) -> Result<Vec<SpaceAdminListItem>> {
    use crate::common::models::auth::User;
    use crate::common::models::space::SpaceCommon;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_id.into();

    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    let mut admins: Vec<SpaceAdminListItem> = Vec::new();

    // Add the space owner as the first admin
    if let Ok(Some(owner)) = User::find_by_pk_str(&space.user_pk).await {
        let user_id = match owner.pk() {
            Partition::User(id) => id,
            other => other.to_string(),
        };
        admins.push(SpaceAdminListItem {
            user_id,
            display_name: owner.display_name,
            profile_url: owner.profile_url,
            username: owner.username,
            is_owner: true,
            created_at: owner.created_at,
        });
    }

    // Add explicit Space Admins
    let space_admins = SpaceAdmin::find_by_space(&space_pk).await?;

    for sa in space_admins {
        let user_id = match sa.user_pk.parse::<Partition>() {
            Ok(Partition::User(id)) => id,
            _ => sa.user_pk.clone(),
        };
        admins.push(SpaceAdminListItem {
            user_id,
            display_name: sa.display_name,
            profile_url: sa.profile_url,
            username: sa.username,
            is_owner: false,
            created_at: sa.created_at,
        });
    }

    Ok(admins)
}
