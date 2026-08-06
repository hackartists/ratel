use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// Per-child marker pointing at the parent's anchor announcement Post.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(child), sk =
/// SubTeamAnnouncementFanout(announcement_id))` identity becomes a surrogate
/// `id` PK plus `unique(child_team_pk, announcement_id)` — one marker per
/// (child, announcement) so re-fanout is idempotent. `child_team_pk` holds the
/// raw `"TEAM#…"` partition string.
///
/// There is one anchor Post (`pk = Feed(announcement_id)`) and one of these
/// markers per recognized child. Child wall queries read their markers,
/// batch-get the anchor Posts they point at, and union the result.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(
        table = "sub_team_announcement_fanouts",
        unique(child_team_pk, announcement_id)
    )
)]
pub struct SubTeamAnnouncementFanout {
    /// Surrogate primary key.
    pub id: Uuid,

    /// The child team whose wall should surface this announcement
    /// (`"TEAM#…"` partition string). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub child_team_pk: String,

    /// Raw announcement id. Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub announcement_id: String,

    /// Anchor Post pk in string form (`"FEED#{announcement_id}"`).
    pub anchor_post_pk: String,

    /// Raw parent team UUID.
    pub parent_team_id: String,

    /// True when the source announcement was a direct message.
    pub is_direct: bool,

    /// Timestamp of the anchor Post — orders the marker in the child's wall.
    pub created_at: i64,

    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl SubTeamAnnouncementFanout {
    /// Build a marker row pointing at the parent's anchor Post.
    pub fn new(
        child_team_pk: Partition,
        announcement_id: String,
        parent_team_id: String,
        is_direct: bool,
        anchor_created_at: i64,
    ) -> Self {
        let anchor_post_pk = Partition::Feed(announcement_id.clone()).to_string();
        Self {
            id: Uuid::now_v7(),
            child_team_pk: child_team_pk.to_string(),
            announcement_id: announcement_id.clone(),
            anchor_post_pk,
            parent_team_id,
            is_direct,
            created_at: anchor_created_at,
            updated_at: anchor_created_at,
        }
    }

    /// The marker for `(child, announcement)`, if any.
    pub async fn find_marker(
        child_pk: &Partition,
        announcement_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .child_team_pk(StringOp::Eq(child_pk.to_string()))
                    .announcement_id(StringOp::Eq(announcement_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}
