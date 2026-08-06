//! Lobby + matching endpoints for *Fact or Fold*.
//!
//! Surface (PR3):
//!   GET   /api/fact-or-fold/lobby
//!   POST  /api/fact-or-fold/lobby/join
//!   POST  /api/fact-or-fold/lobby/leave
//!   GET   /api/fact-or-fold/rounds/{round_id}
//!
//! Matching algorithm:
//!   1. Read FactFoldLobby singleton.
//!   2. If no waiting round → create one (pick the next eligible
//!      subject; transition it to Live).
//!   3. Add the user to Round.participant_pks (no-op if already in,
//!      reject if full or below min_bet_rp).
//!   4. If after the join the round is full → flip status to
//!      NewsReveal, set started_at, clear the lobby pointer.
//!
//! Concurrency: single app-shell instance (MVP, per design doc
//! §Realtime channel). Two simultaneous joins racing on the same
//! pointer would be possible in a multi-instance deployment;
//! conditional updates land alongside multi-instance work.

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
use crate::common::models::auth::User;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{
    FactFoldLobby, FactFoldParticipant, FactFoldRound, FactFoldSettings, FactFoldSubject,
    FactFoldSubjectPlay, FactFoldUserStats,
};
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::services::stage_machine;
#[cfg(feature = "server")]
use crate::features::arcade::models::ArcadeSettings;
#[cfg(feature = "server")]
use crate::features::arcade::wallet::{ArcadeWallet, DdbArcadeWallet};
#[cfg(feature = "server")]
use std::str::FromStr;

#[cfg(feature = "server")]
fn user_inner_id(user: &User) -> String {
    UserPartition::from(user.pk().clone()).0
}

// ── Internal helpers ──────────────────────────────────────────────

#[cfg(feature = "server")]
async fn load_settings_or_default() -> FactOrFoldSettingsResponse {
    FactFoldSettings::get_or_default().await.unwrap_or_default()
}

/// True iff `now` is inside the subject's `[pick_at, expires_at]`
/// window. `expires_at == 0` is treated as "no expiry" (legacy rows
/// authored before the time-window model — they fall back to the
/// pre-existing "active until manually retired" behaviour).
#[cfg(feature = "server")]
fn is_subject_active(row: &FactFoldSubject, now: i64) -> bool {
    if row.pick_at > now {
        return false;
    }
    row.expires_at == 0 || row.expires_at > now
}

