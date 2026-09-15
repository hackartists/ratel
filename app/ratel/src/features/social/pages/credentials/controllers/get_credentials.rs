#[cfg(feature = "server")]
use super::super::models::VerifiedAttributes;
use super::super::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CredentialResponse {
    pub age: Option<u32>,
    pub gender: Option<String>,
    pub university: Option<String>,
}

#[get("/api/me/credentials", user: crate::features::auth::User)]
pub async fn get_credentials_handler() -> Result<CredentialResponse> {
    let res = VerifiedAttributes::get_by_user(&user.pk())
        .await?
        .unwrap_or_default();

    Ok(CredentialResponse {
        age: res.age(),
        gender: res.gender.map(|value| value.to_string()),
        university: res.university,
    })
}
