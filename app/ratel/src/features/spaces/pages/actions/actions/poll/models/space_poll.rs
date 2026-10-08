#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::actions::actions::poll::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// jsonb wrapper for the embedded `Vec<Question>` column (server-only).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, postgres::PostgresJson)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(transparent)]
pub struct PollQuestions(pub Vec<Question>);

#[cfg(feature = "server")]
impl std::ops::Deref for PollQuestions {
    type Target = Vec<Question>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A poll action.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpacePoll#{uuid}`. It becomes a surrogate `id` PK plus
/// `(space_id, poll_id)` natural key. The "default poll" convention
/// (`poll_id == space_id`) is preserved. `questions` is embedded jsonb; the
/// response-count / score scalars stay real columns for atomic increment.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_polls", unique(space_id, poll_id))]
pub struct SpacePoll {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    pub poll_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: String,

    pub user_response_count: i64,
    pub response_editable: bool,

    #[serde(default)]
    pub questions: PollQuestions,

    #[serde(default)]
    pub total_score: i64,
    #[serde(default)]
    pub total_point: i64,

    #[serde(default)]
    pub canister_upload_enabled: bool,
}

#[cfg(feature = "server")]
impl SpacePoll {
    pub fn new(
        space_pk: SpacePartition,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<Self> {
        let poll_id = uuid::Uuid::now_v7().to_string();
        let now = get_now_timestamp_millis();

        Ok(Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            poll_id,
            created_at: now,
            updated_at: now,
            user_response_count: 0,
            response_editable: false,
            title: String::new(),
            description: String::new(),
            questions: PollQuestions::default(),
            total_point: 0,
            total_score: 0,
            canister_upload_enabled: false,
        })
    }

    /// The former sk value as a `SpacePollEntityType` (bare id).
    pub fn poll_entity_type(&self) -> SpacePollEntityType {
        SpacePollEntityType(self.poll_id.clone())
    }

    /// Fetch the poll row for `(space, poll_id)`.
    pub async fn get_one(
        space_pk: &SpacePartition,
        poll_id: &SpacePollEntityType,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_pk.0.clone()))
                    .poll_id(StringOp::Eq(poll_id.0.clone())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Atomic `user_response_count += delta` (SQL `SET col = col + $d`).
    pub async fn bump_response_count(poll_id: Uuid, delta: i64) -> crate::common::Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET \"user_response_count\" = \"user_response_count\" + "
        ));
        postgres::Value::from(delta).push_bind(&mut qb);
        qb.push(" WHERE \"id\" = ");
        postgres::Value::from(poll_id).push_bind(&mut qb);
        Self::repository()
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    pub fn is_default_poll(&self) -> bool {
        self.poll_id == self.space_id
    }

    pub fn sanitize_schedule_name(raw: &str) -> String {
        let mut s: String = raw
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' {
                    c
                } else {
                    '-'
                }
            })
            .collect();

        if s.len() > 64 {
            s.truncate(64);
        }
        s
    }

    /// Delete the default poll of a space (`poll_id == space_id`), if present.
    pub async fn delete_one(
        space_pk: &Partition,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<()> {
        let space_id = match space_pk {
            Partition::Space(v) => v.to_string(),
            _ => return Ok(()),
        };

        let existing = Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.clone()))
                    .poll_id(StringOp::Eq(space_id.clone())),
            )
            .await
            .map_err(crate::common::Error::from)?;

        if let Some(poll) = existing {
            Self::repository()
                .delete(poll.id)
                .await
                .map_err(crate::common::Error::from)?;
        }

        Ok(())
    }
}

#[cfg(feature = "server")]
impl SpacePoll {
    pub fn can_view(
        _user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<()> {
        Ok(())
    }

    pub fn status_from(
        action_status: Option<&crate::features::spaces::pages::actions::types::SpaceActionStatus>,
    ) -> PollStatus {
        use crate::features::spaces::pages::actions::types::SpaceActionStatus;
        match action_status {
            Some(SpaceActionStatus::Ongoing) => PollStatus::InProgress,
            Some(SpaceActionStatus::Finish) => PollStatus::Finish,
            _ => PollStatus::NotStarted,
        }
    }

    pub fn can_edit(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<()> {
        match user_role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(crate::features::spaces::pages::actions::actions::poll::Error::NoPermission),
        }
    }

    pub fn can_respond(
        action_status: Option<&crate::features::spaces::pages::actions::types::SpaceActionStatus>,
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<()> {
        // Candidates must be able to respond to prerequisite polls — otherwise
        // they cannot clear prerequisites and transition to Participant.
        match user_role {
            SpaceUserRole::Creator | SpaceUserRole::Participant | SpaceUserRole::Candidate => {
                if Self::status_from(action_status) == PollStatus::InProgress {
                    return Ok(());
                }
                return Err(SpacePollError::PollNotInProgress.into());
            }
            _ => Err(crate::features::spaces::pages::actions::actions::poll::Error::NoPermission),
        }
    }
}

#[cfg(feature = "server")]
impl From<(SpacePoll, bool)>
    for crate::features::spaces::pages::actions::types::SpaceActionSummary
{
    fn from((poll, user_participated): (SpacePoll, bool)) -> Self {
        use crate::features::spaces::pages::actions::types::SpaceActionType;
        let action_id = poll.poll_id;
        Self {
            action_id,
            action_type: SpaceActionType::Poll,
            title: poll.title,
            description: poll.description,
            created_at: poll.created_at,
            updated_at: poll.updated_at,
            total_score: Some(poll.total_score),
            total_point: Some(poll.total_point),
            quiz_score: None,
            quiz_total_score: None,
            quiz_passed: None,
            user_participated,
            credits: 0,
            prerequisite: false,
            comment_count: None,
            status: None,
            depends_on: Vec::new(),
            dependencies_met: true,
            required_attributes: Vec::new(),
            required_attributes_met: true,
        }
    }
}

#[cfg(feature = "server")]
impl TryFrom<SpacePartition> for SpacePoll {
    type Error = crate::features::spaces::pages::actions::actions::poll::Error;

    fn try_from(
        value: SpacePartition,
    ) -> crate::features::spaces::pages::actions::actions::poll::Result<Self> {
        let space_id = value.0;
        let now = get_now_timestamp_millis();

        Ok(Self {
            id: Uuid::now_v7(),
            // Default poll: poll_id == space_id.
            space_id: space_id.clone(),
            poll_id: space_id,
            created_at: now,
            updated_at: now,
            user_response_count: 0,
            response_editable: false,
            title: String::new(),
            description: String::new(),
            questions: PollQuestions::default(),
            total_point: 0,
            total_score: 0,
            canister_upload_enabled: false,
        })
    }
}
