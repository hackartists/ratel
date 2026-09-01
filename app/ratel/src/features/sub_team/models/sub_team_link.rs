use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
use uuid::Uuid;

/// Recognized parent→child relationship record. One row per approved sub-team.
///
/// **Postgres migration:** the DynamoDB single-table `(pk = Team(parent),
/// sk = SubTeamLink(child))` identity becomes a surrogate `id` PK plus the
/// natural key `unique(parent_team_pk, child_team_id)`. `parent_team_pk` holds
/// the raw partition string (`"TEAM#…"`, a cross-feature reference to the
/// `Team` entity — plain column, no FK). Deleted on deregister, leave-parent,
/// or parent-deletion cascade.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "sub_team_links", unique(parent_team_pk, child_team_id))
)]
pub struct SubTeamLink {
    /// Surrogate primary key (minted `now_v7` on insert when nil).
    pub id: Uuid,

    /// Parent team partition string (`"TEAM#…"`). Cross-feature reference —
    /// indexed so a parent's sub-team sweep stays a single-index query.
    #[cfg_attr(feature = "server", postgres(index))]
    pub parent_team_pk: String,

    /// Raw child team UUID.
    pub child_team_id: String,

    pub approved_at: i64,

    /// User pk of the parent-team admin who approved.
    pub approved_by: String,

    /// The application this link was born from.
    pub source_application_id: String,
}

#[cfg(feature = "server")]
impl SubTeamLink {
    pub fn new(
        parent_team_pk: Partition,
        child_team_id: String,
        approved_by: String,
        source_application_id: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            parent_team_pk: parent_team_pk.to_string(),
            child_team_id,
            approved_at: now,
            approved_by,
            source_application_id,
        }
    }

    /// The single link row for `(parent, child)`, if any.
    pub async fn find_link(
        parent_pk: &Partition,
        child_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .parent_team_pk(StringOp::Eq(parent_pk.to_string()))
                    .child_team_id(StringOp::Eq(child_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every link row under a parent, newest-approved first.
    pub async fn list_for_parent(parent_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .parent_team_pk(StringOp::Eq(parent_pk.to_string()))
                    .order_by(SubTeamLinkColumn::ApprovedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Delete the `(parent, child)` link if present. Idempotent.
    pub async fn delete_link(parent_pk: &Partition, child_id: &str) -> crate::common::Result<()> {
        if let Some(row) = Self::find_link(parent_pk, child_id).await? {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }
}
