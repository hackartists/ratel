use crate::common::*;
use crate::features::sub_team::models::json::{FileList, SpaceTypeOpt, StringList, VisibilityJson};
#[cfg(feature = "server")]
use crate::features::posts::types::Visibility;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

/// Canonical record of a parent team's broadcast announcement.
///
/// **Postgres migration:** the DynamoDB `(pk = Team(parent), sk =
/// SubTeamAnnouncement(announcement_id))` identity becomes a surrogate `id` PK
/// (equal to the former announcement_id uuid) plus `team_pk` (raw `"TEAM#…"`
/// partition string, indexed). Publish flips `status` → `Published` and sets
/// `published_at`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "sub_team_announcements"))]
pub struct SubTeamAnnouncement {
    /// Surrogate primary key (former announcement_id).
    pub id: Uuid,

    /// Owning parent team partition string (`"TEAM#…"`). Indexed.
    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    #[cfg_attr(feature = "server", postgres(index))]
    pub created_at: i64,
    pub updated_at: i64,

    pub published_at: Option<i64>,

    pub announcement_id: String,

    pub title: String,
    /// Plain-text legacy field.
    pub body: String,

    /// Rich-text (HTML) body produced by the post composer's editor.
    pub html_contents: String,

    /// Free-form tags. Stored as jsonb.
    pub tags: StringList,

    /// File attachments. Stored as jsonb.
    pub attachments: FileList,

    /// Parent-team admin user pk who authored.
    pub author_user_id: String,

    pub status: SubTeamAnnouncementStatus,
    pub target_type: BroadcastTarget,

    /// Visibility of the fanned-out Posts. Stored as jsonb (external enum).
    pub visibility: VisibilityJson,

    /// When ON, publish creates a Space and every fanned-out child Post
    /// references it.
    pub space_enabled: bool,

    /// Space type chosen in the composer when `space_enabled`. Stored as jsonb.
    pub space_type: SpaceTypeOpt,

    /// Populated by `publish_announcement_handler` once the Space is created.
    pub space_pk: Option<String>,

    /// Populated by the fan-out — how many sub-teams received this.
    pub fan_out_count: i32,

    /// `Some(child_team_id)` for a direct message to a single sub-team.
    pub target_child_team_id: Option<String>,

    /// pk of the fan-out Post created in the target child's feed.
    pub target_post_pk: Option<String>,

    /// Timestamp the deferred Space-publish inbox fan-out completed.
    pub broadcast_notified_at: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
pub enum SubTeamAnnouncementStatus {
    #[default]
    Draft,
    Published,
    Deleted,
}

/// Phase 1 ships `AllRecognizedSubTeams` only.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
pub enum BroadcastTarget {
    #[default]
    AllRecognizedSubTeams,
}

#[cfg(feature = "server")]
impl SubTeamAnnouncement {
    /// Create a Draft.
    pub fn new_draft(
        parent_team_pk: Partition,
        title: String,
        body: String,
        author_user_id: String,
        target_child_team_id: Option<TeamPartition>,
    ) -> Self {
        let id = Uuid::now_v7();
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id,
            team_pk: parent_team_pk.to_string(),
            created_at: now,
            updated_at: now,
            published_at: None,
            announcement_id: id.to_string(),
            title,
            body,
            html_contents: String::new(),
            tags: StringList(Vec::new()),
            attachments: FileList(Vec::new()),
            author_user_id,
            status: SubTeamAnnouncementStatus::Draft,
            target_type: BroadcastTarget::AllRecognizedSubTeams,
            visibility: VisibilityJson(Visibility::Public),
            space_enabled: false,
            space_type: SpaceTypeOpt(None),
            space_pk: None,
            fan_out_count: 0,
            target_child_team_id: target_child_team_id.map(|p| p.0),
            target_post_pk: None,
            broadcast_notified_at: None,
        }
    }

    /// The parent team partition (was `pk`).
    pub fn team_partition(&self) -> Partition {
        self.team_pk.parse().unwrap_or_default()
    }

    /// The raw parent team uuid (was `pk`'s inner id).
    pub fn parent_team_id(&self) -> String {
        match self.team_partition() {
            Partition::Team(id) => id,
            _ => String::new(),
        }
    }

    /// Load an announcement by id, scoped to the owning team.
    pub async fn find_in_team(
        team_pk: &Partition,
        announcement_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        let Ok(uuid) = announcement_id.parse::<Uuid>() else {
            return Ok(None);
        };
        let row = Self::repository()
            .get(uuid)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.filter(|a| a.team_pk == team_pk.to_string()))
    }

    /// One page of a team's announcements, newest first.
    pub async fn page_for_team(
        team_pk: &Partition,
        page: i64,
        page_size: i64,
    ) -> crate::common::Result<postgres::Page<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(
                Self::query()
                    .team_pk(StringOp::Eq(team_pk.to_string()))
                    .order_by(SubTeamAnnouncementColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }
}
