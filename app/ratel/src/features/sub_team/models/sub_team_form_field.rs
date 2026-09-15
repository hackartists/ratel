use crate::common::*;
use crate::features::sub_team::models::json::StringList;
use crate::features::sub_team::types::TeamProfileLink;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// A single field in a parent team's customizable application form.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(parent), sk =
/// SubTeamFormField(field_id))` identity becomes a surrogate `id` PK (equal to
/// the former field_id uuid) plus `team_pk` (raw `"TEAM#…"` partition string,
/// cross-feature reference, indexed). Changes are NOT retroactively applied to
/// in-flight applications — each `SubTeamApplication` stores a `form_snapshot`
/// at submit time.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "sub_team_form_fields"))]
pub struct SubTeamFormField {
    /// Surrogate primary key (former field_id).
    pub id: Uuid,

    /// Owning parent team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Human-readable field label shown on the apply page.
    pub label: String,
    pub field_type: SubTeamFormFieldType,

    pub required: bool,

    pub order: i32,

    /// For SingleSelect / MultiSelect — the allowed choices in display order.
    /// Stored as jsonb.
    pub options: StringList,

    /// When set, the apply page prefills this field with the applicant
    /// team's matching attribute and renders the field read-only.
    pub linked_to: Option<TeamProfileLink>,

    /// System-seeded default field admins can't edit or delete.
    pub locked: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum SubTeamFormFieldType {
    #[default]
    ShortText,
    LongText,
    Number,
    Date,
    SingleSelect,
    MultiSelect,
    Url,
}

#[cfg(feature = "server")]
impl SubTeamFormField {
    pub fn new(
        parent_team_pk: Partition,
        label: String,
        field_type: SubTeamFormFieldType,
        required: bool,
        order: i32,
        options: Vec<String>,
        linked_to: Option<TeamProfileLink>,
    ) -> Self {
        Self::new_with_lock(
            parent_team_pk,
            label,
            field_type,
            required,
            order,
            options,
            linked_to,
            false,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn new_with_lock(
        parent_team_pk: Partition,
        label: String,
        field_type: SubTeamFormFieldType,
        required: bool,
        order: i32,
        options: Vec<String>,
        linked_to: Option<TeamProfileLink>,
        locked: bool,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            team_pk: parent_team_pk.to_string(),
            created_at: now,
            updated_at: now,
            label,
            field_type,
            required,
            order,
            options: StringList(options),
            linked_to,
            locked,
        }
    }

    /// The former field_id — the surrogate `id` in string form.
    pub fn field_id(&self) -> String {
        self.id.to_string()
    }

    /// Every form field under a parent team.
    pub async fn list_for_team(team_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Load a field by its id, scoped to the owning team (returns `None` when
    /// the id is malformed, missing, or belongs to a different team).
    pub async fn find_in_team(
        team_pk: &Partition,
        field_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        let Ok(uuid) = field_id.parse::<Uuid>() else {
            return Ok(None);
        };
        let row = Self::repository()
            .get(uuid)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.filter(|f| f.team_pk == team_pk.to_string()))
    }
}
