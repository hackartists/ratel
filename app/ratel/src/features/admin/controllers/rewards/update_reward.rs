use crate::features::admin::*;
use crate::common::models::auth::AdminUser;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateGlobalRewardRequest {
    pub behavior: RewardUserBehavior,
    pub point: i64,
    pub period: RewardPeriod,
    pub condition: RewardCondition,
}

#[put("/api/admin/rewards", _user: AdminUser)]
pub async fn update_reward(req: UpdateGlobalRewardRequest) -> Result<Reward> {
    use crate::common::models::reward::RewardConditionValue;

    let Some(mut reward) = Reward::get_by_behavior(&req.behavior).await? else {
        return Err(SpaceRewardError::RewardNotFound.into());
    };

    reward.point = req.point;
    reward.period = req.period.to_string();
    reward.condition = RewardConditionValue(req.condition);
    reward.updated_at = crate::common::utils::time::get_now_timestamp_millis();

    let reward = reward.save().await?;

    Ok(reward)
}
