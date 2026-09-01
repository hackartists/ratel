//! Player-side round read endpoints — the data feed that powers the
//! game-room views. Five GETs share one rule:
//!
//!   1. Caller must be a participant in the round.
//!   2. The round is `load_round_advanced_or_404`-ratchetted on every
//!      call (same lazy-advance gate as `round_play.rs`) so a stale
//!      client always observes the correct stage.
//!   3. Stage-sensitive fields are redacted until the round reaches
//!      the stage where the operator chose to surface them.
//!
//! Surface:
//!   GET /api/fact-or-fold/rounds/{round_id}/subject       — public subject
//!   GET /api/fact-or-fold/rounds/{round_id}/bets           — bet roster (gated)
//!   GET /api/fact-or-fold/rounds/{round_id}/rationale      — rationales (gated)
//!   GET /api/fact-or-fold/rounds/{round_id}/participants   — participants + display meta
//!   GET /api/fact-or-fold/rounds/{round_id}/settlement     — final breakdown (settled-only)

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::controllers::settlement::SettleRoundResponse;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
use crate::common::models::auth::User;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::controllers::settlement::settle_round_internal;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{
    FactFoldBet, FactFoldSubject, FactFoldParticipant, FactFoldRationale, FactFoldRound,
    FactFoldSettings,
};
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::services::stage_machine;
#[cfg(feature = "server")]
use std::str::FromStr;

// ── Shared helpers ────────────────────────────────────────────────

