use crate::common::ListResponse;
use crate::features::spaces::pages::actions::actions::discussion::SpacePost;
use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct AnalyzeDiscussionItem {
    pub discussion_id: SpacePostEntityType,
    pub title: String,
    /// Total comments on the discussion (unfiltered). Kept for the
    /// list page that doesn't apply cross filters.
    /// Defaults to 0 when omitted by older clients.
    #[serde(default)]
    pub comment_count: i64,

    /// Comments authored by users in the report's cross-filter
    /// matched set. Equals `comment_count` when the report has no
    /// filters. Populated by `get_analyze_report`; the bare
    /// `list_analyze_discussions` endpoint leaves this at 0.
    #[serde(default)]
    pub matched_comment_count: i64,

    /// Distinct authors (from the matched set) who commented on the
    /// discussion. Same fallback semantics as
    /// `matched_comment_count` — 0 from the bare list endpoint,
    /// populated by `get_analyze_report`.
    #[serde(default)]
    pub matched_participant_count: i64,
}

#[mcp_tool(
    name = "list_analyze_discussions",
    description = "List discussions in a space available as analyze report sources. Cross-filter aware comment counts are 0 here; use get_analyze_report for the populated counts. Requires creator role."
)]
#[get("/api/spaces/{space_id}/apps/analyzes/discussions?bookmark", role: SpaceUserRole)]
pub async fn list_analyze_discussions(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Pagination bookmark. Omit for first page.")] bookmark: Option<String>,
) -> Result<ListResponse<AnalyzeDiscussionItem>> {
    SpaceApp::can_edit(role)?;
    let (posts, bookmark) = SpacePost::list_by_space(&space_id, None, bookmark, 20).await?;

    let items = posts
        .into_iter()
        .map(|post| AnalyzeDiscussionItem {
            discussion_id: post.post_id.into(),
            title: post.title.trim().to_string(),
            comment_count: post.comments,
            matched_comment_count: 0,
            matched_participant_count: 0,
        })
        .collect();

    Ok(ListResponse { items, bookmark })
}
