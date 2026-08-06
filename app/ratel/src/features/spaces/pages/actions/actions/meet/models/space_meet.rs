use crate::features::spaces::pages::actions::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Translate)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
pub enum MeetMode {
    #[default]
    #[translate(ko = "예약", en = "Scheduled")]
    Scheduled,
    #[translate(ko = "즉시 시작", en = "Instant")]
    Instant,
}

/// A meet action inside a space.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceMeet#{uuid}`. It becomes a surrogate `id` PK plus:
/// - `space_id` — cross-feature reference (spaces), bare id, indexed, **no FK**.
/// - `meet_id` — the former sk uuid (bare, no prefix). `(space_id, meet_id)` is
///   the natural key.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_meets", unique(space_id, meet_id))]
pub struct SpaceMeet {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    /// The former sk uuid (bare).
    pub meet_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    pub mode: MeetMode,
    pub start_time: i64,
    pub duration_min: i32,
}

#[cfg(feature = "server")]
impl SpaceMeet {
    pub fn new(space_pk: SpacePartition) -> Result<Self> {
        let now = get_now_timestamp_millis();
        let meet_id = uuid::Uuid::new_v4().to_string();
        Ok(Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            meet_id,
            created_at: now,
            updated_at: now,
            mode: MeetMode::Scheduled,
            start_time: now,
            duration_min: 60,
        })
    }

    pub fn can_edit(role: &SpaceUserRole) -> Result<()> {
        if role.is_admin() {
            Ok(())
        } else {
            Err(crate::common::Error::NoPermission)
        }
    }

    /// The former sk value as a `SpaceMeetEntityType` (bare id).
    pub fn meet_entity_type(&self) -> SpaceMeetEntityType {
        SpaceMeetEntityType(self.meet_id.clone())
    }

    /// Fetch the single meet row for `(space_id, meet_id)`.
    pub async fn get_one(
        space_id: &SpacePartition,
        meet_id: &SpaceMeetEntityType,
    ) -> Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .meet_id(StringOp::Eq(meet_id.0.clone())),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}
