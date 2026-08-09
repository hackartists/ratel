use crate::features::spaces::pages::actions::actions::quiz::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
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
pub struct QuizQuestions(pub Vec<Question>);

#[cfg(feature = "server")]
impl std::ops::Deref for QuizQuestions {
    type Target = Vec<Question>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// jsonb wrapper for the embedded `Vec<File>` column (server-only).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, postgres::PostgresJson)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(transparent)]
pub struct QuizFiles(pub Vec<File>);

#[cfg(feature = "server")]
impl std::ops::Deref for QuizFiles {
    type Target = Vec<File>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// A quiz action.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceQuiz#{uuid}`. It becomes a surrogate `id` PK plus
/// `(space_id, quiz_id)` natural key. `questions` / `files` are embedded jsonb
/// documents; the response-count / retry / pass_score scalars stay real
/// columns so the atomic response-count increment survives.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_quizzes", unique(space_id, quiz_id))]
pub struct SpaceQuiz {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    pub quiz_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    pub user_response_count: i64,
    pub retry_count: i64,
    #[serde(default)]
    pub pass_score: i64,

    #[serde(default)]
    pub questions: QuizQuestions,
    #[serde(default)]
    pub files: QuizFiles,
}

#[cfg(feature = "server")]
impl SpaceQuiz {
    pub fn new(
        space_pk: SpacePartition,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<Self> {
        let quiz_id = uuid::Uuid::now_v7().to_string();
        let now = get_now_timestamp_millis();

        Ok(Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            quiz_id,
            created_at: now,
            updated_at: now,
            user_response_count: 0,
            retry_count: 0,
            pass_score: 0,
            questions: QuizQuestions::default(),
            files: QuizFiles::default(),
        })
    }

    /// The former sk value as a `SpaceQuizEntityType` (bare id).
    pub fn quiz_entity_type(&self) -> SpaceQuizEntityType {
        SpaceQuizEntityType(self.quiz_id.clone())
    }

    /// Atomic `user_response_count += delta` — replaces the DynamoDB atomic
    /// `ADD`; `SET col = col + $delta` runs in SQL (never read-modify-write),
    /// preserving concurrency semantics.
    pub async fn bump_response_count(quiz_id: Uuid, delta: i64) -> crate::common::Result<()> {
        use postgres::sqlx::{Postgres, QueryBuilder};
        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET \"user_response_count\" = \"user_response_count\" + "
        ));
        postgres::Value::from(delta).push_bind(&mut qb);
        qb.push(" WHERE \"id\" = ");
        postgres::Value::from(quiz_id).push_bind(&mut qb);
        Self::repository()
            .db()
            .execute(qb)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    /// Fetch the single quiz row for `(space, quiz_id)`.
    pub async fn get_one(
        space_pk: &SpacePartition,
        quiz_id: &SpaceQuizEntityType,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_pk.0.clone()))
                    .quiz_id(StringOp::Eq(quiz_id.0.clone())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub fn can_edit(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<()> {
        match user_role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(crate::features::spaces::pages::actions::actions::quiz::Error::NoPermission),
        }
    }

    pub fn can_participate(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<()> {
        match user_role {
            SpaceUserRole::Participant => Ok(()),
            _ => Err(crate::features::spaces::pages::actions::actions::quiz::Error::NoPermission),
        }
    }

    pub fn can_view(
        _user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<()> {
        Ok(())
    }

    pub fn can_respond(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<()> {
        match user_role {
            SpaceUserRole::Creator | SpaceUserRole::Participant => Ok(()),
            _ => Err(crate::features::spaces::pages::actions::actions::quiz::Error::NoPermission),
        }
    }
}
