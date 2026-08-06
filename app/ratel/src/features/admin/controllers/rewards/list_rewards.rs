use crate::common::models::auth::AdminUser;
use crate::features::admin::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RewardResponse {
    pub reward_behavior: RewardUserBehavior,
    pub point: i64,
    pub period: RewardPeriod,
    pub condition: RewardCondition,
}

impl From<Reward> for RewardResponse {
    fn from(value: Reward) -> Self {
        Self {
            reward_behavior: value.behavior.parse().unwrap_or_default(),
            point: value.point,
            period: value.period.parse().unwrap_or_default(),
            condition: value.condition.0,
        }
    }
}

#[get("/api/admin/rewards", _user: AdminUser)]
pub async fn list_rewards() -> Result<ListResponse<RewardResponse>> {
    let items = Reward::list_all().await?;

    let items = items.into_iter().map(RewardResponse::from).collect();

    Ok(ListResponse {
        items,
        bookmark: None,
    })
}
