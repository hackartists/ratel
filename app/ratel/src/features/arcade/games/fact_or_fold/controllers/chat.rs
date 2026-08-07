//! Chat endpoints (PR4f).
//!
//! Surface:
//!   POST  /api/arcade/games/fact-or-fold/rounds/{round_id}/chat
//!   GET   /api/arcade/games/fact-or-fold/rounds/{round_id}/chat?since=...
//!
//! v1 only allows *posting* during the live debate stage (`Debate`).
//! Reads (the polling endpoint) are open to participants in any
//! stage so a freshly-joined client can render any backlog.
//!
//! ### v1 realtime — polling
//!
//! Per design doc § A2' (re-decision): chat in v1 uses HTTP short
//! polling, not SSE. The PR4e SSE infra + PR4f stream-listener
//! fan-out are kept in place but only fully come alive once the
//! Lambda binary supports streaming responses (v2 alongside the
//! WebSocket switch). Until then the client polls
//! `GET .../chat?since=<last_msg_id>` every 2~3s alongside the
//! round-state poll.

use crate::common::*;
use crate::features::arcade::games::fact_or_fold::types::*;

#[cfg(feature = "server")]
use crate::common::models::auth::User;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::models::{FactFoldChatMessage, FactFoldRound};
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::realtime::chat_payload_from;
#[cfg(feature = "server")]
use crate::features::arcade::games::fact_or_fold::services::stage_machine;

