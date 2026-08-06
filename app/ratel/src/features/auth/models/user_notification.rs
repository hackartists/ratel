// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserNotification(device_id)`
// → surrogate `id` PK + natural key `(user_pk, device_id)` (UNIQUE). The
// `find_user_notifications_by_user` GSI → indexed query on `user_pk`. `user_pk`
// is a cross-feature `User` reference string — no FK for now.
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};
#[cfg(feature = "server")]
use uuid::Uuid;

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "snake_case")]
pub enum NotificationPlatform {
    #[default]
    Android,
    Ios,
    Web,
}

/// jsonb newtype wrapper so the `NotificationPlatform` enum stores as an opaque
/// jsonb column (no native `PostgresEnum` / `CREATE TYPE` dependency).
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct NotificationPlatformJson(pub NotificationPlatform);

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_notifications", unique(user_pk, device_id))]
pub struct UserNotification {
    pub id: Uuid,

    #[postgres(index)]
    pub user_pk: String,

    /// Stable per-install device id (was the inner value of `sk`).
    pub device_id: String,

    pub device_token: String,

    pub platform: NotificationPlatformJson,
    pub created_at: i64,

    #[postgres(order)]
    pub updated_at: i64,

    pub last_used_at: Option<i64>,
}

#[cfg(feature = "server")]
impl UserNotification {
    pub fn new(
        user_pk: Partition,
        device_token: String,
        platform: NotificationPlatform,
        device_id: String,
    ) -> Self {
        let now = chrono::Utc::now().timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            device_id,
            device_token,
            platform: NotificationPlatformJson(platform),
            created_at: now,
            updated_at: now,
            last_used_at: None,
        }
    }

    pub fn touch(&mut self) {
        let now = chrono::Utc::now().timestamp_millis();
        self.last_used_at = Some(now);
        self.updated_at = now;
    }

    /// Every notification device row for `user_pk`
    /// (was `find_user_notifications_by_user`).
    pub async fn find_by_user(user_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "device_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
