use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::apps::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// One installed app row per (space, app_type).
///
/// Postgres migration: surrogate `id` PK; the DynamoDB
/// `(Space(space_id), SpaceApp(app_type))` identity becomes the
/// `unique(space_pk, app_type)` natural key. `space_pk` is a
/// cross-feature reference to the space partition — stored as the full
/// `Partition` string (`"SPACE#<id>"`), **no** FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "space_apps", unique(space_pk, app_type))
)]
pub struct SpaceApp {
    pub id: Uuid,

    /// Cross-feature reference to the space (full `Partition` string).
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    pub app_type: SpaceAppType,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl SpaceApp {
    pub fn new(space_pk: Partition, app_type: SpaceAppType) -> Self {
        let now = get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            app_type,
            created_at: now,
            updated_at: now,
        }
    }

    /// Every installed app row for a space, oldest first.
    pub async fn list_by_space(space_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(SpaceAppColumn::CreatedAt, postgres::Order::Asc),
            )
            .await?
            .items)
    }

    /// The single installed row for `(space_pk, app_type)`, if any.
    pub async fn find_by_space_and_type(
        space_pk: &Partition,
        app_type: SpaceAppType,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Ok(Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .app_type(EnumOp::Eq(app_type)),
            )
            .await?)
    }
}

impl SpaceApp {
    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }

    pub fn can_delete(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }
}
