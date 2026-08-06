use crate::features::spaces::pages::report::types::ReportBlock;
use crate::features::spaces::pages::report::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct GetReportResponse {
    pub id: String,
    pub status: ReportStatus,
    pub title: String,
    pub description: String,
    pub html_contents: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
    pub blocks: Vec<ReportBlock>,
    pub author: String,
}

#[get("/v3/spaces/{space_pk}/reports/{report_id}", role: SpaceUserRole)]
pub async fn get_report(
    space_pk: SpacePartition,
    report_id: SpaceReportEntityType,
) -> Result<GetReportResponse> {
    use crate::common::models::space::SpaceCommon;
    use crate::features::spaces::pages::report::models::SpaceReport;
    use crate::features::spaces::pages::report::types::SpaceReportError;

    SpaceReport::can_view(role)?;
    let space_id = space_pk.0.clone();
    let space_partition: Partition = space_pk.into();

    let report_uuid =
        uuid::Uuid::parse_str(&report_id.0).map_err(|_| SpaceReportError::ReportNotFound)?;

    let report = SpaceReport::get_by_id(report_uuid).await.map_err(|e| {
        crate::error!("failed to load report: {e:?}");
        SpaceReportError::ReportLoadFailed
    })?;
    let report = report.ok_or(SpaceReportError::ReportNotFound)?;

    // Scope guard: the surrogate id is global, so reject a report that belongs
    // to a different space (mirrors the DynamoDB pk-scoped GetItem).
    if report.space_id != space_id {
        return Err(SpaceReportError::ReportNotFound.into());
    }

    // Drafts are admin-only — members can only fetch a report once
    // it's been published. Treat "not yet published" as "not found"
    // so we don't even leak the existence of the draft.
    if !matches!(report.status, ReportStatus::Published) && SpaceReport::can_edit(role).is_err() {
        return Err(SpaceReportError::ReportNotFound.into());
    }

    let id = report.report_id();

    let author = SpaceCommon::get_by_partition(&space_partition)
        .await
        .ok()
        .flatten()
        .map(|s| s.author_display_name)
        .unwrap_or_default();

    Ok(GetReportResponse {
        id,
        status: report.status,
        title: report.title,
        description: report.description,
        html_contents: report.html_contents,
        created_at: report.created_at,
        updated_at: report.updated_at,
        blocks: report.blocks.0,
        author,
    })
}
