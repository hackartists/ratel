use super::super::*;
use crate::features::social::types::SocialError;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub enum UpdateUserRequest {
    Profile {
        nickname: String,
        profile_url: String,
        description: String,
    },
    Theme {
        theme: String,
    },
    EvmAddress {
        evm_address: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UserProfileResponse {
    pub username: String,
    pub display_name: String,
    pub profile_url: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UserDetailResponse {
    pub user: UserProfileResponse,
    pub evm_address: Option<String>,
}

#[get("/api/me", user: crate::features::auth::User)]
pub async fn get_user_detail_handler() -> Result<UserDetailResponse> {
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
            username: user.username,
            display_name: user.display_name,
            profile_url: user.profile_url,
            description: user.description,
        },
        evm_address,
    })
}

#[post("/api/me", user: crate::features::auth::User)]
pub async fn update_user_handler(body: UpdateUserRequest) -> Result<UserDetailResponse> {
    let user = match body {
        UpdateUserRequest::Profile {
            nickname,
            profile_url,
            description,
        } => {
            let updater = crate::features::auth::User::update()
                .display_name(nickname)
                .profile_url(profile_url)
                .description(description);
            crate::features::auth::User::repository()
                .update(user.id, updater)
                .await?
        }
        UpdateUserRequest::EvmAddress { evm_address } => {
            let entity = crate::features::auth::UserEvmAddress::new(user.pk(), evm_address);
            entity.save().await?;
            user
        }
        UpdateUserRequest::Theme { .. } => {
            return Err(Error::UnsupportedOperation);
        }
    };

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
            username: user.username,
            display_name: user.display_name,
            profile_url: user.profile_url,
            description: user.description,
        },
        evm_address,
    })
}
