// Migrated from packages/main-api/src/models/dynamo_tables/main/phone/phone_verification.rs
// Postgres migration: DynamoDB `pk = Phone(phone)` + `sk = PhoneVerification`
// (one row per phone) → surrogate `id` PK + natural key `phone` (UNIQUE). The
// `find_by_phone` / `find_by_phone_and_code` GSIs become indexed equality
// queries.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Default, Debug, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
pub struct PhoneVerification {
    pub id: Uuid,

    /// Natural key — one verification row per phone number.
    #[postgres(unique)]
    pub phone: String,

    /// The verification code.
    pub value: String,

    #[postgres(order)]
    pub created_at: i64,
    pub expired_at: i64,
    pub attempt_count: i32,
}

#[cfg(feature = "server")]
impl PhoneVerification {
    pub fn new(phone: String, value: String, expired_at: i64) -> Self {
        let created_at = chrono::Utc::now().timestamp_micros();

        Self {
            id: Uuid::now_v7(),
            phone,
            value,
            created_at,
            expired_at,
            attempt_count: 0,
        }
    }

    /// The single verification row for `phone`, if any.
    pub async fn find_by_phone(phone: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().phone(StringOp::Eq(phone.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// The verification row matching `(phone, code)`, if any.
    pub async fn find_by_phone_and_code(
        phone: &str,
        code: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .phone(StringOp::Eq(phone.to_string()))
                    .value(StringOp::Eq(code.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert-or-replace on the natural key `phone`, preserving `id`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["phone"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Read-modify-write bump of `attempt_count` (see EmailVerification note).
    pub async fn increase_attempt_count(&self) -> crate::common::Result<Self> {
        Self::repository()
            .update(
                self.id,
                Self::update().attempt_count(self.attempt_count + 1),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}
