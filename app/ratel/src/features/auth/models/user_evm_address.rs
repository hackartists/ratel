// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserEvmAddress`
// (one row per user) → surrogate `id` PK. `user_pk` is UNIQUE (one linkage per
// user); `evm_address` is UNIQUE + indexed (the `find_by_evm` GSI). `user_pk`
// is a cross-feature `User` reference (`"USER#…"` string) — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_evm_addresses")]
pub struct UserEvmAddress {
    pub id: Uuid,

    #[postgres(unique)]
    pub user_pk: String,

    #[postgres(unique)]
    pub evm_address: String,
}

#[cfg(feature = "server")]
impl UserEvmAddress {
    pub fn new(pk: Partition, evm_address: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            evm_address,
        }
    }

    /// The EVM-address linkage row for `evm_address`, if any (was `find_by_evm`).
    pub async fn find_by_evm(evm_address: &str) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().evm_address(StringOp::Eq(evm_address.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Best-effort removal of the user's EVM linkage (used by account deletion).
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
