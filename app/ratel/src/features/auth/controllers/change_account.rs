// Migrated from packages/main-api/src/controllers/v3/auth/change_account.rs
use crate::features::auth::models::*;
use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use crate::features::auth::utils::sha256_baseurl::sha256_base64url;
#[cfg(feature = "server")]
use crate::features::auth::utils::uuid::sorted_uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangeAccountRequest {
    pub device_id: String,
    pub user_pk: Partition,
    pub refresh_token: String,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct ChangeAccountResponse {
    #[serde(flatten)]
    pub user: User,
    pub refresh_token: Option<String>,
}

#[post("/api/auth/change-account", session: Extension<tower_sessions::Session>)]
pub async fn change_account_handler(req: ChangeAccountRequest) -> Result<ChangeAccountResponse> {
    let Extension(session) = session;

    let rt = UserRefreshToken::get_by_user_device(&req.user_pk, &req.device_id)
        .await?
        .ok_or(AuthError::UserNotFound)?;

    let now_ts = crate::common::utils::time::now();

    if rt.revoked {
        return Err(AuthError::TokenRevoked.into());
    }
    if let Some(exp) = rt.expired_at {
        if exp < now_ts {
            return Err(AuthError::TokenExpired.into());
        }
    }

    let req_hash = sha256_base64url(&req.refresh_token);
    if rt.token_hash != req_hash {
        return Err(AuthError::InvalidRefreshToken.into());
    }

    let new_plain = sorted_uuid();
    let new_hash = sha256_base64url(&new_plain);

    rt.rotate(new_hash, now_ts).await?;

    session
        .insert(SESSION_KEY_USER_ID, rt.user_pk.clone())
        .await?;

    let user = User::find_by_pk(&req.user_pk).await?.unwrap_or_default();

    Ok(ChangeAccountResponse {
        user,
        refresh_token: Some(new_plain),
    })
}
