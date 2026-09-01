use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Personal block (App Store UGC req #4): the viewer blocks a user so that
/// user's comments vanish from the viewer's feed instantly.
///
/// Postgres migration: the DynamoDB identity was `pk = UserBlock(blocker_id)` +
/// `sk = UserBlockTarget(blocked_id)`; the "query by pk" that built a viewer's
/// block set becomes `WHERE blocker_pk = …`. The pair is UNIQUE so a repeated
/// block is a no-op instead of a duplicate row.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "user_blocks", unique(blocker_pk, blocked_pk)))]
pub struct UserBlock {
    #[serde(default)]
    pub id: uuid::Uuid,

    #[serde(default)]
    pub created_at: i64,

    /// Blocker as full `Partition` string (`USER#…`).
    #[cfg_attr(feature = "server", postgres(index))]
    pub blocker_pk: String,
    /// Blocked author as full `Partition` string (`USER#…`).
    pub blocked_pk: String,
}

#[cfg(feature = "server")]
impl UserBlock {
    pub fn new(blocker_pk: &Partition, blocked_pk: &Partition) -> Option<Self> {
        use crate::common::utils::time::get_now_timestamp;
        if !matches!(blocker_pk, Partition::User(_)) || !matches!(blocked_pk, Partition::User(_)) {
            return None;
        }
        Some(Self {
            id: uuid::Uuid::now_v7(),
            created_at: get_now_timestamp(),
            blocker_pk: blocker_pk.to_string(),
            blocked_pk: blocked_pk.to_string(),
        })
    }

    /// Insert the block, ignoring a repeat block by the same viewer.
    pub async fn block(blocker_pk: &Partition, blocked_pk: &Partition) -> crate::common::Result<()> {
        use postgres::ops::StringOp;
        let row = match Self::new(blocker_pk, blocked_pk) {
            Some(r) => r,
            None => return Err(Error::NoPermission),
        };
        let existing = Self::repository()
            .find_one(
                Self::query()
                    .blocker_pk(StringOp::Eq(row.blocker_pk.clone()))
                    .blocked_pk(StringOp::Eq(row.blocked_pk.clone())),
            )
            .await
            .map_err(crate::common::Error::from)?;
        if existing.is_some() {
            return Ok(());
        }
        Self::repository()
            .insert(&row)
            .await
            .map(|_| ())
            .map_err(crate::common::Error::from)
    }

    /// Remove the block, if present.
    pub async fn unblock(
        blocker_pk: &Partition,
        blocked_pk: &Partition,
    ) -> crate::common::Result<()> {
        use postgres::ops::StringOp;
        let existing = Self::repository()
            .find_one(
                Self::query()
                    .blocker_pk(StringOp::Eq(blocker_pk.to_string()))
                    .blocked_pk(StringOp::Eq(blocked_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?;
        if let Some(row) = existing {
            Self::repository()
                .delete(row.id)
                .await
                .map_err(crate::common::Error::from)?;
        }
        Ok(())
    }

    /// Every author the viewer has blocked (bounded — the listing filter only
    /// needs the set, and a viewer with >500 blocks is pathological).
    pub async fn blocked_by(blocker_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .blocker_pk(StringOp::Eq(blocker_pk.to_string()))
                    .page(1)
                    .page_size(500),
            )
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }
}
