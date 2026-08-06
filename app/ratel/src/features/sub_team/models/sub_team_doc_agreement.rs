use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// Immutable audit record: a user explicitly agreed to a specific version of a
/// specific sub-team document at application-submit time. One row per
/// (application, doc) pair.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(parent), sk =
/// SubTeamDocAgreement(application_id, doc_id))` identity becomes a surrogate
/// `id` PK plus `unique(parent_team_pk, application_id, doc_id)`.
/// `parent_team_pk` holds the raw `"TEAM#…"` partition string; `application_id`
/// is indexed so an application's agreements are a single-index query.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(
        table = "sub_team_doc_agreements",
        unique(parent_team_pk, application_id, doc_id)
    )
)]
pub struct SubTeamDocAgreement {
    /// Surrogate primary key.
    pub id: Uuid,

    /// Owning parent team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub parent_team_pk: String,

    #[cfg_attr(feature = "server", postgres(index))]
    pub application_id: String,
    pub doc_id: String,

    /// Snapshot of the doc's title at agree time.
    pub doc_title_snapshot: String,

    /// sha256 of the doc body the user actually saw.
    pub body_hash_snapshot: String,

    pub agreed_at: i64,

    /// User pk of the applicant who tapped 동의하기.
    pub agreed_by: String,
}

#[cfg(feature = "server")]
impl SubTeamDocAgreement {
    pub fn new(
        parent_team_pk: Partition,
        application_id: String,
        doc_id: String,
        doc_title_snapshot: String,
        body_hash_snapshot: String,
        agreed_by: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            parent_team_pk: parent_team_pk.to_string(),
            application_id,
            doc_id,
            doc_title_snapshot,
            body_hash_snapshot,
            agreed_at: now,
            agreed_by,
        }
    }

    /// Every agreement row for one application under a parent.
    pub async fn list_by_application(
        parent_pk: &Partition,
        application_id: &str,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .parent_team_pk(StringOp::Eq(parent_pk.to_string()))
                    .application_id(StringOp::Eq(application_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }
}
