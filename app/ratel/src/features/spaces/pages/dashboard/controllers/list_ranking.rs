use crate::common::SpacePartition;
use crate::common::*;

#[get("/api/spaces/:space_id/incentive/ranking?bookmark", _space: crate::common::models::space::SpaceCommon)]
pub async fn list_ranking_handler(
    space_id: SpacePartition,
    bookmark: Option<String>,
) -> crate::common::Result<crate::features::spaces::space_common::types::dashboard::RankingTableData>
{
    use crate::features::spaces::space_common::types::dashboard::*;

    use crate::features::activity::models::SpaceScore;

    // Bookmark is now a 1-based page number (Postgres offset pagination
    // replaces the DynamoDB opaque last-evaluated-key bookmark).
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let scores = SpaceScore::find_by_space_rank(&space_id, page, 50)
        .await?
        .items;

    let entries: Vec<RankingEntry> = scores
        .iter()
        .enumerate()
        .map(|(i, score)| RankingEntry {
            rank: (i as u32) + 1,
            name: score.user_name.clone(),
            avatar: score.user_avatar.clone(),
            score: score.total_score as f64,
            change: 0,
        })
        .collect();

    Ok(RankingTableData {
        entries,
        page_size: 10,
    })
}
