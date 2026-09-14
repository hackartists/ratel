use crate::features::activity::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct RankingEntryResponse {
    pub rank: u32,
    pub user_pk: String,
    pub name: String,
    pub avatar: String,
    pub total_score: i64,
}

#[get("/api/spaces/:space_id/ranking?bookmark", _space: crate::common::models::space::SpaceCommon)]
pub async fn get_ranking_handler(
    space_id: SpacePartition,
    bookmark: Option<String>,
) -> Result<ListResponse<RankingEntryResponse>> {
    use crate::features::activity::models::SpaceScore;

    // `bookmark` carries an opaque 1-based page number as a string.
    const PAGE_SIZE: i64 = 50;
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = SpaceScore::find_by_space_rank(&space_id, page, PAGE_SIZE).await?;

    let has_more = page < result.total_pages;
    let next_bookmark = if has_more {
        Some((page + 1).to_string())
    } else {
        None
    };

    // Rank resets to 1 at the top of every page (per-page rank, 1-based),
    // matching the original DynamoDB handler which mapped `(i as u32) + 1`
    // over each page's rows independently.
    let items: Vec<RankingEntryResponse> = result
        .items
        .iter()
        .enumerate()
        .map(|(i, score)| RankingEntryResponse {
            rank: (i as u32) + 1,
            user_pk: score.author_pk.clone(),
            name: score.user_name.clone(),
            avatar: score.user_avatar.clone(),
            total_score: score.total_score,
        })
        .collect();

    Ok((items, next_bookmark).into())
}