/// Find the subject whose active window currently covers `now`. By
/// design (operator responsibility) at most one Live/Scheduled
/// subject's window contains any given instant; if multiple match
/// we deterministically pick the one with the latest `pick_at` so
/// later-published "now" subjects win over an already-running one.
///
/// Both `Live` and `Scheduled` partitions are queried because the
/// activation transition is now time-based — a `Scheduled` row whose
/// `pick_at` is in the past is just as active as a `Live` row.
#[cfg(feature = "server")]
async fn pick_next_subject() -> crate::common::Result<Option<FactFoldSubject>> {
    let now = crate::common::utils::time::get_now_timestamp_millis();

    // Both status buckets are queried (oldest `pick_at` first) and the
    // best window match is picked in memory.
    let (live_res, sched_res) = tokio::join!(
        FactFoldSubject::list_by_status(SubjectStatus::Live, 50),
        FactFoldSubject::list_by_status(SubjectStatus::Scheduled, 50),
    );
    let live = live_res.map_err(|e| {
        crate::error!("pick_next_subject live query failed: {e}");
        FactOrFoldError::StorageFailure
    })?;
    let sched = sched_res.map_err(|e| {
        crate::error!("pick_next_subject scheduled query failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    let candidate = live
        .into_iter()
        .chain(sched.into_iter())
        .filter(|row| is_subject_active(row, now))
        .max_by_key(|row| row.pick_at);

    Ok(candidate)
}

#[cfg(feature = "server")]
async fn upsert_lobby_pointer(current_round_id: Option<String>) -> crate::common::Result<()> {
    let mut row = FactFoldLobby::get_or_default().await?;
    let now = crate::common::utils::time::get_now_timestamp_millis();
    row.current_round_id = current_round_id;
    row.updated_at = now;
    if row.created_at == 0 {
        row.created_at = now;
    }
    row.save().await.map_err(|e| {
        crate::error!("upsert_lobby_pointer failed: {e}");
        FactOrFoldError::StorageFailure
    })?;
    Ok(())
}

/// Pick the insider index uniformly at random over `n` participants.
/// Pulled out so future deterministic-test overrides have a single
/// hook to swap.
#[cfg(feature = "server")]
fn pick_insider_index(n: usize) -> usize {
    use rand::RngExt;
    rand::rng().random_range(0..n)
}

/// Stamp the user's stats with the round they're currently in.
/// `None` clears the pointer (settle / leave-while-waiting).
/// Best-effort: an error here is logged but doesn't fail the join —
/// the marker is a safety net against double-rounds, not a correctness
/// gate for the join itself.
#[cfg(feature = "server")]
async fn set_user_active_round(user_id: &str, round_id: Option<String>) {
    let mut stats = match FactFoldUserStats::get_or_default(user_id).await {
        Ok(s) => s,
        Err(e) => {
            crate::error!("set_user_active_round get failed for {user_id}: {e}");
            return;
        }
    };
    let now = crate::common::utils::time::get_now_timestamp_millis();
    stats.current_round_id = round_id;
    stats.updated_at = now;
    if let Err(e) = stats.save().await {
        crate::error!("set_user_active_round upsert failed for {user_id}: {e}");
    }
}

/// Materialize FactFoldParticipant rows for every player in a
/// freshly-started round. Exactly one row is marked is_insider.
#[cfg(feature = "server")]
async fn create_participants_for_round(
    round_id: &str,
    participant_pks: &[String],
) -> crate::common::Result<()> {
    if participant_pks.is_empty() {
        return Ok(());
    }
    let insider_idx = pick_insider_index(participant_pks.len());
    for (idx, user_pk) in participant_pks.iter().enumerate() {
        let partition = Partition::from_str(user_pk).unwrap_or_default();
        let row = FactFoldParticipant::new(round_id, partition, idx == insider_idx);
        row.insert_new().await.map_err(|e| {
            crate::error!("create_participants_for_round failed for {user_pk}: {e}");
            FactOrFoldError::StorageFailure
        })?;
    }
    Ok(())
}

// ── GET /api/fact-or-fold/lobby ───────────────────────────────────

#[get("/api/fact-or-fold/lobby", user: User)]
pub async fn get_lobby_handler() -> Result<LobbyResponse> {
    // Independent reads — kick them off in parallel. `current_round`
    // depends on `lobby.current_round_id` and `already_played_current`
    // depends on the round's subject, so those load sequentially after.
    let user_id_inner = user_inner_id(&user);
    let user_pk_str = user.pk().to_string();
    let settings_fut = async { Ok::<_, crate::common::Error>(load_settings_or_default().await) };
    let lobby_fut = async {
        FactFoldLobby::get_or_default().await.map_err(|e| {
            crate::error!("get_lobby_handler lobby read failed: {e}");
            crate::common::Error::from(FactOrFoldError::StorageFailure)
        })
    };
    let arcade_fut = async {
        Ok::<_, crate::common::Error>(ArcadeSettings::get_or_default().await.unwrap_or_default())
    };
    let pick_fut = async { pick_next_subject().await.map(|s| s.is_some()) };
    let stats_fut = async {
        Ok::<_, crate::common::Error>(
            FactFoldUserStats::get_or_default(&user_id_inner)
                .await
                .unwrap_or_default(),
        )
    };
    let (settings, lobby, arcade_settings, subject_available, user_stats) =
        tokio::try_join!(settings_fut, lobby_fut, arcade_fut, pick_fut, stats_fut)?;

    let mut current_round: Option<RoundResponse> = None;
    let mut already_joined = false;
    let mut active_subject_id: Option<String> = None;

    if let Some(round_id) = lobby.current_round_id.as_deref() {
        if let Some(round) = FactFoldRound::get_by_round_id(round_id).await.map_err(|e| {
            crate::error!("get_lobby_handler round read failed: {e}");
            FactOrFoldError::StorageFailure
        })? {
            already_joined = round.participant_pks.iter().any(|p| p == &user_pk_str);
            active_subject_id = Some(round.subject_id.clone());
            current_round = Some(RoundResponse::from(&round));
        }
    }

    // Block matchmaking for users who are already committed elsewhere:
    //   - in-flight round on any subject  → user_stats.current_round_id
    //   - already settled this subject    → FactFoldSubjectPlay marker
    // Both surface into `can_join` so the UI can disable the button
    // before the user discovers the error mid-flow.
    let has_in_flight_round = user_stats.current_round_id.is_some();
    let already_played_current = match active_subject_id.as_deref() {
        Some(sid) => FactFoldSubjectPlay::exists(&user_id_inner, sid).await?,
        None => false,
    };

    let can_join = match &current_round {
        Some(r) => {
            !already_joined
                && !already_played_current
                && !has_in_flight_round
                && (r.participant_pks.len() as i32) < settings.round_capacity
                && matches!(r.status, RoundStatus::Waiting)
        }
        None => subject_available && !has_in_flight_round,
    };

    Ok(LobbyResponse {
        current_round,
        can_join,
        already_joined,
        round_capacity: settings.round_capacity,
        min_bet_rp: settings.min_bet_rp,
        buy_in_chips: arcade_settings.default_buy_in_chips,
        subject_available,
    })
}

// ── POST /api/fact-or-fold/lobby/join ─────────────────────────────

#[post("/api/fact-or-fold/lobby/join", user: User)]
pub async fn join_lobby_handler() -> Result<RoundResponse> {
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let wallet = DdbArcadeWallet::new(cli.clone());
    let user_id = user_inner_id(&user);

    // Settings, lobby, wallet balance and arcade settings are all
    // independent reads — fan them out in parallel before applying
    // the chip-balance gate.
    let settings_fut = async { Ok::<_, crate::common::Error>(load_settings_or_default().await) };
    let arcade_fut = async {
        Ok::<_, crate::common::Error>(ArcadeSettings::get_or_default().await.unwrap_or_default())
    };
    let balance_fut = async { wallet.balance(&user_id).await };
    let lobby_fut = async {
        FactFoldLobby::get_or_default().await.map_err(|e| {
            crate::error!("join_lobby_handler lobby read failed: {e}");
            crate::common::Error::from(FactOrFoldError::StorageFailure)
        })
    };
    let stats_fut = async {
        Ok::<_, crate::common::Error>(
            FactFoldUserStats::get_or_default(&user_id)
                .await
                .unwrap_or_default(),
        )
    };
    let (settings, arcade_settings, chip_balance, mut lobby, user_stats) =
        tokio::try_join!(settings_fut, arcade_fut, balance_fut, lobby_fut, stats_fut)?;

    let buy_in_chips = arcade_settings.default_buy_in_chips;
    if chip_balance < buy_in_chips {
        return Err(crate::features::arcade::ArcadeError::WalletInsufficientChip.into());
    }

    // Block users who already hold an in-flight round — independent
    // of which subject the lobby would pick next. Covers both the
    // "same subject" and "windowed-out mid-round" edge cases that the
    // post-settlement marker alone can't see.
    if user_stats.current_round_id.is_some() {
        return Err(FactOrFoldError::RoundInProgress.into());
    }

    let user_pk_str = user.pk().to_string();

    // Try to attach to an existing waiting round.
    if let Some(round_id) = lobby.current_round_id.clone() {
        let round = FactFoldRound::get_by_round_id(&round_id)
            .await
            .map_err(|e| {
                crate::error!("join_lobby_handler round read failed: {e}");
                FactOrFoldError::StorageFailure
            })?;
        if let Some(mut round) = round {
            if !matches!(round.status, RoundStatus::Waiting) {
                // Pointer is stale (e.g. round already started). Drop
                // the pointer so the next branch creates a new one.
                lobby.current_round_id = None;
            } else {
                if round.participant_pks.iter().any(|p| p == &user_pk_str) {
                    return Err(FactOrFoldError::LobbyAlreadyJoined.into());
                }
                if (round.participant_pks.len() as i32) >= settings.round_capacity {
                    return Err(FactOrFoldError::LobbyFull.into());
                }
                // §"1 game per active subject" — if the user already
                // finished a round for this subject (marker written at
                // settlement), reject. Mid-flight rejection is handled
                // by the user_stats.current_round_id gate above.
                if FactFoldSubjectPlay::exists(&user_id, &round.subject_id).await? {
                    return Err(FactOrFoldError::SubjectAlreadyPlayed.into());
                }
                round.participant_pks.push(user_pk_str.clone());
                let now = crate::common::utils::time::get_now_timestamp_millis();
                let lobby_should_clear =
                    (round.participant_pks.len() as i32) >= settings.round_capacity;
                if lobby_should_clear {
                    round.status = RoundStatus::NewsReveal;
                    round.started_at = Some(now);
                    stage_machine::stamp_initial_stage(&mut round, &settings, now);
                }
                round.updated_at = now;
                round.save().await.map_err(|e| {
                    crate::error!("join_lobby_handler round upsert failed: {e}");
                    FactOrFoldError::StorageFailure
                })?;
                let attached_round_id = round.round_id.clone();
                if lobby_should_clear {
                    create_participants_for_round(&attached_round_id, &round.participant_pks)
                        .await?;
                    upsert_lobby_pointer(None).await?;
                }
                // Lock chips on the table for this round. Anything
                // that happens inside the round is off-wallet until
                // settlement (design doc § A5).
                wallet
                    .buy_in(&user_id, &attached_round_id, buy_in_chips)
                    .await?;
                // Record the in-flight round on the user so a parallel
                // join attempt is rejected with RoundInProgress.
                set_user_active_round(&user_id, Some(attached_round_id.clone())).await;
                return Ok(RoundResponse::from(&round));
            }
        } else {
            // Pointer dangles — drop it.
            lobby.current_round_id = None;
        }
    }

    // No waiting round (or pointer was stale) — create a new one.
    let mut subject = pick_next_subject()
        .await?
        .ok_or(FactOrFoldError::LobbyNoSubjectAvailable)?;
    let subject_id = subject.subject_id.clone();

    // §"1 game per active subject" — block users who already
    // finished a round for this subject. Marker is written by
    // settlement; mid-flight protection sits on user_stats above.
    if FactFoldSubjectPlay::exists(&user_id, &subject_id).await? {
        return Err(FactOrFoldError::SubjectAlreadyPlayed.into());
    }

    // Promote Scheduled → Live so the subject is bound to this
    // round and won't be picked again by a parallel matching call.
    if matches!(subject.status, SubjectStatus::Scheduled) {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        subject.status = SubjectStatus::Live;
        subject.updated_at = now;
        subject.save().await.map_err(|e| {
            crate::error!("join_lobby_handler subject promote failed: {e}");
            FactOrFoldError::StorageFailure
        })?;
    }

    let round_id = uuid::Uuid::now_v7().to_string();
    let mut round = FactFoldRound::new_waiting(round_id.clone(), subject_id, user.pk().clone());

    // Single-user round is full when round_capacity == 1 — flip
    // straight to NewsReveal in that edge case.
    let lobby_should_clear = (round.participant_pks.len() as i32) >= settings.round_capacity;
    if lobby_should_clear {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        round.status = RoundStatus::NewsReveal;
        round.started_at = Some(now);
        stage_machine::stamp_initial_stage(&mut round, &settings, now);
        round.updated_at = now;
    }

    round.insert_new().await.map_err(|e| {
        crate::error!("join_lobby_handler round create failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    if lobby_should_clear {
        create_participants_for_round(&round_id, &round.participant_pks).await?;
    }

    upsert_lobby_pointer(if lobby_should_clear {
        None
    } else {
        Some(round_id.clone())
    })
    .await?;

    // Lock chips on the table for this round.
    wallet.buy_in(&user_id, &round_id, buy_in_chips).await?;

    // Record the in-flight round on the user so subsequent joins
    // are rejected with RoundInProgress. See `set_user_active_round`.
    set_user_active_round(&user_id, Some(round_id.clone())).await;

    Ok(RoundResponse::from(&round))
}

// ── POST /api/fact-or-fold/lobby/leave ────────────────────────────

#[post("/api/fact-or-fold/lobby/leave", user: User)]
pub async fn leave_lobby_handler() -> Result<RoundResponse> {
    let cfg = crate::common::CommonConfig::default();
    let cli = cfg.dynamodb();

    let lobby = FactFoldLobby::get_or_default().await.map_err(|e| {
        crate::error!("leave_lobby_handler lobby read failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    let round_id = lobby
        .current_round_id
        .clone()
        .ok_or(FactOrFoldError::LobbyNotJoined)?;

    let mut round = FactFoldRound::get_by_round_id(&round_id)
        .await
        .map_err(|e| {
            crate::error!("leave_lobby_handler round read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::LobbyNotJoined)?;

    let user_pk_str = user.pk().to_string();
    let before_len = round.participant_pks.len();
    round.participant_pks.retain(|p| p != &user_pk_str);
    if round.participant_pks.len() == before_len {
        return Err(FactOrFoldError::LobbyNotJoined.into());
    }

    round.updated_at = crate::common::utils::time::get_now_timestamp_millis();
    round.save().await.map_err(|e| {
        crate::error!("leave_lobby_handler round upsert failed: {e}");
        FactOrFoldError::StorageFailure
    })?;

    // Refund the buy-in. Leave is only valid while the round is
    // still Waiting, so the player gets every chip back.
    let arcade_settings = ArcadeSettings::get_or_default().await.unwrap_or_default();
    let wallet = DdbArcadeWallet::new(cli.clone());
    let user_id = user_inner_id(&user);
    wallet
        .settle(&user_id, &round_id, arcade_settings.default_buy_in_chips)
        .await?;

    // Free the user's in-flight slot so they can join again. The
    // `FactFoldSubjectPlay` marker isn't written until settlement,
    // so leave-while-waiting doesn't need to clean it up.
    set_user_active_round(&user_id, None).await;

    Ok(RoundResponse::from(&round))
}

// ── GET /api/fact-or-fold/rounds/{round_id} ──────────────────────

#[get("/api/fact-or-fold/rounds/{round_id}", _user: User)]
pub async fn get_round_handler(round_id: FactFoldRoundEntityType) -> Result<RoundResponse> {
    let inner = round_id.0.clone();
    let round = FactFoldRound::get_by_round_id(&inner)
        .await
        .map_err(|e| {
            crate::error!("get_round_handler read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    // Lazy advance: any read of a round ratchets it through any
    // stages whose deadline has already passed. PR4 follow-ups add
    // a scheduled EventBridge trigger as the primary path; this
    // stays as a safety net so a stale client read still observes
    // the correct stage (§FR-9).
    let settings = load_settings_or_default().await;
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let round = stage_machine::advance_round_if_due(round, &settings, now).await?;
    Ok(RoundResponse::from(&round))
}
