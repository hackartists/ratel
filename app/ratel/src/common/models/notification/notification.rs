use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Outbound notification work item (email / side-effect dispatch).
///
/// DynamoDB kept this as `pk = NOTIFICATION#{uid}` + `sk = NOTIFICATION#{uid}`
/// — a single row per notification with `pk == sk`. The surrogate `id` (a
/// uuid_v7 minted where the old `uid` was) replaces both keys. `status` and
/// `data` are stored as jsonb via the `jsonb_column!` impls in `mod.rs`.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "notifications")]
pub struct Notification {
    pub id: Uuid,

    #[postgres(order)]
    pub created_at: i64,

    pub status: EventStatus,

    pub data: NotificationData,
}

#[cfg(feature = "server")]
impl Notification {
    pub fn new(data: NotificationData) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        Self {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)),
            created_at: now,
            status: EventStatus::Requested,
            data,
        }
    }

    /// Persist a freshly built notification row. Replaces the DynamoDB
    /// `notification.create(cli)` call.
    pub async fn save(&self) -> crate::common::Result<Self> {
        let saved = Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)?;
        // Phase 5: any notification row created anywhere emits so the outbox
        // poller dispatches "NotificationSend" (the 2nd-order push delivery) —
        // the Postgres analogue of the NOTIFICATION# stream record.
        crate::common::events::outbox::EventOutbox::emit_insert(
            crate::common::events::outbox::topic::NOTIFICATION,
            &saved,
        )
        .await
        .ok();
        Ok(saved)
    }

    pub async fn process(&self) -> crate::common::Result<()> {
        tracing::info!(
            "Notification send: id={}, status={:?}, data={:?}",
            self.id,
            self.status,
            self.data
        );

        self.data.send().await?;

        // Mark the row Completed. The whole loaded row is rewritten by id;
        // only `status` changes, so this reproduces the old partial
        // `updater().with_status(Completed)` write.
        let mut updated = self.clone();
        updated.status = EventStatus::Completed;
        Self::repository()
            .upsert(&updated)
            .await
            .map_err(crate::common::Error::from)?;

        Ok(())
    }
}