#[cfg(feature = "server")]
async fn load_round_advanced_or_404(round_id: &str) -> Result<FactFoldRound> {
    let round = FactFoldRound::get_by_round_id(round_id)
        .await
        .map_err(|e| {
            crate::error!("round_read load_round failed: {e}");
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

/// Bet/Rationale lists are public to the table only once the
/// `Reveal` stage opens — before then players see their own row
/// only.
#[cfg(feature = "server")]
fn full_reveal_unlocked(status: RoundStatus) -> bool {
    matches!(
        status,
        RoundStatus::Reveal
            | RoundStatus::Debate
            | RoundStatus::Settlement
            | RoundStatus::Settled
    )
}

// ── GET /api/fact-or-fold/rounds/{round_id}/subject ──────────────

#[get("/api/fact-or-fold/rounds/{round_id}/subject", user: User)]
pub async fn get_round_subject_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<RoundSubjectResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let subject = FactFoldSubject::get_by_subject_id(&round.subject_id)
        .await
        .map_err(|e| {
            crate::error!("get_round_subject_handler read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    let settled = matches!(round.status, RoundStatus::Settled);
    Ok(RoundSubjectResponse {
        id: FactFoldSubjectEntityType(round.subject_id.clone()),
        headline_text: subject.headline_text,
        body_excerpt: subject.body_excerpt,
        source_label: subject.source_label,
        category_tags: subject.category_tags.0,
        difficulty: subject.difficulty,
        verdict: if settled { Some(subject.verdict) } else { None },
        reveal_summary: if settled { subject.reveal_summary } else { String::new() },
        reveal_sources: if settled {
            subject.reveal_sources.0
        } else {
            Vec::new()
        },
    })
}

// ── GET /api/fact-or-fold/rounds/{round_id}/bets ──────────────────

#[get("/api/fact-or-fold/rounds/{round_id}/bets", user: User)]
pub async fn list_round_bets_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<ListBetsResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let rows = FactFoldBet::list_by_round(&inner_round_id).await.map_err(|e| {
        crate::error!("list_round_bets_handler query failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    let user_pk_str = user.pk().to_string();
    let unlocked = full_reveal_unlocked(round.status);
    let items: Vec<BetResponse> = rows
        .into_iter()
        .filter(|r| unlocked || r.user_pk == user_pk_str)
        .map(|r| BetResponse::from(&r))
        .collect();

    Ok(ListBetsResponse { items })
}

// ── GET /api/fact-or-fold/rounds/{round_id}/rationale ─────────────

#[get("/api/fact-or-fold/rounds/{round_id}/rationale", user: User)]
pub async fn list_round_rationales_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<ListRationalesResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let rows = FactFoldRationale::list_by_round(&inner_round_id)
        .await
        .map_err(|e| {
            crate::error!("list_round_rationales_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let user_pk_str = user.pk().to_string();
    let unlocked = full_reveal_unlocked(round.status);
    let items: Vec<RationaleResponse> = rows
        .into_iter()
        .map(|r| {
            let is_self = r.user_pk == user_pk_str;
            let text = if unlocked || is_self {
                r.text
            } else {
                // Row stays so the UI can render the "submitted" pulse,
                // but the actual rationale text is redacted.
                String::new()
            };
            RationaleResponse {
                user_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(&r.user_pk),
                text,
                submitted_at: r.submitted_at,
                essence_eligible: r.essence_eligible,
                essence_registered: r.essence_registered,
            }
        })
        .collect();

    Ok(ListRationalesResponse { items })
}

// ── GET /api/fact-or-fold/rounds/{round_id}/participants ──────────

#[get("/api/fact-or-fold/rounds/{round_id}/participants", user: User)]
pub async fn list_round_participants_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<ListParticipantsResponse> {
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    let rows = FactFoldParticipant::list_by_round(&inner_round_id)
        .await
        .map_err(|e| {
            crate::error!("list_round_participants_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    // Resolve display metadata per participant via a single
    // `WHERE id IN (...)` query so the request is one round-trip
    // regardless of round size (replaces the DynamoDB BatchGetItem).
    // Missing rows fall back to empty defaults.
    let user_ids: Vec<uuid::Uuid> = rows
        .iter()
        .filter_map(|p| Partition::from_str(&p.user_pk).ok())
        .filter_map(|pk| User::id_from_partition(&pk))
        .collect();
    let user_rows = if user_ids.is_empty() {
        Vec::new()
    } else {
        use postgres::PostgresEntity;
        use postgres::col::UuidCol;
        User::repository()
            .find(User::query().filter(|c| c.id.in_(user_ids)))
            .await
            .map_err(|e| {
                crate::error!("list_round_participants_handler user batch load failed: {e}");
                FactOrFoldError::StorageFailure
            })?
            .items
    };
    // Keyed on the rendered USER#{id} string — matches `p.user_pk`.
    let user_by_pk: std::collections::HashMap<String, User> = user_rows
        .into_iter()
        .map(|u| (u.pk().to_string(), u))
        .collect();

    let user_pk_str = user.pk().to_string();
    let items: Vec<RoundParticipantSummary> = rows
        .into_iter()
        .map(|p| {
            let (username, display_name, profile_url) = user_by_pk
                .get(&p.user_pk)
                .map(|u| (u.username.clone(), u.display_name.clone(), u.profile_url.clone()))
                .unwrap_or_default();
            let is_self = p.user_pk == user_pk_str;
            RoundParticipantSummary {
                user_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(&p.user_pk),
                username,
                display_name,
                profile_url,
                joined_at: p.joined_at,
                last_seen_at: p.last_seen_at,
                forfeited: p.forfeited,
                // Only echo the insider flag on the caller's own row —
                // protects the insider identity per design doc §Insider.
                is_insider: is_self && p.is_insider,
            }
        })
        .collect();

    Ok(ListParticipantsResponse { items })
}

// ── GET /api/fact-or-fold/rounds/{round_id}/settlement ────────────

#[get("/api/fact-or-fold/rounds/{round_id}/settlement", user: User)]
pub async fn get_round_settlement_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<SettleRoundResponse> {
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();
    let inner_round_id = round_id.0.clone();

    let round = load_round_advanced_or_404(&inner_round_id).await?;
    ensure_participant(&round, &user.pk())?;

    if !matches!(round.status, RoundStatus::Settled) {
        return Err(FactOrFoldError::RoundNotSettled.into());
    }

    // settle_round_internal is idempotent: on an already-Settled round
    // it short-circuits and re-loads the persisted breakdowns. That's
    // exactly the read path we want — single source of truth for the
    // SettleRoundResponse shape.
    settle_round_internal(cli, &inner_round_id).await
}
