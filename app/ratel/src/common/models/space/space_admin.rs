use crate::common::types::*;
use crate::common::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// A space administrator (was DynamoDB `SPACE#{id}` + `SPACE_ADMIN#{user_pk}`).
///
/// Postgres migration: surrogate `id` PK; the DynamoDB `(space, user)` identity
/// becomes the `unique(space_pk, user_pk)` natural key. `space_pk` and
/// `user_pk` are **cross-feature** references, stored as their full `Partition`
/// strings (`"SPACE#…"` / `"USER#…"`) — plain indexed columns, **no FK** for now.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "space_admins", unique(space_pk, user_pk))
)]
pub struct SpaceAdmin {
    #[serde(default)]
    pub id: Uuid,

    /// Cross-feature reference — the space, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    pub created_at: i64,

    pub display_name: String,
    pub username: String,
    pub profile_url: String,

    /// Cross-feature reference — the admin user, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,
}

impl SpaceAdmin {
    pub fn new(
        space_pk: Partition,
        user_pk: Partition,
        display_name: String,
        username: String,
        profile_url: String,
    ) -> Self {
        let created_at = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            created_at,
            display_name,
            username,
            profile_url,
            user_pk: user_pk.to_string(),
        }
    }
}

#[cfg(feature = "server")]
impl SpaceAdmin {
    /// The admin row for `(space, user)`, if any.
    pub async fn get_admin(space_pk: &Partition, user_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every admin row for a space, newest first.
    pub async fn find_by_space(space_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(SpaceAdminColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Every space a user administers (`find_by_user` GSI1).
    pub async fn find_by_user(user_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(SpaceAdminColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Natural-key upsert on `(space_pk, user_pk)`, preserving the surrogate `id`.
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert_on(&["space_pk", "user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Idempotent delete of the `(space, user)` admin row.
    pub async fn delete_admin(space_pk: &Partition, user_pk: &Partition) -> Result<()> {
        if let Some(row) = Self::get_admin(space_pk, user_pk).await? {
            match Self::repository().delete(row.id).await {
                Ok(_) | Err(postgres::Error::NotFound) => {}
                Err(e) => return Err(crate::common::Error::from(e)),
            }
        }
        Ok(())
    }
}