#[post("/api/arcade/games/fact-or-fold/rounds/{round_id}/chat", user: User)]
pub async fn post_chat_handler(
    round_id: FactFoldRoundEntityType,
    req: PostChatRequest,
) -> Result<PostChatResponse> {
    let inner_round_id = round_id.0.clone();

    let round = FactFoldRound::get_by_round_id(&inner_round_id)
        .await
        .map_err(|e| {
            crate::error!("post_chat_handler round read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    // Lazy advance so a stale client doesn't sneak chat past a
    // deadline that already passed.
    let settings = crate::features::arcade::games::fact_or_fold::models::FactFoldSettings::get_or_default()
        .await
        .unwrap_or_default();
    let now = crate::common::utils::time::get_now_timestamp_millis();
    let round = stage_machine::advance_round_if_due(round, &settings, now).await?;

    if !matches!(round.status, RoundStatus::Debate) {
        // Chat is only open during the live-debate stage. For PR4
        // (Debate not yet wired) this gate effectively blocks chat
        // until PR5 lands. The endpoint still exists so the SSE
        // subscribe flow can be exercised end-to-end against a
        // round that's been manually backdated into Debate.
        return Err(FactOrFoldError::RationaleStageMismatch.into());
    }

    let user_pk_str = user.pk().to_string();
    if !round.participant_pks.iter().any(|p| p == &user_pk_str) {
        return Err(FactOrFoldError::NotRoundParticipant.into());
    }

    // Validate text shape.
    let len = req.text.chars().count();
    if len == 0 || len > CHAT_TEXT_MAX_CHARS {
        return Err(FactOrFoldError::RationaleInvalid.into());
    }

    // DB write. The stream / event fan-out takes care of the SSE push.
    let row = FactFoldChatMessage::new(&inner_round_id, user.pk().clone(), req.text);
    row.insert_new().await.map_err(|e| {
        crate::error!("post_chat_handler create failed: {e}");
        FactOrFoldError::StorageFailure
    })?;
    // Phase 5: emit so the outbox poller dispatches "FactFoldChat"
    // (handle_fact_fold_chat_inserted) — drives the SSE chat fan-out.
    crate::common::events::outbox::EventOutbox::emit_insert(
        crate::common::events::outbox::topic::FACT_FOLD_CHAT,
        &row,
    )
    .await
    .ok();

    Ok(PostChatResponse {
        msg_id: row.msg_id.clone(),
        author_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(
            &row.author_pk,
        ),
        text: row.text,
        sent_at: row.sent_at,
    })
}

// ── GET /api/arcade/games/fact-or-fold/rounds/{round_id}/chat ────
//
// v1 short-polling endpoint. Returns the chat transcript for a
// round, optionally filtered to messages newer than `since`
// (an opaque message id from the last response — same shape as
// `PostChatResponse.msg_id`).
//
// Only round participants can read. No stage gate on reads — a
// participant should be able to render backlog regardless of which
// stage the round is in.

#[get(
    "/api/arcade/games/fact-or-fold/rounds/{round_id}/chat?since",
    user: User
)]
pub async fn list_chat_handler(
    round_id: FactFoldRoundEntityType,
    since: Option<String>,
) -> Result<ListChatResponse> {
    let inner_round_id = round_id.0.clone();

    let round = FactFoldRound::get_by_round_id(&inner_round_id)
        .await
        .map_err(|e| {
            crate::error!("list_chat_handler round read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    let user_pk_str = user.pk().to_string();
    if !round.participant_pks.iter().any(|p| p == &user_pk_str) {
        return Err(FactOrFoldError::NotRoundParticipant.into());
    }

    // Newest-first transcript (matches the DynamoEntity query DESC
    // default). v1 single-page fetch — round transcripts are bounded
    // (~4 players × 70s × 80 chars).
    let rows = FactFoldChatMessage::list_by_round(&inner_round_id, CHAT_PAGE_LIMIT as i64)
        .await
        .map_err(|e| {
            crate::error!("list_chat_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let items: Vec<ChatMessagePayload> = match since {
        Some(after) if !after.is_empty() => rows
            .into_iter()
            .skip_while(|r| r.msg_id <= after)
            .map(chat_payload_from)
            .collect(),
        _ => rows.into_iter().map(chat_payload_from).collect(),
    };

    let last_id = items.last().map(|m| m.msg_id.clone());
    Ok(ListChatResponse { items, last_id })
}

// ── DELETE /api/arcade/games/fact-or-fold/rounds/{round_id}/chat ──
//
// Bulk-delete the full chat transcript for a round. Today this is
// called by the settlement-screen "정산완료 → 홈으로" button after
// the player has reviewed the breakdown. Guarded by:
//   - caller is a participant of the round
//   - round is Settled (no live messages get nuked)
//
// Permanent transcript retention is documented as a roadmap §FR-11
// goal; we ship this temporary cleanup until the long-term policy
// (TTL? summarize-then-delete?) lands. Idempotent: a second call by
// another participant after the rows are gone returns OK with 0.

#[delete("/api/arcade/games/fact-or-fold/rounds/{round_id}/chat", user: User)]
pub async fn delete_round_chat_handler(
    round_id: FactFoldRoundEntityType,
) -> Result<DeleteRoundChatResponse> {
    let inner_round_id = round_id.0.clone();

    let round = FactFoldRound::get_by_round_id(&inner_round_id)
        .await
        .map_err(|e| {
            crate::error!("delete_round_chat_handler round read failed: {e}");
            FactOrFoldError::StorageFailure
        })?
        .ok_or(FactOrFoldError::RoundNotFound)?;

    let user_pk_str = user.pk().to_string();
    if !round.participant_pks.iter().any(|p| p == &user_pk_str) {
        return Err(FactOrFoldError::NotRoundParticipant.into());
    }

    if !matches!(round.status, RoundStatus::Settled) {
        return Err(FactOrFoldError::RoundNotSettled.into());
    }

    // Enumerate the transcript, then delete each row individually. v1
    // transcripts are bounded so the simple per-row delete keeps the
    // code obvious — revisit when the transcript bound is lifted.
    let rows = FactFoldChatMessage::list_by_round(&inner_round_id, CHAT_PAGE_LIMIT as i64)
        .await
        .map_err(|e| {
            crate::error!("delete_round_chat_handler query failed: {e}");
            FactOrFoldError::StorageFailure
        })?;

    let mut deleted = 0i64;
    for row in rows.iter() {
        if let Err(e) = FactFoldChatMessage::delete_row(row.id).await {
            crate::error!("delete_round_chat_handler row delete failed: {e}");
            continue;
        }
        deleted += 1;
    }

    Ok(DeleteRoundChatResponse { deleted })
}
