use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Singleton pointer row. Tracks the *current waiting Round* so the
/// matching service can find it in O(1).
///
/// Postgres migration: the DynamoDB `(FactFoldLobbySingleton,
/// FactFoldLobby)` pair becomes a surrogate `id` PK plus a fixed
/// `singleton` natural key (UNIQUE).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_lobbies")]
pub struct FactFoldLobby {
    pub id: Uuid,

    #[postgres(unique)]
    pub singleton: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// `Some` while a round is accepting joins; `None` between rounds.
    pub current_round_id: Option<String>,
}

/// Fixed value of the `singleton` natural key column.
pub const FACT_FOLD_LOBBY_SINGLETON: &str = "fact_fold_lobby";

impl FactFoldLobby {
    /// Read the singleton, returning a default empty lobby when the
    /// row doesn't exist yet (first deploy).
    pub async fn get_or_default() -> crate::common::Result<Self> {
        let row = Self::repository()
            .find_one(Self::query().singleton(StringOp::Eq(FACT_FOLD_LOBBY_SINGLETON.to_string())))
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.unwrap_or_else(|| {
            let now = crate::common::utils::time::get_now_timestamp_millis();
            Self {
                id: Uuid::now_v7(),
                singleton: FACT_FOLD_LOBBY_SINGLETON.to_string(),
                created_at: now,
                updated_at: now,
                current_round_id: None,
            }
        }))
    }

    /// Natural-key upsert on the fixed singleton key.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["singleton"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
