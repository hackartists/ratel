use crate::common::*;

/// Opaque jsonb payload describing the specific action a `SpaceActivity`
/// records. Stored as a single jsonb column on `space_activities` (server
/// only); the wire representation is unchanged, so web builds keep the plain
/// enum without the ORM derive.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SpaceActivityData {
    #[default]
    Unknown,
    Poll {
        poll_id: String,
        answered_optional_count: u32,
    },
    Quiz {
        quiz_id: SpaceQuizAttemptEntityType,
        passed: bool,
        correct_count: u32,
        pass_threshold: u32,
    },
    Follow {
        follow_id: String,
    },
    Discussion {
        discussion_id: SpacePostPartition,
        #[serde(default)]
        comment_id: SpacePostCommentEntityType,
        is_first_contribution: bool,
    },
}
