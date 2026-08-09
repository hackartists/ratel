use crate::common::{types::*, *};
#[cfg(feature = "server")]
use crate::common::models::reward::UserReward;
#[cfg(feature = "server")]
use super::SpaceReward;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct SpaceRewardResponse {
    pub pk: Partition,
    pub sk: RewardKey,

    pub created_at: i64,
    pub updated_at: i64,
    pub description: String,
    pub points: i64,
    pub credits: i64,
    pub behavior: RewardUserBehavior,

    pub total_points: i64,
    pub total_claims: i64,

    pub period: RewardPeriod,
    pub condition: RewardCondition,

    pub user_claims: i64,
    pub user_points: i64,
}

#[cfg(feature = "server")]
impl From<(SpaceReward, UserReward)> for SpaceRewardResponse {
    fn from((reward, user_reward): (SpaceReward, UserReward)) -> Self {
        let sk = reward.reward_key();
        let behavior = reward.behavior_enum();
        Self {
            pk: Partition::Space(reward.space_id.clone()),
            sk,
            created_at: reward.created_at,
            updated_at: reward.updated_at,
            description: reward.description,
            behavior,
            points: reward.point,
            credits: reward.credits,
            total_points: reward.total_points,
            total_claims: reward.total_claims,
            period: reward.period.0,
            condition: reward.condition.0,
            user_claims: user_reward.total_claims,
            user_points: user_reward.total_points,
        }
    }
}

#[cfg(feature = "server")]
impl From<SpaceReward> for SpaceRewardResponse {
    fn from(reward: SpaceReward) -> Self {
        let sk = reward.reward_key();
        let behavior = reward.behavior_enum();
        Self {
            pk: Partition::Space(reward.space_id.clone()),
            sk,
            created_at: reward.created_at,
            updated_at: reward.updated_at,
            description: reward.description,
            behavior,
            points: reward.point,
            credits: reward.credits,
            total_points: reward.total_points,
            total_claims: reward.total_claims,
            period: reward.period.0,
            condition: reward.condition.0,
            user_claims: 0,
            user_points: 0,
        }
    }
}
