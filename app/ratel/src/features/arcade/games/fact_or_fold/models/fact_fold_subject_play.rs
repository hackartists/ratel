use crate::common::*;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Per-user marker row asserting "this user has already joined a round
/// backed by `subject_id`".
///
/// Postgres migration: the DynamoDB `(User(user_id),
/// FactFoldSubjectPlay(subject_id))` pair becomes a surrogate `id` PK
/// plus a `unique(user_id, subject_id)` natural key — the existence of
/// the row is the whole signal.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "fact_fold_subject_plays", unique(user_id, subject_id))]
pub struct FactFoldSubjectPlay {
    pub id: Uuid,

    #[postgres(index)]
    pub user_id: String,
    pub subject_id: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Round the user was bound into for this subject.
    pub round_id: String,
}

impl FactFoldSubjectPlay {
    pub fn new(user_id: &str, subject_id: &str, round_id: &str) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            user_id: user_id.to_string(),
            subject_id: subject_id.to_string(),
            created_at: now,
            updated_at: now,
            round_id: round_id.to_string(),
        }
    }

    /// Create-if-not-exists on `(user_id, subject_id)`.
    pub async fn insert_new(&self) -> crate::common::Result<Self> {
        Self::repository()
            .insert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// True iff a marker exists for `(user_id, subject_id)`.
    pub async fn exists(user_id: &str, subject_id: &str) -> crate::common::Result<bool> {
        let row = Self::repository()
            .find_one(
                Self::query()
                    .user_id(StringOp::Eq(user_id.to_string()))
                    .subject_id(StringOp::Eq(subject_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.is_some())
    }
}
