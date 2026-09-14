use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateUserProfileRequest {
    pub nickname: Option<String>,
    pub profile_url: Option<String>,
    pub description: Option<String>,
}

#[post("/api/auth/profile", user: User)]
pub async fn update_user_profile_handler(
    body: UpdateUserProfileRequest,
) -> Result<User> {
    let mut updater = User::update();
    let mut has_update = false;

    if let Some(nickname) = &body.nickname {
        updater = updater.display_name(nickname.clone());
        has_update = true;
    }

    if let Some(profile_url) = &body.profile_url {
        updater = updater.profile_url(profile_url.clone());
        has_update = true;
    }

    if let Some(description) = &body.description {
        updater = updater.description(description.clone());
        has_update = true;
    }

    let updated_user = if has_update {
        User::repository().update(user.id, updater).await?
    } else {
        user
    };

    Ok(updated_user)
}
