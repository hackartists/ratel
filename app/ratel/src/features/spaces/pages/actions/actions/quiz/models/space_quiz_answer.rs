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

/// jsonb wrapper for the embedded `Vec<QuizCorrectAnswer>` column (server-only).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, postgres::PostgresJson)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(transparent)]
pub struct QuizCorrectAnswers(pub Vec<QuizCorrectAnswer>);

#[cfg(feature = "server")]
impl std::ops::Deref for QuizCorrectAnswers {
    type Target = Vec<QuizCorrectAnswer>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// The correct-answer key for a quiz.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceQuizAnswer#{quiz_id}`. It becomes a surrogate `id` PK plus
/// `(space_id, quiz_id)` natural key. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_quiz_answers", unique(space_id, quiz_id))]
pub struct SpaceQuizAnswer {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,
    pub quiz_id: String,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub answers: QuizCorrectAnswers,
}

#[cfg(feature = "server")]
impl SpaceQuizAnswer {
    pub fn new(
        space_id: SpacePartition,
        quiz_id: SpaceQuizEntityType,
        answers: Vec<QuizCorrectAnswer>,
    ) -> Self {
        let now = get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_id: space_id.0,
            quiz_id: quiz_id.0,
            created_at: now,
            updated_at: now,
            answers: QuizCorrectAnswers(answers),
        }
    }

    /// Fetch the correct-answer key for `(space, quiz_id)`.
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

    /// Natural-key upsert on `(space_id, quiz_id)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "quiz_id"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
