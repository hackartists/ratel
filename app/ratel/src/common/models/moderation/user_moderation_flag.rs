use crate::common::*;

/// Moderation state of a user, driven by accumulated comment reports.
/// Serializes as its plain name (e.g. `"PendingReview"`) so it can back a GSI
/// partition key the same way `Partition` / `EntityType` do.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Default,
    strum::Display,
    strum::EnumString,
    SerializeDisplay,
    DeserializeFromStr,
)]
pub enum ModerationStatus {
    /// No moderation action; not shown in the admin queue.
    #[default]
    None,
    /// Report tally reached the threshold — awaiting an admin decision.
    PendingReview,
    /// Admin soft-banned the user (comments hidden + posting rejected).
    Blocked,
    /// Admin reviewed and cleared the user; auto-hidden comments restored.
    Dismissed,
}

/// One row per user (`pk = UserModeration(user_id)`, `sk = UserModerationFlag`).
/// The `find_by_status` GSI powers the admin moderation queue.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(DynamoEntity))]
pub struct UserModerationFlag {
    pub pk: Partition,
    pub sk: EntityType,

    /// GSI pk — list flagged users by status (`PendingReview`, `Blocked`).
    #[cfg_attr(
        feature = "server",
        dynamo(prefix = "MOD_STATUS", name = "find_by_status", index = "gsi1", pk)
    )]
    pub status: ModerationStatus,
    #[cfg_attr(feature = "server", dynamo(index = "gsi1", sk))]
    pub updated_at: i64,

    /// Distinct reports accumulated against this user across their comments.
    #[serde(default)]
    pub report_count: u64,
    pub user_pk: Partition,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub username: String,
}

#[cfg(feature = "server")]
impl UserModerationFlag {
    pub fn keys(user_pk: &Partition) -> Option<(Partition, EntityType)> {
        let user_id = match user_pk {
            Partition::User(id) => id.clone(),
            _ => return None,
        };
        Some((
            Partition::UserModeration(user_id),
            EntityType::UserModerationFlag,
        ))
    }

    pub fn new(user_pk: Partition, display_name: String, username: String) -> Option<Self> {
        use crate::common::utils::time::get_now_timestamp;
        let (pk, sk) = Self::keys(&user_pk)?;
        Some(Self {
            pk,
            sk,
            status: ModerationStatus::None,
            updated_at: get_now_timestamp(),
            report_count: 0,
            user_pk,
            display_name,
            username,
        })
    }

    pub fn is_blocked(&self) -> bool {
        self.status == ModerationStatus::Blocked
    }
}
