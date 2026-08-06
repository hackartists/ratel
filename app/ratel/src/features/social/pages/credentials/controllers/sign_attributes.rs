use super::super::models::{AttributeCode, VerifiedAttributes};
use super::super::*;
use super::get_credentials::CredentialResponse;
use crate::features::social::types::SocialError;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "snake_case", tag = "type")]
pub enum SignAttributesRequest {
    PortOne { id: String },
    Code { code: String },
}

#[post("/api/me/did", user: crate::features::auth::User)]
pub async fn sign_attributes_handler(body: SignAttributesRequest) -> Result<CredentialResponse> {
    debug!("Handling sign attributes request: {:?}", body);
    let attrs = match body {
        SignAttributesRequest::PortOne { id } => portone_sign_attributes(&user, id).await?,
        SignAttributesRequest::Code { code } => add_attributes_by_code(&user, code).await?,
    };

    return Ok(CredentialResponse {
        age: attrs.age(),
        gender: attrs.gender.map(|value| value.to_string()),
        university: attrs.university,
    });
}

#[cfg(feature = "server")]
async fn add_attributes_by_code(
    user: &crate::features::auth::User,
    code: String,
) -> Result<VerifiedAttributes> {
    let code = code.trim().to_string();
    if code.is_empty() {
        return Err(SocialError::InvalidVerificationAttribute.into());
    }

    let code_item = AttributeCode::get_by_code(&code)
        .await?
        .ok_or_else(|| Error::NotFound("Attribute code not found".to_string()))?;

    let user_pk = user.pk();
    let mut attrs = VerifiedAttributes::get_by_user(&user_pk)
        .await?
        .unwrap_or_else(|| VerifiedAttributes::new(user_pk));

    if let Some(birth_date) = code_item.birth_date {
        attrs.birth_date = Some(birth_date);
    }
    attrs.gender = code_item.gender.or(attrs.gender);
    if let Some(university) = code_item.university {
        attrs.university = Some(university);
    }

    attrs.save().await?;
    Ok(attrs)
}

#[cfg(all(feature = "server", not(feature = "bypass")))]
async fn portone_sign_attributes(
    user: &crate::features::auth::User,
    id: String,
) -> Result<VerifiedAttributes> {
    use super::super::services::PortOneClient;

    let portone = PortOneClient::new();
    let response = portone.identify(&id).await?;
    let verified = response.verified_customer;

    let gender = match verified.gender.to_lowercase().as_str() {
        "male" => Some(crate::common::attribute::Gender::Male),
        "female" => Some(crate::common::attribute::Gender::Female),
        _ => return Err(SocialError::InvalidGender.into()),
    };

    let birth_date = verified.birth_date.replace('-', "");

    let user_pk = user.pk();
    let mut attrs = VerifiedAttributes::get_by_user(&user_pk)
        .await?
        .unwrap_or_else(|| VerifiedAttributes::new(user_pk));
    attrs.birth_date = Some(birth_date);
    // Postgres migration: `VerifiedAttributes.gender` stores the bare
    // snake_case string ("male" / "female") — serialize the typed enum the
    // same way serde would before falling back to the existing value.
    attrs.gender = gender.map(|g| g.to_string()).or(attrs.gender);

    attrs.save().await?;
    Ok(attrs)
}

#[cfg(all(feature = "server", feature = "bypass"))]
async fn portone_sign_attributes(
    user: &crate::features::auth::User,
    id: String,
) -> Result<VerifiedAttributes> {
    use super::super::services::PortOneClient;

    let _ = id;
    let gender = Some(crate::common::attribute::Gender::Male);

    let birth_date = "20000101".to_string();

    let user_pk = user.pk();
    let mut attrs = VerifiedAttributes::get_by_user(&user_pk)
        .await?
        .unwrap_or_else(|| VerifiedAttributes::new(user_pk));
    attrs.birth_date = Some(birth_date);
    // Postgres migration: `VerifiedAttributes.gender` stores the bare
    // snake_case string ("male" / "female") — serialize the typed enum the
    // same way serde would before falling back to the existing value.
    attrs.gender = gender.map(|g| g.to_string()).or(attrs.gender);

    attrs.save().await?;
    Ok(attrs)
}
