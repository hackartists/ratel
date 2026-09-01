use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Moderation state of a user, driven by accumulated comment reports.
///
/// Postgres migration: on DynamoDB this backed a GSI partition key and so
/// serialized as its plain name. Here it is a native PG enum
/// (`moderation_status`, labels snake_cased); `strum` is kept because the admin
/// queue parses the status out of a `?status=` query string.
#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    Default,
    Serialize,
    Deserialize,
    strum::Display,
    strum::EnumString,
)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
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

/// One row per user. Drives the admin moderation queue and the soft-ban.
///
/// Postgres migration: the DynamoDB identity was
/// `pk = UserModeration(user_id)` + `sk = UserModerationFlag`, with a
/// `find_by_status` GSI powering the admin queue. It becomes a surrogate `id`
/// PK, `user_pk` UNIQUE (one flag per user), and an indexed `status` column —
/// the GSI query becomes `WHERE status = … ORDER BY updated_at DESC`.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "user_moderation_flags", unique(user_pk)))]
pub struct UserModerationFlag {
    #[serde(default)]
    pub id: uuid::Uuid,

    /// Flagged user as full `Partition` string (`USER#…`).
    pub user_pk: String,

    /// Admin-queue filter — indexed so the queue is a plain equality scan.
    #[serde(default)]
    #[cfg_attr(feature = "server", postgres(index))]
    pub status: ModerationStatus,

    #[serde(default)]
    pub updated_at: i64,

    /// Distinct reports accumulated against this user across their comments.
    #[serde(default)]
    pub report_count: i64,

    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub username: String,
}

impl UserModerationFlag {
    pub fn is_blocked(&self) -> bool {
        self.status == ModerationStatus::Blocked
    }
}

#[cfg(feature = "server")]
impl UserModerationFlag {
    pub fn new(user_pk: &Partition, display_name: String, username: String) -> Option<Self> {
        use crate::common::utils::time::get_now_timestamp;
        if !matches!(user_pk, Partition::User(_)) {
            return None;
        }
        Some(Self {
            id: uuid::Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            status: ModerationStatus::None,
            updated_at: get_now_timestamp(),
            report_count: 0,
            display_name,
            username,
        })
    }

    /// The user's flag row, if one exists.
    pub async fn find_by_user(user_pk: &Partition) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// True when the user is soft-banned (comments hidden, posting rejected).
    pub async fn is_user_blocked(user_pk: &Partition) -> bool {
        matches!(Self::find_by_user(user_pk).await, Ok(Some(f)) if f.is_blocked())
    }

    /// The admin queue: flagged users with `status`, most recently updated first.
    pub async fn list_by_status(
        status: ModerationStatus,
        bookmark: Option<String>,
        limit: i64,
    ) -> crate::common::Result<(Vec<Self>, Option<String>)> {
        use postgres::Order;
        use postgres::ops::EnumOp;
        let page = bookmark
            .and_then(|b| b.parse::<i64>().ok())
            .unwrap_or(1)
            .max(1);
        let p = Self::repository()
            .find(
                Self::query()
                    .status(EnumOp::Eq(status))
                    .order_by(UserModerationFlagColumn::UpdatedAt, Order::Desc)
                    .page(page)
                    .page_size(limit),
            )
            .await
            .map_err(crate::common::Error::from)?;
        let next = if page < p.total_pages {
            Some((page + 1).to_string())
        } else {
            None
        };
        Ok((p.items, next))
    }

    /// Set an admin decision, creating the row when the user has none yet.
    pub async fn set_status(
        user_pk: &Partition,
        status: ModerationStatus,
    ) -> crate::common::Result<()> {
        use crate::common::utils::time::get_now_timestamp;
        match Self::find_by_user(user_pk).await? {
            Some(flag) => {
                Self::repository()
                    .update(
                        flag.id,
                        Self::update().status(status).updated_at(get_now_timestamp()),
                    )
                    .await
                    .map_err(crate::common::Error::from)?;
            }
            None => {
                let mut flag =
                    Self::new(user_pk, String::new(), String::new()).ok_or(Error::NoPermission)?;
                flag.status = status;
                Self::repository()
                    .insert(&flag)
                    .await
                    .map_err(crate::common::Error::from)?;
            }
        }
        Ok(())
    }
}
