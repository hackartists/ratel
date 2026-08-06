use crate::common::ListResponse;
use crate::features::spaces::pages::report::*;

#[get("/v3/spaces/{space_pk}/reports?bookmark&status", role: SpaceUserRole)]
pub async fn list_reports(
    space_pk: SpacePartition,
    bookmark: Option<String>,
    status: Option<ReportStatus>,
) -> Result<ListResponse<ReportListItem>> {
    use crate::features::spaces::pages::report::models::{SpaceReport, SpaceReportColumn};
    use crate::features::spaces::pages::report::types::SpaceReportError;
    use postgres::PostgresEntity;
    use postgres::ops::{EnumOp, StringOp};

    SpaceReport::can_view(role)?;

    // Members can only ever see Published reports — any other request
    // (unfiltered or `status=Draft`) is silently coerced to the
    // Published filter so drafts can't leak through the API. Admins
    // keep the full filter spectrum (None / Draft / Published) for
    // their list page chips.
    let effective_status = if SpaceReport::can_edit(role).is_ok() {
        status
    } else {
        Some(ReportStatus::Published)
    };

    // `bookmark` carries the 1-based page number (opaque string to the client).
    let page = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let page_size = 20i64;

    let mut query = SpaceReport::query()
        .space_id(StringOp::Eq(space_pk.0.clone()))
        .order_by(SpaceReportColumn::CreatedAt, postgres::Order::Desc)
        .page(page)
        .page_size(page_size);
    if let Some(s) = effective_status {
        query = query.status(EnumOp::Eq(s));
    }

    let result = SpaceReport::repository().find(query).await.map_err(|e| {
        crate::error!("failed to list reports: {e:?}");
        SpaceReportError::ReportListFailed
    })?;

    let has_next = result.page < result.total_pages;
    let items: Vec<ReportListItem> = result
        .items
        .into_iter()
        .map(|r| ReportListItem {
            id: r.report_id(),
            status: r.status,
            title: r.title,
            description: r.description,
            created_at: r.created_at,
        })
        .collect();

    let next = if has_next {
        Some((page + 1).to_string())
    } else {
        None
    };

    Ok((items, next).into())
}
