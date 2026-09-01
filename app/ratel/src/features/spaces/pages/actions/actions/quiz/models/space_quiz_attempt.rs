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

/// jsonb wrapper for the embedded `Vec<Answer>` column (server-only).
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, postgres::PostgresJson)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(transparent)]
pub struct QuizAttemptAnswers(pub Vec<Answer>);

#[cfg(feature = "server")]
impl std::ops::Deref for QuizAttemptAnswers {
    type Target = Vec<Answer>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

/// One quiz attempt by a user.
///
/// Postgres migration: the DynamoDB identity was `pk = user_pk` +
/// `sk = SpaceQuizAttempt#{quiz_id}#{attempt_id}`, with a GSI on
/// `quiz_user = {user_pk}#{quiz_id}`. It becomes a surrogate `id` PK plus the
/// flattened `user_pk` / `quiz_id` / `attempt_id` columns and an indexed
/// `quiz_user` column for the per-(quiz,user) attempt listing. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[postgres(table = "space_quiz_attempts")]
pub struct SpaceQuizAttempt {
    pub id: Uuid,

    /// Actor as full `Partition` string (`USER#…`).
    pub user_pk: String,
    pub quiz_id: String,
    pub attempt_id: String,

    /// `{user_pk}#{quiz_id}` — indexed for the per-(quiz,user) attempt listing.
    #[postgres(index)]
    pub quiz_user: String,

    #[postgres(order)]
    pub created_at: i64,

    #[serde(default)]
    pub answers: QuizAttemptAnswers,
    pub score: i64,

    #[serde(default)]
    pub display_name: Option<String>,
    #[serde(default)]
    pub profile_url: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub space_id: Option<String>,
    #[serde(default)]
    pub pass_threshold: Option<i64>,
}

#[cfg(feature = "server")]
impl SpaceQuizAttempt {
    pub fn new(
        space_id: SpacePartition,
        quiz_id: SpaceQuizEntityType,
        author: crate::common::models::space::SpaceUser,
        answers: Vec<Answer>,
        score: i64,
        pass_threshold: i64,
    ) -> Self {
        let created_at = get_now_timestamp_millis();
        let attempt_id = uuid::Uuid::now_v7().to_string();
        let user_pk = author.pk.to_string();
        let quiz_user = Self::quiz_user_key(&quiz_id, &author.pk);

        Self {
            id: Uuid::now_v7(),
            user_pk,
            quiz_id: quiz_id.0,
            attempt_id,
            quiz_user,
            created_at,
            answers: QuizAttemptAnswers(answers),
            score,
            display_name: Some(author.display_name),
            profile_url: Some(author.profile_url),
            username: Some(author.username),
            space_id: Some(space_id.to_string()),
            pass_threshold: Some(pass_threshold),
        }
    }

    pub fn quiz_user_key(quiz_id: &SpaceQuizEntityType, user_pk: &Partition) -> String {
        format!("{user_pk}#{quiz_id}")
    }

    pub async fn find_latest_by_quiz_user(
        quiz_id: &SpaceQuizEntityType,
        user_pk: &Partition,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<Option<Self>> {
        use postgres::Order;
        Self::repository()
            .find_one(
                Self::query()
                    .quiz_user(StringOp::Eq(Self::quiz_user_key(quiz_id, user_pk)))
                    .order_by(SpaceQuizAttemptColumn::CreatedAt, Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn list_by_quiz_user(
        quiz_id: &SpaceQuizEntityType,
        user_pk: &Partition,
        limit: i32,
    ) -> crate::features::spaces::pages::actions::actions::quiz::Result<Vec<Self>> {
        use postgres::Order;
        Self::repository()
            .find(
                Self::query()
                    .quiz_user(StringOp::Eq(Self::quiz_user_key(quiz_id, user_pk)))
                    .order_by(SpaceQuizAttemptColumn::CreatedAt, Order::Desc)
                    .page(1)
                    .page_size(limit as i64),
            )
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }
}
