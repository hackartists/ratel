use crate::features::activity::*;
use crate::features::spaces::pages::actions::types::SpaceActionType;
use postgres::PostgresEntity;
use uuid::Uuid;

/// One activity event (XP-earning action) a user/team performed in a space.
///
/// Postgres migration: the DynamoDB identity was
/// `pk = (SpacePartition, AuthorPartition)` + `sk = SPACE_ACTIVITY#{dedup}#{now}`.
/// It becomes a surrogate `id` PK with the former key parts flattened into
/// plain columns:
/// - `space_id` — cross-feature reference (spaces), bare id, indexed, **no FK**.
/// - `author_pk` — the actor stored as its full `Partition` string
///   (`USER#…` / `TEAM#…`) so the User/Team distinction survives — cross-feature,
///   **no FK**.
/// - `dedup_key` — the per-action dedup token (`action_id`, or
///   `action_id#comment#{comment_id}` for discussions). Deduplication remains a
///   pre-insert query (as it was in DynamoDB), not a DB constraint, so repeated
///   `{now}`-suffixed rows are still possible if two writers race — the guard in
///   `record_activity` prevents that in practice.
///
/// `action_type` is a `SpaceActionType` owned by the (un-migrated) `spaces`
/// feature, so it is stored as its serde string form rather than a native PG
/// enum. `data` is an opaque jsonb document (`SpaceActivityData`).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_activities")]
pub struct SpaceActivity {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    /// Actor as full `Partition` string (`USER#…` / `TEAM#…`).
    pub author_pk: String,

    #[postgres(order)]
    pub created_at: i64,

    /// Dedup token — see struct docs.
    pub dedup_key: String,

    pub user_name: String,
    pub user_avatar: String,
    pub action_id: String,
    /// Serde string form of `SpaceActionType` (feature-owned enum, not a native
    /// PG enum). Use [`SpaceActivity::action_type`] to recover the typed value.
    pub action_type: String,
    pub data: SpaceActivityData,

    pub base_score: i64,
    pub additional_score: i64,
    pub total_score: i64,
}

#[cfg(feature = "server")]
fn action_type_to_string(action_type: &SpaceActionType) -> String {
    serde_json::to_value(action_type)
        .ok()
        .and_then(|v| v.as_str().map(str::to_string))
        .unwrap_or_default()
}

#[cfg(feature = "server")]
impl SpaceActivity {
    /// Recover the typed `SpaceActionType` from the stored string form.
    pub fn action_type(&self) -> SpaceActionType {
        serde_json::from_value(serde_json::Value::String(self.action_type.clone()))
            .unwrap_or_default()
    }

    pub async fn new(
        space_id: SpacePartition,
        author: AuthorPartition,
        action_id: String,
        action_type: SpaceActionType,
        data: SpaceActivityData,
        base_score: i64,
        additional_score: i64,
        user_name: String,
        user_avatar: String,
    ) -> Self {
        Self::new_with_dedup(
            space_id,
            author,
            action_id.clone(),
            action_type,
            data,
            base_score,
            additional_score,
            user_name,
            user_avatar,
            action_id,
        )
        .await
    }

    pub async fn new_with_dedup(
        space_id: SpacePartition,
        author: AuthorPartition,
        action_id: String,
        action_type: SpaceActionType,
        data: SpaceActivityData,
        base_score: i64,
        additional_score: i64,
        user_name: String,
        user_avatar: String,
        dedup_key: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        // Apply the user's Ranker skill multiplier to `additional_score` only;
        // `base_score` is always unboosted. If the skill row read fails for any
        // reason, fall back to permille=1000 (no boost) — never fail the insert.
        let mult_permille = {
            use crate::features::character::leveling::multiplier_permille;
            use crate::features::character::models::CharacterSkill;
            use crate::features::character::types::SkillId;
            let user_pk: Partition = match author.clone() {
                AuthorPartition::User(id) => Partition::User(id),
                AuthorPartition::Team(id) => Partition::Team(id),
                AuthorPartition::Unknown => Partition::None,
            };
            CharacterSkill::level_or_zero(&user_pk, SkillId::Ranker)
                .await
                .map(multiplier_permille)
                .unwrap_or(1000)
        };
        let boosted_additional =
            crate::features::character::leveling::apply_permille(additional_score, mult_permille);
        let total_score = base_score + boosted_additional;

        Self {
            id: Uuid::now_v7(),
            space_id: space_id.0,
            author_pk: author.to_string(),
            created_at: now,
            dedup_key,
            user_name,
            user_avatar,
            action_id,
            action_type: action_type_to_string(&action_type),
            data,
            base_score,
            additional_score: boosted_additional,
            total_score,
        }
    }
}
