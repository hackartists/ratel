use crate::features::spaces::pages::apps::apps::analyzes::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// jsonb wrapper for the report's cross-filter chip list. serde treats a
/// single-field tuple newtype transparently, so the column holds the bare
/// JSON array — wire format unchanged.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct ReportFilters(pub Vec<AnalyzeReportFilter>);

impl std::ops::Deref for ReportFilters {
    type Target = Vec<AnalyzeReportFilter>;
    fn deref(&self) -> &Vec<AnalyzeReportFilter> {
        &self.0
    }
}
impl std::ops::DerefMut for ReportFilters {
    fn deref_mut(&mut self) -> &mut Vec<AnalyzeReportFilter> {
        &mut self.0
    }
}

/// jsonb wrapper for the frozen matched-record pointer list.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(postgres::PostgresJson)
)]
pub struct MatchedRecords(pub Vec<MatchedRecordRef>);

impl std::ops::Deref for MatchedRecords {
    type Target = Vec<MatchedRecordRef>;
    fn deref(&self) -> &Vec<MatchedRecordRef> {
        &self.0
    }
}
impl std::ops::DerefMut for MatchedRecords {
    fn deref_mut(&mut self) -> &mut Vec<MatchedRecordRef> {
        &mut self.0
    }
}

/// One saved cross-filter analysis on a space.
///
/// Postgres migration: surrogate `id` PK (the UUIDv7 that used to be the
/// `SpaceAnalyzeReport(uuid)` sk inner — so `id.to_string()` is the same
/// report id clients pass on the wire). `space_pk` is a cross-feature
/// reference to the space (full `Partition` string); no FK. `filters` /
/// `matched_records` are opaque jsonb; `status` is a native PG enum.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(
    feature = "server",
    derive(PostgresEntity)
)]
#[cfg_attr(feature = "server", postgres(table = "space_analyze_reports"))]
pub struct SpaceAnalyzeReport {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub name: String,

    #[serde(default)]
    pub status: AnalyzeReportStatus,

    #[serde(default)]
    pub filters: ReportFilters,

    #[serde(default)]
    pub respondent_count: i64,

    #[serde(default)]
    pub matched_records: MatchedRecords,
}

#[cfg(feature = "server")]
impl SpaceAnalyzeReport {
    pub fn new(
        space_pk: SpacePartition,
        name: String,
        filters: Vec<AnalyzeReportFilter>,
        matched_records: Vec<MatchedRecordRef>,
    ) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;

        let now = get_now_timestamp_millis();
        let pk: Partition = space_pk.into();

        Self {
            id: Uuid::now_v7(),
            space_pk: pk.to_string(),
            created_at: now,
            updated_at: now,
            name,
            status: AnalyzeReportStatus::InProgress,
            filters: ReportFilters(filters),
            respondent_count: 0,
            matched_records: MatchedRecords(matched_records),
        }
    }

    /// Reconstruct the owning space `Partition` from the stored `space_pk`
    /// string (`"SPACE#<id>"`).
    pub fn space_partition(&self) -> Partition {
        use std::str::FromStr;
        Partition::from_str(&self.space_pk).unwrap_or(Partition::Space(self.space_pk.clone()))
    }

    /// The report id clients see on the wire (the surrogate uuid string).
    pub fn report_id(&self) -> String {
        self.id.to_string()
    }

    /// One report scoped to a space, by its string id, if any.
    pub async fn get_for_space(
        space_pk: &Partition,
        report_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        let Ok(id) = Uuid::parse_str(report_id) else {
            return Ok(None);
        };
        let row = Self::repository().get(id).await?;
        Ok(row.filter(|r| r.space_pk == space_pk.to_string()))
    }

    /// Page of reports for a space, newest first. `bookmark` is a decimal
    /// 1-based page number; the returned bookmark is the next page number
    /// or `None` on the last page.
    pub async fn list_page(
        space_pk: &Partition,
        bookmark: Option<String>,
        page_size: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        use postgres::ops::StringOp;

        let page: i64 = bookmark
            .as_deref()
            .and_then(|s| s.parse().ok())
            .unwrap_or(1)
            .max(1);

        let p = Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(SpaceAnalyzeReportColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await?;

        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };

        Ok((p.items, next))
    }

    /// Number of report rows in a space.
    pub async fn count_by_space(space_pk: &Partition) -> crate::common::Result<i64> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .count(&Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await?)
    }

    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        if role != SpaceUserRole::Creator {
            return Err(Error::NoPermission);
        }
        Ok(())
    }
}
