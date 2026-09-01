use super::super::*;
use super::dto::{UserDetailResponse, UserProfileResponse};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UpdateProfileRequest {
    pub nickname: String,
    pub profile_url: String,
    pub description: String,
}

#[post("/api/me/profile", user: crate::features::auth::User)]
pub async fn update_profile_handler(body: UpdateProfileRequest) -> Result<UserDetailResponse> {
    let updater = crate::features::auth::User::update()
        .display_name(body.nickname)
        .profile_url(body.profile_url)
        .description(body.description);
    let user = crate::features::auth::User::repository()
        .update(user.id, updater)
        .await?;

    let evm_address = {
        use postgres::ops::StringOp;
        crate::features::auth::UserEvmAddress::repository()
            .find_one(
                crate::features::auth::UserEvmAddress::query()
                    .user_pk(StringOp::Eq(user.pk().to_string())),
            )
            .await?
            .map(|item| item.evm_address)
    };

    Ok(UserDetailResponse {
        user: UserProfileResponse {
            username: user.username.clone(),
            display_name: user.display_name.clone(),
            profile_url: user.profile_url.clone(),
            description: user.description.clone(),
        },
        email: user.email.clone(),
        evm_address,
    })
}
