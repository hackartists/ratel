use crate::common::*;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use uuid::Uuid;

/// A user's verified DID attributes. Migrated DynamoDB → Postgres.
///
/// Formerly keyed by `pk: CompositePartition(USER#<id>, ATTRIBUTES)` +
/// `sk: EntityType::VerifiedAttributes` — exactly one row per user, so
/// `user_pk` is the natural key (`unique`) and `id` is a surrogate uuid PK.
///
/// `user_pk` is a **cross-feature** reference (the user is owned by the
/// auth/users feature). It is stored as the full owning `Partition` string
/// (`"USER#<id>"`) to preserve the User prefix the DynamoDB key carried. No FK
/// is declared (rule 3).
///
/// `gender` was `Option<Gender>` (a shared enum in `common::attribute` that we
/// must not modify). DynamoDB stored the serde-serialized enum as the bare
/// snake_case string (`"male"` / `"female"`), so the Postgres column is
/// `Option<String>` holding the identical value — no representation change.
///
/// The old sparse `gsi1` (`find_by_info_prefix`) index had no callers and is
/// dropped.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "verified_attributes", unique(user_pk))]
pub struct VerifiedAttributes {
    pub id: Uuid,
    /// Owning user's `Partition` string (`"USER#<id>"`). Natural key: one row
    /// per user.
    #[postgres(index)]
    pub user_pk: String,
    pub birth_date: Option<String>, // YYYYMMDD
    pub gender: Option<String>,     // snake_case "male" / "female"
    pub university: Option<String>,
}

#[cfg(feature = "server")]
impl VerifiedAttributes {
    pub fn new(user_pk: Partition) -> Self {
        if !matches!(user_pk, Partition::User(_)) {
            panic!("pk for VerifiedAttributes must be Partition::User");
        }

        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            ..Default::default()
        }
    }

    /// Single-row read for a user — replaces the DynamoDB point read on
    /// `(USER#<id>##ATTRIBUTES, VERIFIED_ATTRIBUTES)`. Returns `None` when the
    /// user has never verified any attribute; callers fall back to
    /// `VerifiedAttributes::default()` / `::new(..)`.
    pub async fn get_by_user(user_pk: &Partition) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert (insert-or-update on `user_pk`). Replaces the old
    /// DynamoDB `upsert`. Preserves the surrogate `id` on conflict.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    pub fn age(&self) -> Option<u32> {
        use chrono::{Datelike, Utc};

        let birth_date = self.birth_date.as_ref()?;
        if birth_date.len() != 8 {
            return None;
        }

        let year = birth_date[0..4].parse::<i32>().ok()?;
        let month = birth_date[4..6].parse::<u32>().ok()?;
        let day = birth_date[6..8].parse::<u32>().ok()?;

        let now = Utc::now();
        let current_year = now.year();
        let current_month = now.month();
        let current_day = now.day();

        let mut age = (current_year - year) as u32;
        if current_month < month || (current_month == month && current_day < day) {
            age = age.saturating_sub(1);
        }

        Some(age)
    }
}
