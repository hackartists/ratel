use crate::common::*;

/// Personal block: `pk = UserBlock(blocker_id)`, `sk = UserBlockTarget(blocked_id)`.
/// A query by pk returns everyone the viewer has blocked; comment listings drop
/// those authors for that viewer (App Store req #4 — remove from feed instantly).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(DynamoEntity))]
pub struct UserBlock {
    pub pk: Partition,
    pub sk: EntityType,

    #[serde(default)]
    pub created_at: i64,
    pub blocker_pk: Partition,
    pub blocked_pk: Partition,
}

#[cfg(feature = "server")]
impl UserBlock {
    pub fn keys(blocker_pk: &Partition, blocked_pk: &Partition) -> Option<(Partition, EntityType)> {
        let blocker_id = match blocker_pk {
            Partition::User(id) => id.clone(),
            _ => return None,
        };
        let blocked_id = match blocked_pk {
            Partition::User(id) => id.clone(),
            _ => return None,
        };
        Some((
            Partition::UserBlock(blocker_id),
            EntityType::UserBlockTarget(blocked_id),
        ))
    }

    pub fn new(blocker_pk: Partition, blocked_pk: Partition) -> Option<Self> {
        use crate::common::utils::time::get_now_timestamp;
        let (pk, sk) = Self::keys(&blocker_pk, &blocked_pk)?;
        Some(Self {
            pk,
            sk,
            created_at: get_now_timestamp(),
            blocker_pk,
            blocked_pk,
        })
    }
}
