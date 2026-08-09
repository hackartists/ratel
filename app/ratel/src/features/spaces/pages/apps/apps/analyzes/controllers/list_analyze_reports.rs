use crate::common::ListResponse;
use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;

#[mcp_tool(
    name = "list_analyze_reports",
    description = "List saved analyze reports in a space, newest first. Returns id, name, status, created_at, and filters. Requires creator role."
)]
#[get("/api/spaces/{space_id}/apps/analyzes/reports?bookmark", role: SpaceUserRole)]
pub async fn list_analyze_reports(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Pagination bookmark. Omit for first page.")] bookmark: Option<String>,
) -> Result<ListResponse<AnalyzeReport>> {
    SpaceApp::can_edit(role)?;
    let space_pk: Partition = space_id.into();

    let (reports, bookmark) = SpaceAnalyzeReport::list_page(&space_pk, bookmark, 20).await?;

    let items = reports
        .into_iter()
        .map(|report| AnalyzeReport {
            id: report.report_id(),
            name: report.name,
            status: report.status,
            created_at: report.created_at,
            filters: report.filters.0,
        })
        .collect();

    Ok(ListResponse { items, bookmark })
}
