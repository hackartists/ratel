use super::super::*;
use super::dto::{UserDetailResponse, UserProfileResponse};

#[get("/api/me", user: crate::features::auth::User)]
pub async fn get_user_detail_handler() -> Result<UserDetailResponse> {
    let evm_address = {
        use postgres::ops::StringOp;
        use postgres::PostgresEntity;
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
