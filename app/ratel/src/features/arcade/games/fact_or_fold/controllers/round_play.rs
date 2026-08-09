//! Round-play endpoints.
//!
//! Surface:
//!   POST  /api/fact-or-fold/rounds/{round_id}/bets
//!   POST  /api/fact-or-fold/rounds/{round_id}/rationale
//!   GET   /api/fact-or-fold/rounds/{round_id}/insider-statement
//!   POST  /api/fact-or-fold/rounds/{round_id}/heartbeat
//!   POST  /api/fact-or-fold/rounds/{round_id}/tick    ← PR4d (client trigger)
//!
//! All endpoints validate (a) the caller is a round participant and
//! (b) the round is in the right stage. Insider statement is gated
//! by `FactFoldParticipant.is_insider` per design doc § Insider
//! protection — the response always wraps `Option<String>` so the
//! "not insider" branch is a normal Some/None, not a 403.
//!
//! `/tick` is the explicit client-driven stage advance signal
//! (design doc § A6). All other endpoints also lazily advance via
//! [`load_round_advanced_or_404`] so a stale client still sees the
//! correct stage.

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
use crate::common::models::auth::User;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{
    FactFoldBet, FactFoldSubject, FactFoldParticipant, FactFoldRationale, FactFoldRound,
    FactFoldSettings,
};
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::services::stage_machine;

// ── Helpers ───────────────────────────────────────────────────────

