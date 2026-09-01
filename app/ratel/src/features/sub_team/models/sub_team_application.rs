use crate::common::*;

use super::SubTeamFormFieldType;
use crate::features::sub_team::models::json::FormValues;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// A sub-team application to a parent team.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(parent), sk =
/// SubTeamApplication(application_id))` identity plus its gsi1
/// (`applicant_team_pk` / `created_at`) become a surrogate `id` PK (equal to
/// the former application_id uuid) with two indexed partition columns:
/// `parent_team_pk` (the parent's queue) and `applicant_team_pk` (the applying
/// team's history). Both hold raw `"TEAM#…"` partition strings (cross-feature
/// references). `created_at` drives the DESC ordering the gsi1 provided.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "sub_team_applications"))]
pub struct SubTeamApplication {
    /// Surrogate primary key (former application_id).
    pub id: Uuid,

    /// Parent team partition string (`"TEAM#…"`). Indexed — the parent's queue.
    #[cfg_attr(feature = "server", postgres(index))]
    pub parent_team_pk: String,

    /// Applicant team partition string (`"TEAM#…"`). Indexed — the applying
    /// team's application history (was gsi1 pk).
    #[cfg_attr(feature = "server", postgres(index))]
    pub applicant_team_pk: String,

    #[cfg_attr(feature = "server", postgres(index))]
    pub created_at: i64,

    pub updated_at: i64,

    pub submitted_at: Option<i64>,
    pub decided_at: Option<i64>,

    /// Human-readable id (equals `id` in string form).
    pub application_id: String,

    /// Raw parent team UUID (convenient for DTOs).
    pub parent_team_id: String,

    /// Raw sub-team UUID (convenient for DTOs).
    pub sub_team_id: String,

    /// The user who submitted on behalf of the applicant team.
    pub submitter_user_id: String,

    pub status: SubTeamApplicationStatus,

    /// Used for both Reject (reason) and Return (revision comment).
    pub decision_reason: Option<String>,

    /// Snapshot of the parent's form fields at submission time. Stored as jsonb.
    pub form_snapshot: FormSnapshotList,

    /// field_id → applicant-entered value. Stored as jsonb.
    pub form_values: FormValues,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
pub enum SubTeamApplicationStatus {
    /// Being filled in; not yet submitted to the parent.
    #[default]
    Draft,
    /// Submitted; awaiting parent decision.
    Pending,
    Approved,
    Rejected,
    /// Parent requested revision — applicant can edit + resubmit.
    Returned,
    Cancelled,
}

/// Immutable snapshot of a single form field as it existed at submission time.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct SubTeamFormFieldSnapshot {
    pub field_id: String,
    pub label: String,
    pub field_type: SubTeamFormFieldType,
    pub required: bool,
    pub order: i32,
    pub options: Vec<String>,
    #[serde(default)]
    pub locked: bool,
}

/// `Vec<SubTeamFormFieldSnapshot>` stored as jsonb.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct FormSnapshotList(pub Vec<SubTeamFormFieldSnapshot>);

#[cfg(feature = "server")]
impl SubTeamApplication {
    pub fn new(
        parent_team_pk: Partition,
        applicant_team_pk: Partition,
        parent_team_id: String,
        sub_team_id: String,
        submitter_user_id: String,
    ) -> Self {
        let id = Uuid::now_v7();
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id,
            parent_team_pk: parent_team_pk.to_string(),
            applicant_team_pk: applicant_team_pk.to_string(),
            created_at: now,
            updated_at: now,
            submitted_at: None,
            decided_at: None,
            application_id: id.to_string(),
            parent_team_id,
            sub_team_id,
            submitter_user_id,
            status: SubTeamApplicationStatus::Draft,
            decision_reason: None,
            form_snapshot: FormSnapshotList(Vec::new()),
            form_values: FormValues(std::collections::HashMap::new()),
        }
    }

    /// The parent team partition (was `pk`).
    pub fn parent_partition(&self) -> Partition {
        self.parent_team_pk.parse().unwrap_or_default()
    }

    /// The applicant team partition (was gsi1 pk).
    pub fn applicant_partition(&self) -> Partition {
        self.applicant_team_pk.parse().unwrap_or_default()
    }

    /// Every application filed by one applicant team, newest-created first
    /// (was the gsi1 `find_by_applicant` DESC scan).
    pub async fn find_by_applicant_all(
        applicant_pk: &Partition,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .applicant_team_pk(StringOp::Eq(applicant_pk.to_string()))
                    .order_by(SubTeamApplicationColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// One page of an applicant's application history, newest first.
    pub async fn page_by_applicant(
        applicant_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .applicant_team_pk(StringOp::Eq(applicant_pk.to_string()))
                    .order_by(SubTeamApplicationColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every application in a parent's queue, newest-created first.
    pub async fn find_by_parent_all(parent_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .parent_team_pk(StringOp::Eq(parent_pk.to_string()))
                    .order_by(SubTeamApplicationColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// One page of a parent's queue, newest first.
    pub async fn page_by_parent(
        parent_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .parent_team_pk(StringOp::Eq(parent_pk.to_string()))
                    .order_by(SubTeamApplicationColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Load an application by id, scoped to the parent's queue.
    pub async fn find_in_parent(
        parent_pk: &Partition,
        application_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Ok(Self::get_scoped(application_id)
            .await?
            .filter(|a| a.parent_team_pk == parent_pk.to_string()))
    }

    /// Load an application by id, scoped to the applicant team.
    pub async fn find_in_applicant(
        applicant_pk: &Partition,
        application_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Ok(Self::get_scoped(application_id)
            .await?
            .filter(|a| a.applicant_team_pk == applicant_pk.to_string()))
    }

    async fn get_scoped(application_id: &str) -> crate::common::Result<Option<Self>> {
        let Ok(uuid) = application_id.parse::<Uuid>() else {
            return Ok(None);
        };
        Self::repository()
            .get(uuid)
            .await
            .map_err(crate::common::Error::from)
    }
}
