use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Push tokens expire if a device is idle; refreshed on every register call.
pub const DEVICE_TOKEN_TTL_DAYS: i64 = 60;

/// A registered push-notification token for one user device.
///
/// DynamoDB keyed this by `pk = User(user_id)` + `sk = UserDeviceToken(device_id)`
/// so re-registering the same install overwrote its token (FCM rotates tokens).
/// Postgres keeps that with `unique(user_id, device_id)` + natural-key upsert.
/// `user_id` is a bare `USER#` inner id (cross-feature ref, no FK — rule 3).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_device_tokens", unique(user_id, device_id))]
pub struct UserDeviceToken {
    pub id: Uuid,

    /// Recipient user id (bare `USER#` inner id).
    #[postgres(index)]
    pub user_id: String,

    /// Stable per-install id (was the sk inner value).
    pub device_id: String,

    /// FCM (Android) / APNs (iOS) registration token.
    pub token: String,

    /// "android" | "ios" | "web".
    pub platform: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Epoch seconds. Retained from the DynamoDB TTL design for a future
    /// cleanup job — Postgres has no native row TTL (see risky notes).
    pub expires_at: i64,
}

#[cfg(feature = "server")]
impl UserDeviceToken {
    pub fn new(recipient_pk: Partition, device_id: &str, token: String, platform: String) -> Self {
        let user_id = match &recipient_pk {
            Partition::User(id) => id.clone(),
            other => other.to_string(),
        };
        let now_ms = crate::common::utils::time::get_now_timestamp_millis();
        let expires_at = (now_ms / 1000) + DEVICE_TOKEN_TTL_DAYS * 86_400;
        Self {
            id: uuid::Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)),
            user_id,
            device_id: device_id.to_string(),
            token,
            platform,
            created_at: now_ms,
            updated_at: now_ms,
            expires_at,
        }
    }

    /// Natural-key upsert on `(user_id, device_id)`. Re-registering the same
    /// device overwrites its token + TTL. Replaces the old conditional-put
    /// `.upsert(cli)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_id", "device_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every device token registered under one user (push fan-out).
    pub async fn find_by_user(user_id: &str) -> crate::common::Result<Vec<Self>> {
        Ok(Self::repository()
            .find(Self::query().user_id(StringOp::Eq(user_id.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Delete this specific token row (stale-token pruning during fan-out).
    /// Idempotent — a row already gone is not an error.
    pub async fn delete_self(&self) -> crate::common::Result<()> {
        match Self::delete_by_id(self.id).await {
            Ok(_) | Err(postgres::Error::NotFound) => Ok(()),
            Err(e) => Err(crate::common::Error::from(e)),
        }
    }

    /// Delete one user's token for a given device (device unregister).
    pub async fn delete_for(user_id: &str, device_id: &str) -> crate::common::Result<()> {
        if let Some(row) = Self::repository()
            .find_one(
                Self::query()
                    .user_id(StringOp::Eq(user_id.to_string()))
                    .device_id(StringOp::Eq(device_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?
        {
            match Self::delete_by_id(row.id).await {
                Ok(_) | Err(postgres::Error::NotFound) => {}
                Err(e) => return Err(crate::common::Error::from(e)),
            }
        }
        Ok(())
    }
}
