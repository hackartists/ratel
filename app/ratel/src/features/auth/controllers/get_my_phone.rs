use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct GetMyPhoneResponse {
    pub phone_number: Option<String>,
}

/// Used by the poll privacy-consent response flow to prefill a logged-in
/// user's already-verified phone number (see `UserPhoneNumber`).
#[mcp_tool(
    name = "get_my_phone",
    description = "Get the current user's linked verified phone number, if any."
)]
#[get("/api/auth/me/phone", user: crate::features::auth::User)]
pub async fn get_my_phone_handler() -> Result<GetMyPhoneResponse> {
    let phone = UserPhoneNumber::find_by_user_pk(&user.pk()).await?;
    Ok(GetMyPhoneResponse {
        phone_number: phone.map(|p| p.phone_number),
    })
}
