use crate::common::*;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use postgres::uuid::Uuid;

/// Per-(user, space) marker recording the last `SpaceScore.total_score`
/// applied to the user's CharacterXp. Used to compute the delta on each
/// SpaceScore MODIFY event so XP is idempotent under stream replay.
///
/// Was DynamoDB `USER#{id}` + `CHARACTER_XP_SOURCE#{space_id}`; the pk/sk pair
/// is now the natural key `(user_pk, space_id)` (composite UNIQUE) on a
/// surrogate uuid PK. `user_pk` / `space_id` are cross-feature references
/// stored as plain strings (no FK — rule 5).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "character_xp_sources", unique(user_pk, space_id))]
pub struct CharacterXpSource {
    pub id: Uuid,

    // The composite UNIQUE index `(user_pk, space_id)` covers equality on the
    // `user_pk` leftmost prefix, so `get_for` needs no extra single-column
    // index here.
    pub user_pk: String,
    pub space_id: String,

    pub last_seen_score: i64,
    pub updated_at: i64,
}

impl CharacterXpSource {
    pub fn new(user_pk: Partition, space_id: String, last_seen_score: i64) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            space_id,
            last_seen_score,
            updated_at: now,
        }
    }

    /// Load the `(user, space)` marker, or `None` before the first score.
    pub async fn get_for(
        user_pk: &Partition,
        space_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .space_id(StringOp::Eq(space_id.to_string())),
            )
            .await
            .map_err(super::map_db_err)
    }

    /// Natural-key upsert on `(user_pk, space_id)` — overwrites the `last_seen`
    /// marker every time (the old code always `upsert`ed here, unconditionally).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "space_id"], self)
            .await
            .map_err(super::map_db_err)
    }
}
