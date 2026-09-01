// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserReferralCode`
// (one row per user) → surrogate `id` PK. `user_pk` UNIQUE; `referral_code`
// UNIQUE + indexed (`find_by_referral_code` GSI). `user_pk` is a cross-feature
// `User` reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_referral_codes")]
pub struct UserReferralCode {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    #[postgres(unique)]
    pub referral_code: String,
}

#[cfg(feature = "server")]
impl UserReferralCode {
    pub fn new(pk: Partition, referral_code: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            referral_code,
        }
    }

    /// The referral-code linkage row for `referral_code`, if any.
    pub async fn find_by_referral_code(
        referral_code: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().referral_code(StringOp::Eq(referral_code.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
