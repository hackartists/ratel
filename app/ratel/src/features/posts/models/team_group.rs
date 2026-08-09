use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A permission group within a team (legacy authorization model).
///
/// Postgres migration: the DynamoDB identity `(pk = Team(team_id),
/// sk = TeamGroup(group_id))` collapses to a surrogate `id` PK (the former
/// group id) plus an indexed `team_id` reference for listing a team's groups.
/// `permissions` remains the packed `i64` bitmask.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "team_groups")]
pub struct TeamGroup {
    pub id: Uuid,

    #[postgres(index)]
    pub team_id: Uuid,

    #[postgres(order)]
    pub created_at: i64,

    pub name: String,
    pub description: String,

    pub members: i64,

    pub permissions: i64,
}

#[cfg(feature = "server")]
impl TeamGroup {
    pub fn new(
        team_id: Uuid,
        name: String,
        description: String,
        permissions: TeamGroupPermissions,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            team_id,
            created_at: now,
            name,
            description,
            permissions: permissions.into(),
            members: 1,
        }
    }
}
