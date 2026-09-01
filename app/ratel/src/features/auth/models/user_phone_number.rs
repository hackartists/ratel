// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserPhoneNumber`
// (one row per user) → surrogate `id` PK. `user_pk` UNIQUE; `phone_number`
// UNIQUE + indexed (`find_by_phone_number` GSI). `user_pk` is a cross-feature
// `User` reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_phone_numbers")]
pub struct UserPhoneNumber {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    #[postgres(unique)]
    pub phone_number: String,
}

#[cfg(feature = "server")]
impl UserPhoneNumber {
    pub fn new(pk: Partition, phone_number: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            phone_number,
        }
    }

    /// The phone linkage row for `phone_number`, if any (was `find_by_phone_number`).
    pub async fn find_by_phone_number(
        phone_number: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().phone_number(StringOp::Eq(phone_number.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn delete_for_user(user_pk: &Partition) -> crate::common::Result<()> {
        use postgres::ops::StringOp;
        if let Some(row) = Self::repository()
            .find_one(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
        {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }
}
