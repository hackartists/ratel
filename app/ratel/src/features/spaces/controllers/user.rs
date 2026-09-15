use crate::*;

#[get("/api/user", user: OptionalUser) ]
pub async fn get_user() -> std::result::Result<Option<User>, ServerFnError> {
    Ok(user.into())
}
