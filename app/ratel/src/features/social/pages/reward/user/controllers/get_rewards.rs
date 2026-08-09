use super::super::{dto::RewardsResponse, *};

#[cfg(feature = "server")]
#[allow(dead_code)]
async fn sum_local_points(user_pk: &Partition) -> i64 {
    use crate::common::models::reward::UserReward;

    // The authoritative local record of everything the user has ever
    // earned — sum every `UserReward` aggregate row for this target.
    match UserReward::find_by_target(user_pk).await {
        Ok(items) => items
            .iter()
            .fold(0i64, |total, item| total.saturating_add(item.total_points)),
        Err(e) => {
            crate::error!("failed to query local UserReward for {user_pk}: {e}");
            0
        }
    }
}

#[cfg(feature = "server")]
async fn fetch_rewards(user_pk: Partition, month: Option<String>) -> Result<RewardsResponse> {
    let month = month.unwrap_or_else(|| utils::time::current_month());

    // Scope-A: the balance is the local `User.points` (credited by reward
    // awards, debited by launchpad conversions). No console (Biyard) reads.
    let user = crate::features::auth::User::find_by_pk(&user_pk)
        .await?
        .unwrap_or_default();
    let points = user.points;

    Ok(RewardsResponse {
        month,
        project_name: String::new(),
        token_symbol: "RATEL".to_string(),
        total_points: points.max(1),
        points,
        monthly_token_supply: 0,
        chain_id: None,
        contract_address: None,
    })
}

#[get("/api/users/points?username&month")]
pub async fn get_user_rewards_handler(
    username: String,
    month: Option<String>,
) -> Result<RewardsResponse> {
    let user = crate::features::auth::User::find_by_username(&username)
        .await?
        .ok_or(Error::NotFound(format!("User not found: {}", username)))?;

    fetch_rewards(user.pk(), month).await
}
