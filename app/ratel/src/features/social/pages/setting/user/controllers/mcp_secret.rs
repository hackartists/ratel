use super::super::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct McpSecretResponse {
    /// The raw token (only present immediately after generate/regenerate).
    pub secret: Option<String>,
    /// Whether a secret has been generated for this user.
    pub has_secret: bool,
}

/// Check whether the logged-in user has an MCP client secret.
/// The raw token is NOT returned here (it's only available at generation time).
#[get("/api/me/mcp-secret", user: crate::features::auth::User)]
pub async fn get_mcp_secret_handler() -> Result<McpSecretResponse> {
    let existing = crate::common::models::McpClientSecret::find_by_user(&user.pk()).await?;

    Ok(McpSecretResponse {
        secret: None,
        has_secret: existing.is_some(),
    })
}

/// Generate or regenerate the MCP client secret for the logged-in user.
/// If one already exists, it is replaced.
#[post("/api/me/mcp-secret/regenerate", user: crate::features::auth::User)]
pub async fn regenerate_mcp_secret_handler() -> Result<McpSecretResponse> {
    // Delete existing secret if present
    crate::common::models::McpClientSecret::delete_for_user(&user.pk()).await?;

    // Create a new secret (returns entity with hash + raw token for user)
    let (new_secret, raw_token) = crate::common::models::McpClientSecret::new(user.pk());
    crate::common::models::McpClientSecret::repository()
        .insert(&new_secret)
        .await?;

    // Invalidate any cached MCP service for the old secret
    #[cfg(feature = "server")]
    crate::common::mcp::invalidate_user_services(&user.pk()).await;

    Ok(McpSecretResponse {
        secret: Some(raw_token),
        has_secret: true,
    })
}
