use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use uuid::Uuid;

pub const DEDUP_TTL_DAYS: i64 = 7;

/// 7-day dedup lock keyed on `(recipient, kind, source)` so a notification is
/// delivered at most once per source event.
///
/// DynamoDB keyed this by `pk = User(user_id)` +
/// `sk = InboxDedupMarker("{kind_prefix}#{source_hash}")`. Postgres keeps the
/// natural identity as `unique(user_id, marker_key)` where `marker_key` is the
/// old sk inner value. `user_id` is a bare `USER#` inner id (cross-feature ref,
/// no FK — rule 3).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "inbox_dedup_markers", unique(user_id, marker_key))]
pub struct InboxDedupMarker {
    pub id: Uuid,

    /// Recipient user id (bare `USER#` inner id).
    #[postgres(index)]
    pub user_id: String,

    /// `"{kind_prefix}#{source_hash}"` — the old sk inner value.
    pub marker_key: String,

    pub created_at: i64,

    /// Epoch seconds. Retained from the DynamoDB TTL design for a future
    /// cleanup job — Postgres has no native row TTL (see risky notes).
    pub expires_at: i64,
}

#[cfg(feature = "server")]
impl InboxDedupMarker {
    pub fn new(recipient_pk: Partition, kind: InboxKind, source_id: &str) -> Self {
        let user_id = match &recipient_pk {
            Partition::User(id) => id.clone(),
            other => other.to_string(),
        };
        let now_ms = crate::common::utils::time::get_now_timestamp_millis();
        let expires_at = (now_ms / 1000) + DEDUP_TTL_DAYS * 86_400;
        let hash = Self::hash_source(source_id);
        Self {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)),
            user_id,
            marker_key: format!("{}#{hash}", kind.as_prefix()),
            created_at: now_ms,
            expires_at,
        }
    }

    fn hash_source(source_id: &str) -> String {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        source_id.hash(&mut h);
        format!("{:016x}", h.finish())
    }

    /// Whether a dedup marker already exists for `(user_id, marker_key)`.
    /// Replaces the DynamoDB point read on `(pk, sk)`.
    pub async fn find_existing(
        user_id: &str,
        marker_key: &str,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .user_id(StringOp::Eq(user_id.to_string()))
                    .marker_key(StringOp::Eq(marker_key.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert the dedup marker. Replaces `marker.create(cli)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }
}
