#[cfg(feature = "server")]
use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Per-discussion AI moderator configuration.
///
/// Postgres migration: the DynamoDB single-table key
/// `pk = CompositePartition(SpacePartition, discussion_sk)` +
/// `sk = EntityType::AiModeratorConfig` (a singleton per discussion) becomes a
/// surrogate `id` PK with the `unique(space_id, discussion_id)` natural key.
/// `space_id` / `discussion_id` are cross-feature references (owned by the
/// spaces feature) stored as plain strings — **no** FK for now.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "ai_moderator_configs", unique(space_id, discussion_id))]
pub struct AiModeratorConfig {
    pub id: Uuid,
    #[postgres(index)]
    pub space_id: String,
    pub discussion_id: String,
    pub enabled: bool,
    pub reply_interval: i64,
    pub guidelines: String,
    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl AiModeratorConfig {
    pub fn new(space_id: SpacePartition, discussion_sk: String) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_id: space_id.to_string(),
            discussion_id: discussion_sk,
            enabled: false,
            reply_interval: 5,
            guidelines: String::new(),
            created_at: now,
            updated_at: now,
        }
    }
}
