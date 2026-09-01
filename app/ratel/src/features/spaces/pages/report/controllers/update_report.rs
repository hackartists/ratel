use crate::features::spaces::pages::report::types::ReportBlock;
use crate::features::spaces::pages::report::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateReportRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<ReportStatus>,
    #[serde(default)]
    pub blocks: Option<Vec<ReportBlock>>,
    #[serde(default)]
    pub html_contents: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UpdateReportResponse {
    pub id: String,
    pub updated_at: i64,
}

#[patch("/v3/spaces/{space_pk}/reports/{report_id}", role: SpaceUserRole)]
pub async fn update_report(
    space_pk: SpacePartition,
    report_id: SpaceReportEntityType,
    req: UpdateReportRequest,
) -> Result<UpdateReportResponse> {
    use crate::features::spaces::pages::report::models::{ReportBlockList, SpaceReport};
    use crate::features::spaces::pages::report::types::SpaceReportError;

    SpaceReport::can_edit(role)?;
    let space_id = space_pk.0.clone();

    let report_uuid =
        uuid::Uuid::parse_str(&report_id.0).map_err(|_| SpaceReportError::ReportNotFound)?;

    let mut report = SpaceReport::get_by_id(report_uuid)
        .await
        .map_err(|e| {
            crate::error!("failed to load report for update: {e:?}");
            SpaceReportError::ReportUpdateFailed
        })?
        .ok_or(SpaceReportError::ReportNotFound)?;

    if report.space_id != space_id {
        return Err(SpaceReportError::ReportNotFound.into());
    }

    let now = crate::common::utils::time::get_now_timestamp_millis();
    report.updated_at = now;
    if let Some(title) = req.title {
        report.title = title;
    }
    if let Some(description) = req.description {
        report.description = description;
    }
    if let Some(status) = req.status {
        report.status = status;
    }
    if let Some(blocks) = req.blocks {
        report.blocks = ReportBlockList(blocks);
    }
    if let Some(html) = req.html_contents {
        report.html_contents = Some(html);
    }

    SpaceReport::repository().upsert(&report).await.map_err(|e| {
        crate::error!("failed to update report: {e:?}");
        SpaceReportError::ReportUpdateFailed
    })?;

    Ok(UpdateReportResponse {
        id: report.report_id(),
        updated_at: now,
    })
}
