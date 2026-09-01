// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserPrincipal`
// (one row per user) → surrogate `id` PK. `user_pk` UNIQUE; `principal` UNIQUE
// + indexed (`find_by_principal` GSI). `user_pk` is a cross-feature `User`
// reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_principals")]
pub struct UserPrincipal {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    #[postgres(unique)]
    pub principal: String,
}

#[cfg(feature = "server")]
impl UserPrincipal {
    pub fn new(pk: Partition, principal: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            principal,
        }
    }

    /// The principal linkage row for `principal`, if any (was `find_by_principal`).
    pub async fn find_by_principal(principal: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().principal(StringOp::Eq(principal.to_string())))
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
