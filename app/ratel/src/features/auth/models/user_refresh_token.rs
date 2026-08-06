// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserRefreshToken(device_id)`
// → surrogate `id` PK + natural key `(user_pk, device_id)` (UNIQUE). The
// `find_by_device_id` GSI (all rows for a device, across users) becomes an
// indexed equality query on `device_id`. `user_pk` is a cross-feature
// reference to the auth `User` entity, stored as the full `Partition` string
// (`"USER#…"`) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};
#[cfg(feature = "server")]
use uuid::Uuid;

/// `UserType` is a foreign enum (`common::types`) with no `PostgresEnum`
/// derive, so it is stored as an opaque jsonb newtype column (serde-transparent
/// on the single field). Roundtrips the exact enum value.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct UserTypeJson(pub UserType);

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_refresh_tokens", unique(user_pk, device_id))]
pub struct UserRefreshToken {
    pub id: Uuid,

    /// Cross-feature reference to the owning user (`"USER#…"` partition string).
    #[postgres(index)]
    pub user_pk: String,

    /// Stable per-install device id. Indexed: `find_by_device_id` returns every
    /// account row registered on one device.
    #[postgres(index)]
    pub device_id: String,

    pub token_hash: String,

    pub user_display_name: String,
    pub user_profile_url: String,
    pub user_username: String,
    pub user_type: UserTypeJson,

    #[postgres(order)]
    pub created_at: i64,
    pub expired_at: Option<i64>,
    pub revoked: bool,
}

#[cfg(feature = "server")]
impl UserRefreshToken {
    pub fn new(user: &User, device_id: String) -> (Self, String) {
        let plain_token = uuid::Uuid::now_v7().to_string();
        let token_hash = crate::common::utils::sha256::sha256_base64url(&plain_token);
        let created_at = crate::common::utils::time::now();

        (
            Self {
                id: Uuid::now_v7(),
                user_pk: user.pk().to_string(),
                device_id,
                token_hash,
                user_display_name: user.display_name.clone(),
                user_profile_url: user.profile_url.clone(),
                user_username: user.username.clone(),
                user_type: UserTypeJson(user.user_type.clone()),
                created_at,
                expired_at: None,
                revoked: false,
            },
            plain_token,
        )
    }

    /// Every refresh-token row registered on `device_id`, newest first,
    /// paginated. Replaces the DynamoDB `find_by_device_id` GSI query
    /// (`scan_index_forward(false)` on the `created_at` sort key).
    pub async fn find_by_device_id(
        device_id: &str,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        use postgres::Order;
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .device_id(StringOp::Eq(device_id.to_string()))
                    .order_by(UserRefreshTokenColumn::CreatedAt, Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Point read of the single `(user_pk, device_id)` row.
    pub async fn get_by_user_device(
        user_pk: &Partition,
        device_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .device_id(StringOp::Eq(device_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert-or-rotate on the natural key `(user_pk, device_id)`, preserving
    /// the surrogate `id`. Replaces the DynamoDB `upsert` (device_id keyed the
    /// row, so a new login on the same device overwrote the hash in place).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "device_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Rotate this row's token hash + created_at in place, clearing `revoked`.
    /// Replaces the DynamoDB conditional `updater(...).execute()`.
    pub async fn rotate(
        &self,
        token_hash: String,
        created_at: i64,
    ) -> crate::common::Result<Self> {
        Self::repository()
            .update(
                self.id,
                Self::update()
                    .token_hash(token_hash)
                    .created_at(created_at)
                    .revoked(false),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}
