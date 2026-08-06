use crate::features::activity::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct MyScoreResponse {
    pub total_score: i64,
    pub poll_score: i64,
    pub quiz_score: i64,
    pub follow_score: i64,
    pub discussion_score: i64,
    pub rank: u32,
}

#[get("/api/spaces/:space_id/my-score", _space: crate::common::models::space::SpaceCommon, user: crate::common::models::OptionalUser)]
pub async fn get_my_score_handler(space_id: SpacePartition) -> Result<MyScoreResponse> {
    use crate::common::models::User;
    use crate::features::activity::models::SpaceScore;

    let user: Option<User> = user.into();
    let Some(user) = user else {
        return Ok(MyScoreResponse::default());
    };

    let author = AuthorPartition::from(user.pk.clone());

    let score_opt = SpaceScore::get_for(&space_id, &author)
        .await
        .map_err(|e| {
            crate::error!("score: {e:?}");
            ActivityError::ScoreLoadFailed
        })?;

    // Rank = number of participants with a strictly higher total_score, + 1.
    // No score row yet (never participated) → rank 0, mirroring the old
    // "user not found in the ranking list" behaviour.
    let rank = match &score_opt {
        Some(score) => {
            let higher = SpaceScore::count_higher(&space_id, score.total_score)
                .await
                .map_err(|e| {
                    crate::error!("ranking: {e:?}");
                    ActivityError::RankingLoadFailed
                })?;
            (higher as u32) + 1
        }
        None => 0,
    };
    let score = score_opt.unwrap_or_default();

    Ok(MyScoreResponse {
        total_score: score.total_score,
        poll_score: score.poll_score,
        quiz_score: score.quiz_score,
        follow_score: score.follow_score,
        discussion_score: score.discussion_score,
        rank,
    })
}
