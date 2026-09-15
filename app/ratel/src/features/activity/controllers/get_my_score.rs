use crate::features::activity::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
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

    let author = AuthorPartition::from(user.pk());

    let score = SpaceScore::get_for(&space_id, &author)
        .await
        .map_err(|e| {
            crate::error!("score: {e:?}");
            ActivityError::ScoreLoadFailed
        })?
        .unwrap_or_default();

    // Rank = the participant's position in the full space ranking, ordered by
    // the DynamoDB GSI2 composite sort key (`total_score DESC, updated_at DESC,
    // author_pk DESC`). Ties are broken by those secondary keys, so each
    // participant gets a unique 1-based rank. A participant with no score row
    // (never in the ranking list) → rank 0, mirroring the original
    // `position(...)` / `unwrap_or(0)` behaviour.
    let all_scores = SpaceScore::find_all_by_space_ranked(&space_id)
        .await
        .map_err(|e| {
            crate::error!("ranking: {e:?}");
            ActivityError::RankingLoadFailed
        })?;
    let author_key = author.to_string();
    let rank = all_scores
        .iter()
        .position(|s| s.author_pk == author_key)
        .map(|pos| (pos as u32) + 1)
        .unwrap_or(0);

    Ok(MyScoreResponse {
        total_score: score.total_score,
        poll_score: score.poll_score,
        quiz_score: score.quiz_score,
        follow_score: score.follow_score,
        discussion_score: score.discussion_score,
        rank,
    })
}
