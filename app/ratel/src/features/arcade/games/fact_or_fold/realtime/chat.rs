//! `RoomChannel` implementation for FOF chat.
//!
//! Channel kind: `"fof.chat"`. ChannelId form: `fof.chat:{round_id}`.
//!
//! ### Authorize hook
//!
//! Only round participants may subscribe (gated against
//! `FactFoldRound.participant_pks`). Initial state = the latest N
//! chat rows already in the DDB transcript, so the client renders a
//! useful backlog on first connect / reconnect rather than starting
//! empty.
//!
//! ### Fan-out
//!
//! v1 doesn't publish from inside this handler. The
//! `POST /rounds/{id}/chat` controller only writes a
//! `FactFoldChatMessage` row; the DDB Stream listener
//! ([`crate::common::stream_handler`] for local-dev,
//! `EventBridgeEnvelope::proc` for Lambda) detects the new row and
//! calls `global_hub().publish(...)` so every SSE invocation in
//! the cluster fans it out to its own subscribers.

use crate::common::*;
use crate::features::arcade::ArcadeError;
use crate::features::arcade::games::fact_or_fold::models::{FactFoldChatMessage, FactFoldRound};
use crate::features::arcade::games::fact_or_fold::types::ChatMessagePayload;
use crate::features::arcade::realtime::channel::{ChannelContext, ChannelId, RoomChannel};
use async_trait::async_trait;

/// How many recent chat messages to surface on the subscribe
/// snapshot. Caps reconnect catch-up cost.
const CHAT_HISTORY_LIMIT: usize = 50;

/// Server-only conversion from the DDB row to the wire-format
/// payload. Lives in the realtime module (not the DTO module)
/// because the DTO module is feature-gate-free.
pub fn chat_payload_from(row: FactFoldChatMessage) -> ChatMessagePayload {
    ChatMessagePayload {
        msg_id: row.msg_id.clone(),
        author_pk: crate::features::arcade::games::fact_or_fold::types::dto::user_partition_from_pk(
            &row.author_pk,
        ),
        text: row.text,
        sent_at: row.sent_at,
    }
}

pub struct FactFoldChatChannel;

impl FactFoldChatChannel {
    pub fn new() -> Self {
        Self
    }
}

impl Default for FactFoldChatChannel {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl RoomChannel for FactFoldChatChannel {
    fn kind(&self) -> &'static str {
        "fof.chat"
    }

    async fn authorize(
        &self,
        ctx: &ChannelContext,
        channel: &ChannelId,
        _params: serde_json::Value,
    ) -> crate::common::Result<serde_json::Value> {
        let round_id = channel.inner().to_string();
        if round_id.is_empty() {
            return Err(ArcadeError::ChannelPayloadInvalid.into());
        }

        // Participant gate: the caller's USER#{user_id} pk must be
        // in the round's participant list. We never expose the
        // round's pk shape to the channel layer — the round read
        // happens here and the channel layer only sees the result.
        let round = FactFoldRound::get_by_round_id(&round_id)
            .await
            .map_err(|e| {
                crate::error!("fof.chat authorize round read failed: {e}");
                ArcadeError::StorageFailure
            })?
            .ok_or(ArcadeError::ChannelForbidden)?;

        let user_pk = Partition::User(ctx.user_id.clone()).to_string();
        if !round.participant_pks.iter().any(|p| p == &user_pk) {
            return Err(ArcadeError::ChannelForbidden.into());
        }

        // Backlog: load the latest CHAT_HISTORY_LIMIT messages for
        // this round. v1 single-page fetch; pagination lands when
        // round transcripts grow past a single page (rare in practice
        // — 4 players × 70s debate × 80 char cap).
        let rows = FactFoldChatMessage::list_by_round(&round_id, CHAT_HISTORY_LIMIT as i64)
            .await
            .map_err(|e| {
                crate::error!("fof.chat history query failed: {e}");
                ArcadeError::StorageFailure
            })?;

        let payloads: Vec<ChatMessagePayload> = rows.into_iter().map(chat_payload_from).collect();
        Ok(serde_json::json!({ "history": payloads }))
    }
}
