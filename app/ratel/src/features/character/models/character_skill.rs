use crate::common::*;
use crate::features::character::types::SkillId;
use postgres::PostgresEntity;
use postgres::ops::StringOp;
use postgres::uuid::Uuid;

/// One row per (user, skill) — was DynamoDB `USER#{id}` +
/// `CHARACTER_SKILL#{skill_id}`. The pk/sk pair is now the natural key
/// `(user_pk, skill_id)` (composite UNIQUE) on a surrogate uuid PK.
///
/// `user_pk` is a cross-feature actor reference stored as the full `Partition`
/// string (no FK — rule 5). `skill_id` is the stable skill slug
/// (`"money_tree"`, `"ranker"`, …).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "character_skills", unique(user_pk, skill_id))]
pub struct CharacterSkill {
    pub id: Uuid,

    // The composite UNIQUE index `(user_pk, skill_id)` covers equality on the
    // `user_pk` leftmost prefix, so `list_for_user` / `get_for` need no extra
    // single-column index here.
    pub user_pk: String,
    pub skill_id: String,

    pub level: i32, // 0..MAX_SKILL_LEVEL
    pub created_at: i64,
    pub updated_at: i64,
}

impl CharacterSkill {
    pub fn new(user_pk: Partition, skill_id: SkillId) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            skill_id: skill_id.as_str().to_string(),
            level: 0,
            created_at: now,
            updated_at: now,
        }
    }

    /// Load the single (user, skill) row, or `None` when the user has never
    /// leveled it. Callers that only need the level use `level_or_zero`; the
    /// level-up handler uses this so it can carry `created_at` into the upsert.
    pub async fn get_for(
        user_pk: &Partition,
        skill_id: SkillId,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .skill_id(StringOp::Eq(skill_id.as_str().to_string())),
            )
            .await
            .map_err(super::map_db_err)
    }

    /// Read a single skill row's level, treating "row absent" as level 0.
    /// Use only when you need exactly one skill (e.g. inside the level-up
    /// handler before mutating). For "show me every skill the user has",
    /// use `list_for_user` instead — it's a single query.
    pub async fn level_or_zero(
        user_pk: &Partition,
        skill_id: SkillId,
    ) -> crate::common::Result<i32> {
        Ok(Self::get_for(user_pk, skill_id)
            .await?
            .map(|r| r.level)
            .unwrap_or(0))
    }

    /// Read every skill row for a user in a single query
    /// (`WHERE user_pk = $1`). Returns the raw rows; the caller maps them to
    /// `(SkillId, level)` pairs and fills in `level = 0` for missing entries.
    pub async fn list_for_user(user_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        let page = Self::repository()
            .find(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(super::map_db_err)?;
        Ok(page.items)
    }

    /// Natural-key upsert on `(user_pk, skill_id)`. Preserves the surrogate
    /// `id` and — when the caller carries a loaded row — `created_at`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "skill_id"], self)
            .await
            .map_err(super::map_db_err)
    }

    /// Convenience: turn a `list_for_user` result into a complete
    /// `(SkillId, level)` map for every known SkillId, defaulting absent
    /// rows to level 0.
    pub fn levels_by_id(rows: &[Self]) -> Vec<(SkillId, i32)> {
        let level_for = |id: SkillId| -> i32 {
            rows.iter()
                .find(|r| r.skill_id == id.as_str())
                .map(|r| r.level)
                .unwrap_or(0)
        };
        [
            SkillId::MoneyTree,
            SkillId::Ranker,
            SkillId::Influencer,
            SkillId::Sweeper,
        ]
        .into_iter()
        .map(|id| (id, level_for(id)))
        .collect()
    }
}
