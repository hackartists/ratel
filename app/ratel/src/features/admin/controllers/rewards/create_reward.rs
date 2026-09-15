use crate::features::admin::*;
use crate::common::models::auth::AdminUser;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CreateGlobalRewardRequest {
    pub behavior: RewardUserBehavior,
    pub point: i64,
    pub period: RewardPeriod,
    pub condition: RewardCondition,
}

#[post("/api/admin/rewards", _user: AdminUser)]
pub async fn create_reward(req: CreateGlobalRewardRequest) -> Result<RewardResponse> {
    if Reward::get_by_behavior(&req.behavior).await?.is_some() {
        return Err(SpaceRewardError::RewardAlreadyExists.into());
    }

    let reward = Reward::new(req.behavior, req.point, req.period, req.condition);
    reward.create().await?;

    Ok(RewardResponse::from(reward))
}
