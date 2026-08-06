use crate::common::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Audit row for a space status transition (was DynamoDB
/// `SPACE_STATUS_CHANGE_EVENT#{uuid}` pk/sk).
///
/// Postgres migration: the uuid that was duplicated across `pk`/`sk` becomes the
/// surrogate `id` PK. `space_pk` is a **cross-feature** reference stored as the
/// space's full `Partition` string (`"SPACE#…"`) — a plain indexed column, **no
/// FK** for now. `old_status` / `new_status` keep the shared `SpaceStatus` enum
/// type (Postgres `TEXT` codec in [`super::pg_enum_glue`]).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", postgres(table = "space_status_change_events"))]
pub struct SpaceStatusChangeEvent {
    #[serde(default)]
    pub id: Uuid,

    pub created_at: i64,

    /// Cross-feature reference — the space, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,
    pub old_status: Option<SpaceStatus>,
    pub new_status: SpaceStatus,
}

#[cfg(feature = "server")]
impl SpaceStatusChangeEvent {
    pub fn new(
        space_pk: Partition,
        old_status: Option<SpaceStatus>,
        new_status: SpaceStatus,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            created_at: crate::common::utils::time::get_now_timestamp_millis(),
            space_pk: space_pk.to_string(),
            old_status,
            new_status,
        }
    }

    /// Persist this audit row.
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every status-change event for a space, newest first.
    pub async fn find_by_space(space_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(
                        SpaceStatusChangeEventColumn::CreatedAt,
                        postgres::Order::Desc,
                    ),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }
}
