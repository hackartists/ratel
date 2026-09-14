//! PATCH the LDA topic names on an existing discussion-analysis row.
//!
//! Lets the user rename auto-generated `토픽_N` labels to something
//! meaningful (e.g. "정부 권한 강화"). Body is the full
//! `Vec<TopicRow>` for the row — same shape as the analysis result
//! returns — so the client just submits whatever the table currently
//! shows. Keywords are preserved verbatim from the original row;
//! only `topic` (the label) ends up changed.
//!
//! Auth: same `SpaceUserRole` gate as the rest of the analyze app.
//! Mutation is a single `UpdateItem` — no transactional concerns.

use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateDiscussionTopicsRequest {
    pub topics: Vec<TopicRow>,
}

#[mcp_tool(
    name = "update_discussion_topics",
    description = "Rename the LDA topic labels on an existing discussion-analysis row. Submit the full Vec<TopicRow> for the row; only `topic` (label) ends up changed. Requires creator role."
)]
#[post(
    "/api/spaces/{space_id}/apps/analyzes/reports/{report_id}/discussions/{discussion_id}/results/{request_id}/topics",
    role: SpaceUserRole
)]
pub async fn update_discussion_topics(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Analyze report id")] report_id: SpaceAnalyzeReportEntityType,
    #[mcp(description = "Discussion (post) partition key")] discussion_id: FeedPartition,
    #[mcp(description = "Discussion analysis request id (UUIDv7) returned by analyze_discussion")]
    request_id: String,
    #[mcp(
        description = "Topics payload as JSON, e.g. {\"topics\": [{\"topic\": \"...\", \"keywords\": [...], \"weight\": ...}, ...]}"
    )]
    req: UpdateDiscussionTopicsRequest,
) -> Result<()> {
    SpaceApp::can_edit(role)?;
    let space_pk: Partition = space_id.into();

    // `id` IS the request UUIDv7. Point-read by pk, then verify the full
    // (space, report, discussion) tuple to preserve the original
    // UpdateItem's implicit sk-keyed scoping.
    let request_uuid =
        uuid::Uuid::parse_str(&request_id).map_err(|_| Error::InvalidFormat)?;

    let existing = SpaceAnalyzeDiscussionResult::repository()
        .get(request_uuid)
        .await
        .map_err(|e| {
            crate::error!("update_discussion_topics: {e}");
            Error::Internal
        })?;
    let scoped = existing.as_ref().is_some_and(|r| {
        r.space_pk == space_pk.to_string()
            && r.report_id == report_id.to_string()
            && r.discussion_id == discussion_id.to_string()
    });
    if !scoped {
        crate::error!("update_discussion_topics: row not found");
        return Err(Error::Internal);
    }

    SpaceAnalyzeDiscussionResult::repository()
        .update(
            request_uuid,
            SpaceAnalyzeDiscussionResult::update()
                .topics(TopicRows(req.topics))
                .updated_at(crate::common::utils::time::get_now_timestamp_millis()),
        )
        .await
        .map_err(|e| {
            crate::error!("update_discussion_topics: {e}");
            Error::Internal
        })?;

    Ok(())
}
