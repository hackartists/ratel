use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::FactOrFoldSettingsResponse;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Singleton row carrying admin-tunable parameters for the
/// *Fact or Fold* game.
///
/// Postgres migration: the DynamoDB `(FactFoldSettings,
/// FactFoldSettings)` singleton pair becomes a surrogate `id` PK plus
/// a fixed `singleton` natural key (UNIQUE).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_settings")]
pub struct FactFoldSettings {
    pub id: Uuid,

    #[postgres(unique)]
    pub singleton: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub round_capacity: i32,
    pub stage_news_reveal_sec: i32,
    pub stage_bet_sec: i32,
    pub stage_rationale_sec: i32,
    pub stage_reveal_sec: i32,
    pub stage_debate_sec: i32,
    pub min_bet_rp: i64,
    pub max_bet_rp: i64,
    pub correct_side_multiplier_bps: i32,
    pub insider_correct_bonus_bps: i32,
    pub influence_bonus_bps: i32,
    pub new_user_signup_rp: i64,
    pub reconnect_grace_sec: i32,
    pub queue_low_alert_days: i32,
}

/// Fixed value of the `singleton` natural key column.
pub const FACT_FOLD_SETTINGS_SINGLETON: &str = "fact_fold_settings";

impl FactFoldSettings {
    /// Load the singleton row, returning `FactOrFoldSettingsResponse::default()`
    /// when the row has not been initialised yet.
    pub async fn get_or_default() -> crate::common::Result<FactOrFoldSettingsResponse> {
        let row = Self::repository()
            .find_one(
                Self::query().singleton(StringOp::Eq(FACT_FOLD_SETTINGS_SINGLETON.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row
            .map(FactOrFoldSettingsResponse::from)
            .unwrap_or_default())
    }

    /// Natural-key upsert on the fixed singleton key.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["singleton"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    pub fn merge_response(mut self, r: FactOrFoldSettingsResponse) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        self.round_capacity = r.round_capacity;
        self.stage_news_reveal_sec = r.stage_news_reveal_sec;
        self.stage_bet_sec = r.stage_bet_sec;
        self.stage_rationale_sec = r.stage_rationale_sec;
        self.stage_reveal_sec = r.stage_reveal_sec;
        self.stage_debate_sec = r.stage_debate_sec;
        self.min_bet_rp = r.min_bet_rp;
        self.max_bet_rp = r.max_bet_rp;
        self.correct_side_multiplier_bps = r.correct_side_multiplier_bps;
        self.insider_correct_bonus_bps = r.insider_correct_bonus_bps;
        self.influence_bonus_bps = r.influence_bonus_bps;
        self.new_user_signup_rp = r.new_user_signup_rp;
        self.reconnect_grace_sec = r.reconnect_grace_sec;
        self.queue_low_alert_days = r.queue_low_alert_days;
        if self.id.is_nil() {
            self.id = Uuid::now_v7();
        }
        if self.created_at == 0 {
            self.created_at = now;
        }
        self.updated_at = now;
        self.singleton = FACT_FOLD_SETTINGS_SINGLETON.to_string();
        self
    }
}

impl From<FactFoldSettings> for FactOrFoldSettingsResponse {
    fn from(v: FactFoldSettings) -> Self {
        Self {
            round_capacity: v.round_capacity,
            stage_news_reveal_sec: v.stage_news_reveal_sec,
            stage_bet_sec: v.stage_bet_sec,
            stage_rationale_sec: v.stage_rationale_sec,
            stage_reveal_sec: v.stage_reveal_sec,
            stage_debate_sec: v.stage_debate_sec,
            min_bet_rp: v.min_bet_rp,
            max_bet_rp: v.max_bet_rp,
            correct_side_multiplier_bps: v.correct_side_multiplier_bps,
            insider_correct_bonus_bps: v.insider_correct_bonus_bps,
            influence_bonus_bps: v.influence_bonus_bps,
            new_user_signup_rp: v.new_user_signup_rp,
            reconnect_grace_sec: v.reconnect_grace_sec,
            queue_low_alert_days: v.queue_low_alert_days,
        }
    }
}
