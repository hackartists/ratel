use crate::common::*;
use crate::features::sub_team::models::json::FileList;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// Maximum stored body length (64 KB) — enforced on create / update.
pub const SUB_TEAM_DOCUMENT_MAX_BODY_BYTES: usize = 64 * 1024;

/// A sub-team governance document (e.g., bylaws, privacy notice).
///
/// **Postgres migration:** the DynamoDB `(pk = Team(team), sk =
/// SubTeamDocument(doc_id))` identity becomes a surrogate `id` PK (equal to the
/// former doc_id uuid) plus `team_pk` (raw `"TEAM#…"` partition string,
/// indexed).
///
/// `body_hash` is a sha256 of the current body — applicants snapshot it into
/// `SubTeamDocAgreement.body_hash_snapshot` at submit time.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "sub_team_documents"))]
pub struct SubTeamDocument {
    /// Surrogate primary key (former doc_id).
    pub id: Uuid,

    /// Owning team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub title: String,
    /// Plain markdown; rendered read-only in Phase 1.
    pub body: String,

    pub required: bool,

    /// Display order; lower values render earlier.
    pub order: i32,

    /// sha256 of `body` at last update — re-agreement anchor.
    pub body_hash: String,

    /// Monotonically-increasing revision; starts at 1 on create.
    pub version: i32,

    /// Username of the last editor — denormalized for the composer.
    pub editor_username: String,

    /// File attachments. Stored as jsonb.
    pub attachments: FileList,

    /// Category tag (`"Bylaws"` / `"ClubBylaws"`); `None` = regular doc.
    pub category: Option<String>,

    /// `Post.pk` of the backing post written alongside a bylaw doc.
    pub backing_post_id: Option<String>,
}

#[cfg(feature = "server")]
impl SubTeamDocument {
    pub fn new(
        team_pk: Partition,
        title: String,
        body: String,
        required: bool,
        order: i32,
        editor_username: String,
        attachments: Vec<File>,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        let body_hash = hash_body(&body);
        Self {
            id: Uuid::now_v7(),
            team_pk: team_pk.to_string(),
            created_at: now,
            updated_at: now,
            title,
            body,
            required,
            order,
            body_hash,
            version: 1,
            editor_username,
            attachments: FileList(attachments),
            category: None,
            backing_post_id: None,
        }
    }

    /// The former doc_id — the surrogate `id` in string form.
    pub fn doc_id(&self) -> String {
        self.id.to_string()
    }

    pub fn update_body(&mut self, body: String) {
        self.body_hash = hash_body(&body);
        self.body = body;
        self.updated_at = crate::common::utils::time::get_now_timestamp_millis();
    }

    /// Every document under a team (excludes version snapshots, which live in
    /// a separate table).
    pub async fn list_for_team(team_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Load a doc by id, scoped to the owning team.
    pub async fn find_in_team(
        team_pk: &Partition,
        doc_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        let Ok(uuid) = doc_id.parse::<Uuid>() else {
            return Ok(None);
        };
        let row = Self::repository()
            .get(uuid)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.filter(|d| d.team_pk == team_pk.to_string()))
    }
}

#[cfg(feature = "server")]
fn hash_body(body: &str) -> String {
    use sha2::Digest;
    let mut hasher = sha2::Sha256::new();
    hasher.update(body.as_bytes());
    format!("{:x}", hasher.finalize())
}
