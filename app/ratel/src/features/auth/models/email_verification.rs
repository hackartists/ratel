// Migrated from packages/main-api/src/models/dynamo_tables/main/email/email_verification.rs
// Postgres migration: the DynamoDB single-table identity `pk = Email(email)` +
// `sk = EmailVerification` (exactly one row per email) collapses to a surrogate
// `id` PK with the natural key `email` (UNIQUE). The `find_by_email` /
// `find_by_email_and_code` GSIs become indexed-column equality queries.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "email_verifications")]
pub struct EmailVerification {
    pub id: Uuid,

    /// Natural key — one verification row per email address.
    #[postgres(unique)]
    pub email: String,

    /// The verification code.
    pub value: String,

    #[postgres(order)]
    pub created_at: i64,
    pub expired_at: i64,
    pub attempt_count: i32,
}

#[cfg(feature = "server")]
impl EmailVerification {
    pub fn new(email: String, value: String, expired_at: i64) -> Self {
        let created_at = chrono::Utc::now().timestamp_micros();

        Self {
            id: Uuid::now_v7(),
            email,
            value,
            created_at,
            expired_at,
            attempt_count: 0,
        }
    }

    /// The single verification row for `email`, if any. Replaces the DynamoDB
    /// `find_by_email` GSI point read.
    pub async fn find_by_email(email: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().email(StringOp::Eq(email.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// The verification row matching `(email, code)`, if any. Replaces the
    /// DynamoDB `find_by_email_and_code` GSI query.
    pub async fn find_by_email_and_code(
        email: &str,
        code: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .email(StringOp::Eq(email.to_string()))
                    .value(StringOp::Eq(code.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Insert-or-replace on the natural key `email`, preserving the surrogate
    /// `id`. Replaces the create/update branching DynamoDB required.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["email"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Atomic-ish attempt-count bump. The DynamoDB version used an atomic ADD;
    /// here the row is already loaded, so this is a read-modify-write set of
    /// `attempt_count + 1` (verification codes are single-user, low-contention).
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
