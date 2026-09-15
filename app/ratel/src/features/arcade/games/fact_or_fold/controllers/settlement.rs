//! Settlement handler (PR6 step 2).
//!
//! Surface:
//!   POST /api/fact-or-fold/admin/rounds/{round_id}/settle
//!     — manual operator-triggered settlement (admin-gated). Step 3
//!       adds the EventBridge auto-trigger that calls
//!       `settle_round_internal` on every Debate-stage round whose
//!       deadline elapsed.
//!
//! ### Flow
//!
//! 1. Load round; bail if already `Settled` (idempotent — caller
//!    can retry without doubling pay-outs).
//! 2. Load subject (verdict), bets, rationales, participants,
//!    arcade settings, FOF settings (for chip multipliers).
//! 3. Run the pure `settle_round` formula.
//! 4. For each `SettlementOutcome`:
//!    a. `FactFoldSettlement::create` (server defaults to
//!       `create_if_not_exists` semantics via the DynamoEntity
//!       `create` path; a re-run on an existing row errors and
//!       we treat that as "already settled, skip").
//!    b. `ArcadeWallet::settle(user, round, chips_out)` — credits
//!       chips back to the wallet. `wallet.settle` writes its own
//!       ledger row keyed off a fresh txn id; retry safety here
//!       depends on the settlement row's "already exists" gate
//!       above (we skip the whole user when the settlement row
//!       exists).
//!    c. `FactFoldUserStats` upsert — `total_rounds += 1`,
//!       `correct_count += 1 if won`, `lifetime_delta_chips +=
//!       chips_out - buy_in`, `last_played_at = now`. The buy_in
//!       amount comes from `arcade_settings.default_buy_in_chips`
//!       (per A4: per-round buy-in is uniform in v1).
//! 5. Round → `Settled`, `settled_at = now`.

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use crate::common::models::auth::AdminUser;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{
    FactFoldBet, FactFoldLeaderboardEntry, FactFoldParticipant, FactFoldRationale, FactFoldRound,
    FactFoldSettings, FactFoldSettlement, FactFoldSubject, FactFoldSubjectPlay, FactFoldUserStats,
};
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::services::{
    settle_round, SettleRoundInput, SettlementOutcome,
};
#[cfg(feature = "server")]
use crate::features::arcade::models::ArcadeSettings;
#[cfg(feature = "server")]
use crate::features::arcade::wallet::{ArcadeWallet, DdbArcadeWallet};

// ── DTO ─────────────────────────────────────────────────────────────

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct SettleRoundResponse {
    pub round_id: String,
    /// Per-user outcomes. Already settled rounds return the
    /// previously-persisted breakdown.
    pub outcomes: Vec<SettlementBreakdown>,
}

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct SettlementBreakdown {
    pub user_pk: UserPartition,
    pub stake: i64,
    pub won: bool,
    pub base_refund: i64,
    pub correct_bonus: i64,
    pub pool_share: i64,
    pub influence_bonus: i64,
    pub insider_bonus: i64,
    pub chips_out: i64,
}

#[cfg(feature = "server")]
impl From<&SettlementOutcome> for SettlementBreakdown {
    fn from(o: &SettlementOutcome) -> Self {
        Self {
            user_pk: UserPartition(o.user_id.clone()),
            stake: o.stake,
            won: o.won,
            base_refund: o.base_refund,
            correct_bonus: o.correct_bonus,
            pool_share: o.pool_share,
            influence_bonus: o.influence_bonus,
            insider_bonus: o.insider_bonus,
            chips_out: o.chips_out,
        }
    }
}

// ── Public entry point ──────────────────────────────────────────────

