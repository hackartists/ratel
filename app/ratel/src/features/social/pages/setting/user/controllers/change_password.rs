use super::super::*;
use crate::features::social::types::SocialError;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangePasswordRequest {
    pub current_password: String,
    pub new_password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangePasswordResponse {
    pub success: bool,
}

#[post("/api/me/password", user: crate::features::auth::User)]
pub async fn change_password_handler(body: ChangePasswordRequest) -> Result<ChangePasswordResponse> {
    use crate::common::utils::password::hash_password;

    let stored_password = user.password.clone().unwrap_or_default();
    if stored_password.is_empty() {
        return Err(SocialError::IncorrectCurrentPassword.into());
    }

    let current_hashed = hash_password(&body.current_password);
    if current_hashed != stored_password {
        return Err(SocialError::IncorrectCurrentPassword.into());
    }

    if body.new_password.len() < 8 {
        return Err(SocialError::PasswordTooShort.into());
    }

    let new_hashed = hash_password(&body.new_password);
    let updater = crate::features::auth::User::update().password(new_hashed);
    crate::features::auth::User::repository()
        .update(user.id, updater)
        .await?;

    Ok(ChangePasswordResponse { success: true })
}
