use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::{BoolOp, StringOp};
#[cfg(feature = "server")]
use uuid::Uuid;

pub const INBOX_TTL_DAYS: i64 = 90;

/// One inbox row per delivered notification.
///
/// DynamoDB keyed this by `pk = User(user_id)` + `sk = UserInboxNotification(uuid_v7)`
/// and implemented cheap unread-only listing with a sparse GSI whose sort key
/// (`unread_created_at`) was `"U#{created_at}"` while unread and rewritten to
/// `"R"` on read. Postgres replaces that GSI trick with a plain
/// `WHERE is_read = false ORDER BY created_at DESC`, so the `unread_created_at`
/// sentinel column is dropped. `user_id` is a bare `USER#` inner id
/// (cross-feature ref to users, no FK — rule 3). `kind`/`payload` are jsonb via
/// the `jsonb_column!` impls in `mod.rs`.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_inbox_notifications")]
pub struct UserInboxNotification {
    pub id: Uuid,

    /// Recipient user id (bare `USER#` inner id).
    #[postgres(index)]
    pub user_id: String,

    #[postgres(order)]
    pub created_at: i64,

    pub is_read: bool,

    pub kind: InboxKind,
    pub payload: InboxPayload,

    /// Epoch seconds. Retained from the DynamoDB TTL design for a future
    /// cleanup job — Postgres has no native row TTL (see risky notes).
    pub expires_at: i64,
}

#[cfg(feature = "server")]
impl UserInboxNotification {
    pub fn new(recipient_pk: Partition, payload: InboxPayload) -> Self {
        let user_id = match &recipient_pk {
            Partition::User(id) => id.clone(),
            other => other.to_string(),
        };
        let now_ms = crate::common::utils::time::get_now_timestamp_millis();
        let expires_at = (now_ms / 1000) + INBOX_TTL_DAYS * 86_400;

        Self {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)),
            user_id,
            created_at: now_ms,
            is_read: false,
            kind: payload.kind(),
            payload,
            expires_at,
        }
    }

    /// Insert a new inbox row. Replaces `row.create(cli)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// One page of a user's inbox, newest-first. `unread_only` filters to
    /// `is_read = false` (replaces the sparse unread GSI). Space scoping stays
    /// a post-fetch filter on `payload.space_id()` at the controller, exactly
    /// as before.
    pub async fn find_for_user(
        user_id: &str,
        unread_only: bool,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        let mut query = Self::query().user_id(StringOp::Eq(user_id.to_string()));
        if unread_only {
            query = query.is_read(BoolOp::Eq(false));
        }
        Self::repository()
            .find(
                query
                    .order_by(UserInboxNotificationColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Fetch a row by id, scoped to its owner (used by `mark_read`). Returns
    /// `None` if the row doesn't exist or belongs to another user.
    pub async fn get_owned(user_id: &str, id: Uuid) -> crate::common::Result<Option<Self>> {
        match Self::get_by_id(id)
            .await
            .map_err(crate::common::Error::from)?
        {
            Some(row) if row.user_id == user_id => Ok(Some(row)),
            _ => Ok(None),
        }
    }

    /// Flip `is_read` to true. No-op if already read. Replaces the old
    /// `updater().with_is_read(true).with_unread_created_at("R")` rewrite.
    pub async fn mark_read(&self) -> crate::common::Result<()> {
        if self.is_read {
            return Ok(());
        }
        let mut updated = self.clone();
        updated.is_read = true;
        Self::repository()
            .upsert(&updated)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}
