use crate::features::spaces::pages::actions::actions::discussion::*;

use crate::features::spaces::pages::actions::actions::discussion::macros::DynamoEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// Why a user is reporting a comment. Shown in the report dialog (translated in
/// the UI) and surfaced to admins in the moderation queue.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub enum ReportReason {
    Spam,
    Harassment,
    HateSpeech,
    Violence,
    SexualContent,
    #[default]
    Other,
}

/// One row per (comment, reporter). The composite sk dedupes double-reports and
/// lets us count DISTINCT reporters of a comment via an sk-prefix query; the
/// `find_by_author` GSI lists every report filed against a given author (the
/// per-user moderation tally + the admin review view).
#[derive(Debug, Clone, Serialize, Deserialize, Default, DynamoEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct SpacePostCommentReport {
    /// Post partition — shared with the reported comment's pk.
    pub pk: Partition,
    /// `SpacePostCommentReport(comment_id, reporter_id)`.
    pub sk: EntityType,

    /// Reported comment's author — GSI pk so admins can pull every report
    /// against one user.
    #[dynamo(prefix = "REPORTED_USER", name = "find_by_author", index = "gsi1", pk)]
    pub author_pk: Partition,
    #[dynamo(index = "gsi1", sk)]
    pub created_at: i64,

    /// The reported comment's sk (`SpacePostComment` | `SpacePostCommentReply`).
    pub comment_sk: EntityType,
    pub reporter_pk: Partition,
    #[serde(default)]
    pub reason: ReportReason,
    #[serde(default)]
    pub detail: String,
}

/// Extract the stable comment id from a comment sk (top-level or reply).
pub fn comment_id_of(comment_sk: &EntityType) -> Option<String> {
    match comment_sk {
        EntityType::SpacePostComment(id) => Some(id.clone()),
        EntityType::SpacePostCommentReply(parent_id, reply_id) => {
            Some(format!("{}#{}", parent_id, reply_id))
        }
        _ => None,
    }
}

#[cfg(feature = "server")]
impl SpacePostCommentReport {
    pub fn keys(
        post_pk: &Partition,
        comment_sk: &EntityType,
        reporter_pk: &Partition,
    ) -> Option<(Partition, EntityType)> {
        let comment_id = comment_id_of(comment_sk)?;
        let reporter_id = match reporter_pk {
            Partition::User(id) => id.clone(),
            _ => return None,
        };
        Some((
            post_pk.clone(),
            EntityType::SpacePostCommentReport(comment_id, reporter_id),
        ))
    }

    pub fn new(
        post_pk: Partition,
        comment_sk: EntityType,
        author_pk: Partition,
        reporter_pk: Partition,
        reason: ReportReason,
        detail: String,
    ) -> Option<Self> {
        use crate::common::utils::time::get_now_timestamp;
        let (pk, sk) = Self::keys(&post_pk, &comment_sk, &reporter_pk)?;
        Some(Self {
            pk,
            sk,
            author_pk,
            created_at: get_now_timestamp(),
            comment_sk,
            reporter_pk,
            reason,
            detail,
        })
    }
}
