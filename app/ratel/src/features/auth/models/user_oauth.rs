// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserOAuth` (one row
// per user) → surrogate `id` PK. Natural key `(provider, uid)` UNIQUE + indexed
// (`find_by_provider_and_uid` GSI). `provider` is the foreign `OauthProvider`
// enum, stored as its `Display` string (`SerializeDisplay`/`DeserializeFromStr`)
// so it is a plain, queryable/uniqueable TEXT column. `user_pk` is a
// cross-feature `User` reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

// Provider enum is in crate::common::types::oauth_provider

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_oauths", unique(provider, uid))]
pub struct UserOAuth {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    /// `OauthProvider` rendered via `Display` (e.g. `"google"`).
    #[postgres(index)]
    pub provider: String,
    #[postgres(index)]
    pub uid: String,
}

#[cfg(feature = "server")]
impl UserOAuth {
    pub fn new(pk: Partition, provider: OauthProvider, uid: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            provider: provider.to_string(),
            uid,
        }
    }

    /// The OAuth linkage row for `(provider, uid)`, if any.
    pub async fn find_by_provider_and_uid(
        provider: OauthProvider,
        uid: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .provider(StringOp::Eq(provider.to_string()))
                    .uid(StringOp::Eq(uid.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["provider", "uid"], self)
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
