use crate::common::*;
use crate::features::sub_team::models::json::FileList;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// Immutable snapshot of a `SubTeamDocument` at a specific version.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(team), sk =
/// SubTeamDocumentVersion(doc_id, padded_version))` identity becomes a
/// surrogate `id` PK plus `unique(doc_id, version)` (doc_id is a global uuid so
/// this pair is unique). `team_pk` (raw `"TEAM#…"`) and `doc_id` are indexed so
/// "every version of this doc" is a single-index query. Snapshots are never
/// mutated and only deleted when the parent doc is deleted.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "sub_team_document_versions", unique(doc_id, version))
)]
pub struct SubTeamDocumentVersion {
    /// Surrogate primary key.
    pub id: Uuid,

    /// Owning team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    /// Parent doc id. Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub doc_id: String,

    /// Wall-clock timestamp when this snapshot was taken (millis).
    pub created_at: i64,

    /// Monotonic version number, matches the parent doc's `version`.
    pub version: i32,

    // ── Snapshot of the doc fields at this version ────────────────
    pub title: String,
    pub body: String,
    pub body_hash: String,
    pub required: bool,
    pub order: i32,
    /// Stored as jsonb.
    pub attachments: FileList,
    /// Username of the editor who produced this version.
    pub editor_username: String,
}

#[cfg(feature = "server")]
impl SubTeamDocumentVersion {
    /// Build a new snapshot for a freshly-created or freshly-updated doc.
    pub fn snapshot_of(team_pk: Partition, doc: &super::SubTeamDocument) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            team_pk: team_pk.to_string(),
            doc_id: doc.id.to_string(),
            created_at: now,
            version: doc.version,
            title: doc.title.clone(),
            body: doc.body.clone(),
            body_hash: doc.body_hash.clone(),
            required: doc.required,
            order: doc.order,
            attachments: doc.attachments.clone(),
            editor_username: doc.editor_username.clone(),
        }
    }

    /// Every version snapshot for one doc under a team.
    pub async fn list_for_doc(
        team_pk: &Partition,
        doc_id: &str,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .team_pk(StringOp::Eq(team_pk.to_string()))
                    .doc_id(StringOp::Eq(doc_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Cascade-remove every snapshot row for a doc. Best-effort per-row.
    pub async fn delete_for_doc(team_pk: &Partition, doc_id: &str) -> crate::common::Result<()> {
        let versions = Self::list_for_doc(team_pk, doc_id).await?;
        for v in versions {
            if let Err(e) = Self::repository().delete(v.id).await {
                crate::error!("delete_for_doc snapshot cleanup failed: {e}");
            }
        }
        Ok(())
    }
}
