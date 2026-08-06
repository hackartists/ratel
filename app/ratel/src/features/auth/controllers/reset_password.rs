// Backward-compat: password reset for already-shipped mobile apps (the Android
// build in App Store review). New passwordless clients never call this.
use crate::features::auth::models::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct ResetPasswordRequest {
    pub email: String,
    pub password: String,
    pub code: String,
}

#[post("/api/auth/reset")]
pub async fn reset_password_handler(req: ResetPasswordRequest) -> Result<User> {
    let email = req.email;
    let code = req.code;
    let password = req.password;

    crate::features::auth::controllers::verify_code::verify_email_code(&email, &code).await?;

    let user = User::find_by_email(&email)
        .await?
        .ok_or(Error::NotFound(format!("Not Registered Email: {}", email)))?;

    let hashed_password = crate::common::utils::password::hash_password(&password);

    let user = User::repository()
        .update(user.id, User::update().password(hashed_password))
        .await?;

    Ok(user)
}