/// Load the round and ratchet it forward through any stages whose
/// deadline has already passed (§FR-9). All round-play endpoints
/// route through this helper so a request that races a stage
/// deadline still sees the correct stage rather than a stale one.
#[cfg(feature = "server")]
async fn load_round_advanced_or_404(round_id: &str) -> Result<FactFoldRound> {
    let round = FactFoldRound::get_by_round_id(round_id)
        .await
        .map_err(|e| {
            crate::error!("round_play load_round failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;
    let settings = FactFoldSettings::get_or_default().await.unwrap_or_default();
    let now = crate::common::utils::time::get_now_timestamp_millis();
    stage_machine::advance_round_if_due(round, &settings, now).await
}

#[cfg(feature = "server")]
fn ensure_participant(round: &FactFoldRound, user_pk: &Partition) -> Result<()> {
    let user_pk_str = user_pk.to_string();
    if !round.participant_pks.iter().any(|p| p == &user_pk_str) {
        return Err(FactOrFoldError::NotRoundParticipant.into());
    }
    Ok(())
}

#[cfg(feature = "server")]
async fn load_participant(round_id: &str, user_pk: &Partition) -> Result<FactFoldParticipant> {
    let user_id = UserPartition::from(user_pk.clone()).0;
    FactFoldParticipant::get_by_round_user(round_id, &user_id)
        .await
        .map_err(|e| {
            crate::error!("load_participant failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or_else(|| FactOrFoldError::NotRoundParticipant.into())
}

// ── POST /api/fact-or-fold/rounds/{round_id}/bets/flip ───────────
//
// §FR-16/17/18 — last-10s bet-change slot.
//
// Gates:
//   - Stage must be `Debate`.
//   - Time-remaining (`stage_deadline_at - now`) must be ≤ 10_000 ms.
//   - Caller must be a round participant.
//   - Caller must already have a 1st bet (otherwise nothing to flip).
//   - Caller must NOT have flipped yet this round.
//   - Flip side must differ from the current side.
//   - `cite_user_pk` must be another round participant who has
//     submitted a `FactFoldRationale` row.

#[post("/api/fact-or-fold/rounds/{round_id}/bets/flip", user: User)]
pub async fn flip_bet_handler(
    round_id: FactFoldRoundEntityType,
    req: FlipBetRequest,
) -> Result<FlipBetResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    if !matches!(round.status, RoundStatus::Debate) {
        return Err(FactOrFoldError::FlipSlotClosed.into());
    }
    ensure_participant(&round, &user.pk())?;

    // Time-window gate. `stage_deadline_at` is set on every advance;
    // missing means the round is in a stage without a clock (lobby
    // / settlement / settled) — flip is closed.
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let deadline = round
        .stage_deadline_at
        .ok_or(FactOrFoldError::FlipSlotClosed)?;
    let remaining = deadline - now;
    if !(0..=FLIP_SLOT_LAST_MS).contains(&remaining) {
        return Err(FactOrFoldError::FlipSlotClosed.into());
    }

    // Citation must point at another round participant.
    let cite_user_id = req.cite_user_pk.0.trim().to_string();
    if cite_user_id.is_empty() {
        return Err(FactOrFoldError::FlipInvalidCite.into());
    }
    let cite_partition: Partition = Partition::User(cite_user_id.clone());
    if cite_partition == user.pk() {
        return Err(FactOrFoldError::FlipInvalidCite.into());
    }
    let cite_partition_str = cite_partition.to_string();
    if !round.participant_pks.iter().any(|p| p == &cite_partition_str) {
        return Err(FactOrFoldError::FlipInvalidCite.into());
    }

    // Cited participant must have submitted a rationale (§FR-17).
    let cite_rationale =
        FactFoldRationale::get_by_round_user(&inner_round_id, &cite_user_id)
            .await
            .map_err(|e| {
                crate::error!("flip_bet_handler rationale read failed: {e}");
                FactOrFoldError::StorageFailure
            })?;
    if cite_rationale.is_none() {
        return Err(FactOrFoldError::FlipCiteNoRationale.into());
    }

    // Caller's existing bet row.
    let user_id = UserPartition::from(user.pk().clone()).0;
    let mut bet = FactFoldBet::get_by_round_user(&inner_round_id, &user_id)
        .await
        .map_err(|e| {
            crate::error!("flip_bet_handler bet read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::FlipNoOriginalBet)?;
    if bet.flipped_to.is_some() {
        return Err(FactOrFoldError::FlipAlreadyUsed.into());
    }
    if bet.side == req.side {
        return Err(FactOrFoldError::FlipSameSide.into());
    }

    let original_side = bet.side;
    bet.flipped_to = Some(req.side);
    bet.flip_cite_user_pk = Some(cite_partition_str);
    bet.updated_at = now;
    bet.save().await.map_err(|e| {
        crate::error!("flip_bet_handler upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(FlipBetResponse {
        user_pk: UserPartition::from(user.pk().clone()),
        original_side,
        flipped_to: req.side,
        cite_user_pk: UserPartition(cite_user_id),
        amount_rp: bet.amount_rp,
    })
}

// ── POST /api/fact-or-fold/rounds/{round_id}/bets ────────────────

#[post("/api/fact-or-fold/rounds/{round_id}/bets", user: User)]
pub async fn place_bet_handler(
    round_id: FactFoldRoundEntityType,
    req: PlaceBetRequest,
) -> Result<BetResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    if !matches!(round.status, RoundStatus::Bet) {
        return Err(FactOrFoldError::BetStageMismatch.into());
    }
    ensure_participant(&round, &user.pk())?;

    let settings = FactFoldSettings::get_or_default().await.unwrap_or_default();
    if req.amount_rp < settings.min_bet_rp || req.amount_rp > settings.max_bet_rp {
        return Err(FactOrFoldError::BetAmountOutOfRange.into());
    }

    let row = FactFoldBet::new(&inner_round_id, user.pk().clone(), req.side, req.amount_rp);
    row.save().await.map_err(|e| {
        crate::error!("place_bet_handler upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(BetResponse::from(&row))
}

// ── POST /api/fact-or-fold/rounds/{round_id}/rationale ───────────

#[post("/api/fact-or-fold/rounds/{round_id}/rationale", user: User)]
pub async fn submit_rationale_handler(
    round_id: FactFoldRoundEntityType,
    req: SubmitRationaleRequest,
) -> Result<RationaleResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    if !matches!(round.status, RoundStatus::Rationale) {
        return Err(FactOrFoldError::RationaleStageMismatch.into());
    }
    ensure_participant(&round, &user.pk())?;

    let len = req.text.chars().count();
    if len == 0 || len > RATIONALE_TEXT_MAX_CHARS {
        return Err(FactOrFoldError::RationaleInvalid.into());
    }
    let essence_eligible = len >= RATIONALE_ESSENCE_MIN_CHARS;

    let row = FactFoldRationale::new(&inner_round_id, user.pk().clone(), req.text, essence_eligible);
    row.save().await.map_err(|e| {
        crate::error!("submit_rationale_handler upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(RationaleResponse {
        user_pk: UserPartition::from(user.pk().clone()),
        text: row.text,
        submitted_at: row.submitted_at,
        essence_eligible: row.essence_eligible,
        essence_registered: row.essence_registered,
    })
}

// ── GET /api/fact-or-fold/rounds/{round_id}/insider-statement ────

#[get("/api/fact-or-fold/rounds/{round_id}/insider-statement", user: User)]
pub async fn get_insider_statement_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<InsiderStatementResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let participant = load_participant(&inner_round_id, &user.pk()).await?;
    if !participant.is_insider {
        // Not the insider — return empty Option rather than 403 so
        // the UI can call this for everyone and just hide the panel
        // when statement is None.
        return Ok(InsiderStatementResponse { statement: None });
    }

    let subject = FactFoldSubject::get_by_subject_id(&round.subject_id)
        .await
        .map_err(|e| {
            crate::error!("get_insider_statement_handler subject read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    Ok(InsiderStatementResponse {
        statement: Some(subject.insider_statement),
    })
}

// ── POST /api/fact-or-fold/rounds/{round_id}/heartbeat ───────────

#[post("/api/fact-or-fold/rounds/{round_id}/heartbeat", user: User)]
pub async fn heartbeat_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<ParticipantResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let user_id = UserPartition::from(user.pk().clone()).0;
    let mut participant = FactFoldParticipant::get_by_round_user(&inner_round_id, &user_id)
        .await
        .map_err(|e| {
            crate::error!("heartbeat_handler load failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::NotRoundParticipant)?;

    let now = crate::common::utils::time::get_now_timestamp_millis();
    participant.last_seen_at = now;
    participant.updated_at = now;
    participant.save().await.map_err(|e| {
        crate::error!("heartbeat_handler upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    Ok(ParticipantResponse {
        user_pk: UserPartition::from(user.pk().clone()),
        joined_at: participant.joined_at,
        // Heartbeat returns the *caller's own* row, so is_insider is
        // safe to surface unredacted.
        is_insider: participant.is_insider,
        last_seen_at: participant.last_seen_at,
        forfeited: participant.forfeited,
    })
}

// ── POST /api/fact-or-fold/rounds/{round_id}/tick ────────────────
//
// Client-driven stage advance signal (design doc § A6). The client
// posts this when its countdown for the current stage hits zero;
// the server (a) re-checks the wall-clock against
// `stage_deadline_at`, (b) ratchets through any elapsed stages, and
// (c) returns the resulting `RoundResponse`. PR4f wires the SSE
// broadcast that fires on a successful advance.
//
// Idempotent: a tick that arrives before the deadline is a no-op.
// A tick that arrives while another tick is in flight will see the
// already-advanced state (lazy advance in
// `load_round_advanced_or_404` covers it).

#[post("/api/fact-or-fold/rounds/{round_id}/tick", user: User)]
pub async fn tick_handler(round_id: FactFoldRoundEntityType) -> Result<RoundResponse> {
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    // PR6: if this tick lands at or past the Debate deadline, drive
    // settlement directly. A follow-up infra PR will add a scheduler /
    // EventBridge trigger as the primary path; until then this
    // tick-side call drives settlement in-process. `settle_round_internal`
    // is idempotent, so two clients ticking at once is safe.
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let debate_done = matches!(round.status, RoundStatus::Debate)
        && round
            .stage_deadline_at
            .map(|d| now >= d)
            .unwrap_or(false);
    if debate_done {
        let _ = super::settlement::settle_round_internal(cli, &inner_round_id).await;
        // Re-read so the caller sees Settled + settled_at.
        let round = load_round_advanced_or_404(&inner_round_id).await?;
        return Ok(RoundResponse::from(&round));
    }

    Ok(RoundResponse::from(&round))
}
