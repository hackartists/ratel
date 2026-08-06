use crate::features::spaces::pages::report::*;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Opaque jsonb wrapper for the report's Notion-style block list. A single
/// tuple newtype serializes transparently, so the column holds the bare JSON
/// array (no wrapper key).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct ReportBlockList(pub Vec<ReportBlock>);

/// One saved report on a space.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpaceReport(uuid)`. It becomes a surrogate `id` PK holding that same
/// report uuid (so the public `SpaceReportEntityType` string == `id`), plus a
/// plain `space_id` column (cross-feature reference to the spaces feature — no
/// FK yet). The `find_by_status` GSI (gsi1: `pk=Space`, sk ordered by
/// `(status, created_at)`) becomes an ordered query on the `space_id` index
/// filtered by the `status` native enum column.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "space_reports")]
pub struct SpaceReport {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,
    #[serde(default)]
    pub status: ReportStatus,

    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub html_contents: Option<String>,

    /// Notion-style block list rendered by the detail editor. Stored inline as
    /// a jsonb column (see `ReportBlockList`).
    #[serde(default)]
    pub blocks: ReportBlockList,
}

#[cfg(feature = "server")]
impl SpaceReport {
    pub fn new(space_pk: SpacePartition, title: String, description: String) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;
        let now = get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            created_at: now,
            updated_at: now,
            status: ReportStatus::Draft,
            title,
            description,
            html_contents: None,
            blocks: ReportBlockList::default(),
        }
    }

    /// The report's public id string (== the surrogate `id` uuid).
    pub fn report_id(&self) -> String {
        self.id.to_string()
    }

    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }

    pub fn can_delete(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }
}
