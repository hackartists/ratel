#[cfg(feature = "server")]
use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A reference material (PDF) attached to a discussion's AI moderator config.
///
/// Postgres migration: the DynamoDB single-table key
/// `pk = CompositePartition(SpacePartition, discussion_sk)` +
/// `sk = EntityType::AiModeratorMaterial(material_id)` becomes a surrogate
/// `id` PK — the old `material_id` (a `now_v7` uuid) *is* the surrogate PK now.
/// `space_id` / `discussion_id` are cross-feature references (owned by the
/// spaces feature) stored as plain strings — **no** FK for now.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "ai_moderator_materials")]
pub struct AiModeratorMaterial {
    pub id: Uuid,
    #[postgres(index)]
    pub space_id: String,
    #[postgres(index)]
    pub discussion_id: String,
    pub file_name: String,
    pub file_url: String,
    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl AiModeratorMaterial {
    pub fn new(
        space_id: SpacePartition,
        discussion_sk: String,
        file_name: String,
        file_url: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_id: space_id.to_string(),
            discussion_id: discussion_sk,
            file_name,
            file_url,
            created_at: now,
        }
    }
}
