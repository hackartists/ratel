use super::super::*;

#[get("/api/users/:username/pk")]
pub async fn resolve_user_pk_handler(username: String) -> Result<String> {
    let user = crate::features::auth::User::find_by_username(&username)
        .await?
        .ok_or(crate::common::Error::NotFound(format!(
            "User not found: {}",
            username
        )))?;

    Ok(user.pk().to_string())
}
