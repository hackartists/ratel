use crate::features::spaces::pages::actions::actions::discussion::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A discussion category label for a space.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceCategory#{name}`. It becomes a surrogate `id` PK plus
/// `(space_id, name)` natural key. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_categories", unique(space_id, name))]
pub struct SpaceCategory {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,

    #[postgres(order)]
    pub created_at: i64,

    pub name: String,
}

#[cfg(feature = "server")]
impl SpaceCategory {
    pub fn new(space_pk: SpacePartition, name: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            created_at: crate::common::utils::time::get_now_timestamp_millis(),
            name,
        }
    }

    /// Natural-key upsert on `(space_id, name)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "name"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// All category names for a space.
    pub async fn list_names(space_pk: &SpacePartition) -> crate::common::Result<Vec<String>> {
        Self::repository()
            .find(Self::query().space_id(StringOp::Eq(space_pk.0.clone())))
            .await
            .map(|p| p.items.into_iter().map(|c| c.name).collect())
            .map_err(crate::common::Error::from)
    }
}
