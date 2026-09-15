use crate::features::social::pages::member::dto::FoundUserResponse;
use crate::features::social::pages::member::{MemberError};
use crate::features::social::*;
use crate::features::auth::User;
#[cfg(feature = "server")]
use crate::features::auth::UserPhoneNumber;

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum FindUserQueryType {
    Email,
    Username,
    PhoneNumber,
}

#[get("/api/users/find?user_type&value", _user: crate::features::auth::OptionalUser)]
pub async fn find_user_handler(
    user_type: FindUserQueryType,
    value: String,
) -> Result<FoundUserResponse> {
    let user = match user_type {
        FindUserQueryType::Email => User::find_by_email(&value).await?,
        FindUserQueryType::Username => User::find_by_username(&value).await?,
        FindUserQueryType::PhoneNumber => {
            let user_phone = UserPhoneNumber::find_by_phone_number(&value).await?;
            match user_phone {
                Some(user_phone) => User::find_by_pk_str(&user_phone.user_pk).await?,
                None => None,
            }
        }
    }
    .ok_or(MemberError::UserNotFound)?;

    Ok(FoundUserResponse {
        pk: user.pk().to_string(),
        nickname: user.display_name,
        username: user.username,
        profile_url: user.profile_url,
        description: user.description,
    })
}
