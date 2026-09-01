// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserTelegram` (one
// row per user) → surrogate `id` PK. `user_pk` UNIQUE; `telegram_id` UNIQUE +
// indexed (`find_by_telegram_id` GSI). `user_pk` is a cross-feature `User`
// reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_telegrams")]
pub struct UserTelegram {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    #[postgres(unique)]
    pub telegram_id: i64,
    pub telegram_raw: String,
}

#[cfg(feature = "server")]
impl UserTelegram {
    pub fn new(pk: Partition, telegram_id: i64, telegram_raw: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            telegram_id,
            telegram_raw,
        }
    }

    /// The telegram linkage row for `telegram_id`, if any (was `find_by_telegram_id`).
    pub async fn find_by_telegram_id(telegram_id: i64) -> crate::common::Result<Option<Self>> {
        use postgres::ops::NumOp;
        Self::repository()
            .find_one(Self::query().telegram_id(NumOp::Eq(telegram_id)))
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
