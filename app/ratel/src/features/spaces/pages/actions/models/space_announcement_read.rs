#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A user's confirmation that they read a space announcement. Its presence
/// marks the announcement action as participated for that user, which moves
/// the announcement card from the active dashboard into the archive.
/// `(user_pk, space_id, action_id)` is the natural key. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(
    table = "space_announcement_reads",
    unique(user_pk, space_id, action_id)
)]
pub struct SpaceAnnouncementRead {
    pub id: Uuid,

    /// Reader as full `Partition` string (`USER#…`).
    #[postgres(index)]
    pub user_pk: String,
    #[postgres(index)]
    pub space_id: String,
    pub action_id: String,

    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl SpaceAnnouncementRead {
    pub fn new(space_id: &SpacePartition, action_id: &str, user_pk: &Partition) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            space_id: space_id.0.clone(),
            action_id: action_id.to_string(),
            created_at: get_now_timestamp_millis(),
        }
    }

    /// Idempotent upsert on `(user_pk, space_id, action_id)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "space_id", "action_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Whether `user_pk` has confirmed the announcement `action_id` in `space_id`.
    pub async fn exists(
        space_id: &SpacePartition,
        action_id: &str,
        user_pk: &Partition,
    ) -> crate::common::Result<bool> {
        Self::repository()
            .find_one(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .action_id(StringOp::Eq(action_id.to_string())),
            )
            .await
            .map(|r| r.is_some())
            .map_err(crate::common::Error::from)
    }
}
