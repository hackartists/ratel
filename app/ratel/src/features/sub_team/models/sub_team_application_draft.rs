use crate::common::*;
use crate::features::sub_team::models::json::FormValues;
use std::collections::HashMap;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// In-progress (unsubmitted) sub-team application.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(applicant), sk =
/// SubTeamApplicationDraft(parent_team_id))` identity becomes a surrogate `id`
/// PK plus the natural key `unique(applicant_team_pk, parent_team_id)` — one
/// draft per (applicant team, parent team) pair. `applicant_team_pk` holds the
/// raw `"TEAM#…"` partition string (cross-feature reference). Cleared after a
/// successful submit.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(
        table = "sub_team_application_drafts",
        unique(applicant_team_pk, parent_team_id)
    )
)]
pub struct SubTeamApplicationDraft {
    /// Surrogate primary key.
    pub id: Uuid,

    /// Applicant team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub applicant_team_pk: String,

    /// Target parent team id (raw uuid).
    pub parent_team_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Applicant team's id (denormalized for filtering).
    pub applicant_team_id: String,

    /// Form values keyed by `field_id`. Stored as jsonb.
    pub form_values: FormValues,

    /// Doc agreements captured so far. Stored as jsonb.
    pub doc_agreements: DocAgreementList,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct DocAgreementSnapshot {
    pub doc_id: String,
    pub body_hash: String,
}

/// `Vec<DocAgreementSnapshot>` stored as jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct DocAgreementList(pub Vec<DocAgreementSnapshot>);

#[cfg(feature = "server")]
impl SubTeamApplicationDraft {
    pub fn new(
        applicant_pk: Partition,
        parent_team_id: String,
        form_values: HashMap<String, serde_json::Value>,
        doc_agreements: Vec<DocAgreementSnapshot>,
    ) -> Self {
        let applicant_team_id = match &applicant_pk {
            Partition::Team(id) => id.clone(),
            _ => String::new(),
        };
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            applicant_team_pk: applicant_pk.to_string(),
            parent_team_id,
            created_at: now,
            updated_at: now,
            applicant_team_id,
            form_values: FormValues(form_values),
            doc_agreements: DocAgreementList(doc_agreements),
        }
    }

    /// The draft for `(applicant, parent)`, if any.
    pub async fn find_draft(
        applicant_pk: &Partition,
        parent_team_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .applicant_team_pk(StringOp::Eq(applicant_pk.to_string()))
                    .parent_team_id(StringOp::Eq(parent_team_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Idempotent autosave — overwrites the existing `(applicant, parent)`
    /// draft in place (was `DynamoEntity::upsert`, an unconditional put).
    pub async fn save(&self) -> crate::common::Result<()> {
        Self::repository()
            .upsert_on(&["applicant_team_pk", "parent_team_id"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Delete the `(applicant, parent)` draft if present. Idempotent.
    pub async fn delete_draft(
        applicant_pk: &Partition,
        parent_team_id: &str,
    ) -> crate::common::Result<()> {
        if let Some(row) = Self::find_draft(applicant_pk, parent_team_id).await? {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }
}
