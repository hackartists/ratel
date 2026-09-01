use crate::common::*;
use crate::features::character::leveling;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use postgres::uuid::Uuid;

/// One XP/level row per user (was DynamoDB `USER#{id}` + `CHARACTER_XP`).
/// The old pk/sk pair encoded a single row per user, so `user_pk` is the
/// natural key (UNIQUE) and `id` is a surrogate uuid PK.
///
/// `user_pk` is a **cross-feature** reference (the actor is owned by the
/// auth/users feature, and — via `apply_character_xp_delta` — may also be a
/// `Team`). It is stored as the full `Partition` string (`"USER#<id>"` /
/// `"TEAM#<id>"`) to preserve the User/Team distinction the DynamoDB prefix
/// gave for free. No FK is declared (rule 5).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "character_xps")]
pub struct CharacterXp {
    pub id: Uuid,

    /// Natural key — the actor's `Partition` string. UNIQUE: one row per user.
    #[postgres(unique)]
    pub user_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Monotonic — sum of every SpaceScore delta the user has accumulated.
    pub total_xp: i64,
    /// Derived from `total_xp`; denormalized so the page is a single point read.
    pub level: i32,
    /// `5 · level` — granted SP, monotonic.
    pub total_sp_granted: i32,
    /// Sum of skill costs paid via the level-up endpoint.
    pub total_sp_spent: i32,
}

impl CharacterXp {
    pub fn unspent_sp(&self) -> i32 {
        self.total_sp_granted - self.total_sp_spent
    }

    pub fn new(user_pk: Partition) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            created_at: now,
            updated_at: now,
            total_xp: 0,
            level: 1,
            // 5 SP at L1 from day 0
            total_sp_granted: leveling::total_sp_granted(1),
            total_sp_spent: 0,
        }
    }

    /// Single-row read for a user — replaces the DynamoDB point read on
    /// `(USER#{id}, CHARACTER_XP)`. Returns `None` when the user has never
    /// accumulated XP; callers fall back to `CharacterXp::new(..)`.
    pub async fn get_by_user(user_pk: &Partition) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(super::map_db_err)
    }

    /// Natural-key upsert (insert-or-update on `user_pk`). Preserves the
    /// surrogate `id` on conflict, and preserves `created_at` as long as the
    /// caller carries a loaded row (or a fresh `new(..)` for first insert).
    /// Replaces the old create/update branching that DynamoDB required.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(super::map_db_err)
    }
}