/// Idempotent settle-a-round side-effect bundle. Called by:
///   - The manual admin endpoint below.
///   - The EventBridge settlement trigger (PR6 step 3).
///
/// Safe to call repeatedly on the same round — the first call
/// flips `round.status = Settled`; subsequent calls return the
/// already-persisted breakdown without re-running the wallet
/// payout (the per-user settlement row's existence is the gate).
#[cfg(feature = "server")]
pub async fn settle_round_internal(
    cli: &aws_sdk_dynamodb::Client,
    round_id: &str,
) -> Result<SettleRoundResponse> {
    let mut round = FactFoldRound::get_by_round_id(round_id)
        .await
        .map_err(|e| {
            crate::error!("settle_round_internal round read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    // Idempotency: if the round is already Settled, just return
    // the already-persisted breakdown.
    if matches!(round.status, RoundStatus::Settled) {
        let breakdowns = load_existing_breakdowns(round_id).await?;
        return Ok(SettleRoundResponse {
            round_id: round_id.to_string(),
            outcomes: breakdowns,
        });
    }

    // Load all the round-scoped rows.
    let subject = FactFoldSubject::get_by_subject_id(&round.subject_id)
        .await
        .map_err(|e| {
            crate::error!("settle_round_internal subject read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    let participants = FactFoldParticipant::list_by_round(round_id)
        .await
        .map_err(|e| {
            crate::error!("settle_round_internal participants query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let bets = FactFoldBet::list_by_round(round_id).await.map_err(|e| {
        crate::error!("settle_round_internal bets query failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    let rationales = FactFoldRationale::list_by_round(round_id)
        .await
        .map_err(|e| {
            crate::error!("settle_round_internal rationales query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let fof_settings = FactFoldSettings::get_or_default().await.unwrap_or_default();
    let arcade_settings = ArcadeSettings::get_or_default().await.unwrap_or_default();
    let buy_in = arcade_settings.default_buy_in_chips;

    let outcomes = settle_round(SettleRoundInput {
        verdict: subject.verdict,
        bets: &bets,
        rationales: &rationales,
        participants: &participants,
        settings: &fof_settings,
    });

    let wallet = DdbArcadeWallet::new(cli.clone());
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let mut breakdowns: Vec<SettlementBreakdown> = Vec::with_capacity(outcomes.len());

    for o in outcomes.iter() {
        // Per-user settlement row. `insert_new` errors on the UNIQUE
        // idempotency_key if a row already exists — we treat that as
        // "this user already settled, skip the wallet + stats steps to
        // avoid double credit".
        let row = FactFoldSettlement {
            id: uuid::Uuid::now_v7(),
            round_id: round_id.to_string(),
            user_id: o.user_id.clone(),
            created_at: now,
            updated_at: now,
            user_pk: Partition::User(o.user_id.clone()).to_string(),
            idempotency_key: FactFoldSettlement::idempotency_key_for(round_id, &o.user_id),
            base_refund: o.base_refund,
            correct_bonus: o.correct_bonus,
            pool_share: o.pool_share,
            influence_bonus: o.influence_bonus,
            insider_bonus: o.insider_bonus,
            chips_out: o.chips_out,
        };
        let inserted = row.insert_new().await.is_ok();
        breakdowns.push(SettlementBreakdown::from(o));

        if !inserted {
            // Settlement row already existed — skip wallet + stats.
            // Either a previous run for this user succeeded (so we
            // don't double credit) or a concurrent run is in
            // progress (the other run is the source of truth).
            continue;
        }

        // Credit chips back to the wallet.
        if let Err(e) = wallet.settle(&o.user_id, round_id, o.chips_out).await {
            crate::error!(
                "settle_round_internal wallet.settle failed for {}: {e}",
                o.user_id
            );
        }

        // Update lifetime stats. Also clear `current_round_id` —
        // the user is no longer in-flight, so lobby/join should let
        // them queue for the next subject.
        let mut stats = FactFoldUserStats::get_or_default(&o.user_id).await?;
        stats.total_rounds += 1;
        if o.won {
            stats.correct_count += 1;
        }
        stats.lifetime_delta_chips += o.chips_out - buy_in;
        stats.last_played_at = now;
        stats.current_round_id = None;
        stats.updated_at = now;
        if let Err(e) = stats.save().await {
            crate::error!(
                "settle_round_internal user_stats upsert failed for {}: {e}",
                o.user_id
            );
        }

        // Write the dedup marker so the next `lobby/join` for this
        // user against the same subject rejects with
        // `SubjectAlreadyPlayed`. The marker is keyed by subject id
        // so the user can still pick up a fresh subject when the
        // window rotates.
        let play = FactFoldSubjectPlay::new(&o.user_id, &round.subject_id, round_id);
        if let Err(e) = play.insert_new().await {
            crate::error!(
                "settle_round_internal subject_play marker write failed for {}: {e}",
                o.user_id
            );
        }

        // Mirror to the leaderboard: one row per user keyed on
        // `user_id`. `accuracy_bps` is a plain column now, so the old
        // delete-old-sk / write-new-sk dance collapses into a single
        // in-place `save` (upsert_on user_id). A `accuracy_bps DESC`
        // query still returns top-accuracy users first.
        let new_accuracy_bps = compute_accuracy_bps(stats.correct_count, stats.total_rounds);
        let entry = FactFoldLeaderboardEntry {
            id: uuid::Uuid::now_v7(),
            user_id: o.user_id.clone(),
            created_at: stats.created_at,
            updated_at: now,
            user_pk: Partition::User(o.user_id.clone()).to_string(),
            accuracy_bps: new_accuracy_bps,
            total_rounds: stats.total_rounds,
            correct_count: stats.correct_count,
            lifetime_delta_chips: stats.lifetime_delta_chips,
            last_played_at: now,
        };
        if let Err(e) = entry.save().await {
            crate::error!(
                "settle_round_internal leaderboard upsert failed for {}: {e}",
                o.user_id
            );
        }
    }

    // Flip the round terminal state. Even if some per-user steps
    // failed, the round is settled — the audit trail lives on the
    // settlement rows that exist (or didn't).
    round.status = RoundStatus::Settled;
    round.settled_at = Some(now);
    round.updated_at = now;
    round.save().await.map_err(|e| {
        crate::error!("settle_round_internal round upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(SettleRoundResponse {
        round_id: round_id.to_string(),
        outcomes: breakdowns,
    })
}

/// `correct_count / total_rounds`, in basis points. A 0-round
/// player is treated as 0% accuracy for ranking purposes.
#[cfg(feature = "server")]
pub fn compute_accuracy_bps(correct: i64, total: i64) -> i32 {
    if total <= 0 {
        return 0;
    }
    let bps = (correct * 10_000) / total;
    bps.clamp(0, 10_000) as i32
}

#[cfg(feature = "server")]
async fn load_existing_breakdowns(round_id: &str) -> Result<Vec<SettlementBreakdown>> {
    let rows = FactFoldSettlement::list_by_round(round_id)
        .await
        .map_err(|e| {
            crate::error!("load_existing_breakdowns query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;
    Ok(rows
        .into_iter()
        .map(|r| {
            // The persisted row carries the same shape as the live
            // outcome; we just project it.
            let won = r.base_refund > 0;
            SettlementBreakdown {
                user_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(&r.user_pk),
                stake: 0, // not persisted on the settlement row
                won,
                base_refund: r.base_refund,
                correct_bonus: r.correct_bonus,
                pool_share: r.pool_share,
                influence_bonus: r.influence_bonus,
                insider_bonus: r.insider_bonus,
                chips_out: r.chips_out,
            }
        })
        .collect())
}

// ── Admin endpoint ──────────────────────────────────────────────────

#[post(
    "/api/fact-or-fold/admin/rounds/{round_id}/settle",
    _user: AdminUser
)]
pub async fn admin_settle_round_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<SettleRoundResponse> {
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();
    settle_round_internal(cli, &round_id.0).await
}
