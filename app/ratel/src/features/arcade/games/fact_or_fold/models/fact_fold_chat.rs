use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::ops::StringOp;
use postgres::{Order, PostgresEntity};
use uuid::Uuid;

/// One row per chat message. Roadmap §FR-11 (영구 보존).
///
/// Postgres migration: the DynamoDB `(FactFold(round_id),
/// FactFoldChat(msg_id))` pair becomes a surrogate `id` PK plus a
/// `unique(msg_id)` natural key. `msg_id` is a uuid_v7 string so a
/// DESC scan matches the DynamoEntity `query()` default order the old
/// callers relied on.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_chat_messages")]
pub struct FactFoldChatMessage {
    pub id: Uuid,

    #[postgres(index)]
    pub round_id: String,
    /// Time-sortable uuid_v7 message id. UNIQUE.
    #[postgres(unique)]
    pub msg_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Rendered `Partition` string of the author.
    pub author_pk: String,
    /// 80-char cap enforced by the controller.
    pub text: String,
    /// Millis-since-epoch when the server accepted the message.
    pub sent_at: i64,
}

impl FactFoldChatMessage {
    pub fn new(round_id: &str, author_pk: Partition, text: String) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        let msg_id = Uuid::now_v7().to_string();
        Self {
            id: Uuid::now_v7(),
            round_id: round_id.to_string(),
            msg_id,
            created_at: now,
            updated_at: now,
            author_pk: author_pk.to_string(),
            text,
            sent_at: now,
        }
    }

    /// The round's transcript, newest-first (matches the DynamoEntity
    /// `query()` DESC-by-sk default the pollers rely on).
    pub async fn list_by_round(round_id: &str, limit: i64) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(
                Self::query()
                    .round_id(StringOp::Eq(round_id.to_string()))
                    .order_by(FactFoldChatMessageColumn::MsgId, Order::Desc)
                    .limit(limit),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Create-if-not-exists on `msg_id`.
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Delete a single message row by surrogate id.
    pub async fn delete_row(id: Uuid) -> crate::common::Result<()> {
        Self::repository()
            .delete(id)
            .await
            .map_err(crate::common::Error::from)
    }
}
