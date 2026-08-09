use crate::features::spaces::pages::apps::apps::rewards::*;
#[cfg(feature = "server")]
use crate::common::models::auth::OptionalUser;
use crate::features::spaces::space_common::models::SpaceRewardResponse;

#[get("/api/spaces/{space_id}/rewards?action_id", user: OptionalUser)]
pub async fn list_space_rewards(
    space_id: SpacePartition,
    action_id: Option<String>,
) -> Result<ListResponse<SpaceRewardResponse>> {
    use crate::common::models::reward::UserReward;
    use crate::features::spaces::space_common::models::SpaceReward;

    let space_rewards = SpaceReward::list_by_action(space_id.clone(), action_id).await?;

    let target_pk = user.0.map(|u| u.pk());

    let mut items = Vec::with_capacity(space_rewards.len());
    for reward in space_rewards {
        let user_reward = if let Some(ref target_pk) = target_pk {
            UserReward::get_for(target_pk, &reward.reward_key())
                .await
                .ok()
                .flatten()
        } else {
            None
        };

        items.push(match user_reward {
            Some(user_reward) => SpaceRewardResponse::from((reward, user_reward)),
            None => SpaceRewardResponse::from(reward),
        });
    }

    Ok(ListResponse {
        items,
        bookmark: None,
    })
}
