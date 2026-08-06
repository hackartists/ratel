use crate::common::*;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use uuid::Uuid;

/// An offline verification code carrying attributes to graft onto a user's DID.
/// Migrated DynamoDB → Postgres.
///
/// Formerly keyed by `pk: Partition::AttributeCode(code)` +
/// `sk: EntityType::AttributeCode` — one row per code, so `code` is the natural
/// key (`unique`) and `id` is a surrogate uuid PK.
///
/// `gender` was `Option<Gender>` (shared enum in `common::attribute`, must not
/// be modified). DynamoDB stored it as the serde snake_case string, so the
/// Postgres column is `Option<String>` holding the identical value.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "attribute_codes", unique(code))]
pub struct AttributeCode {
    pub id: Uuid,
    /// The verification code (was `Partition::AttributeCode(code)`). Natural key.
    #[postgres(index)]
    pub code: String,
    #[postgres(order)]
    pub created_at: i64,
    pub birth_date: Option<String>,
    pub gender: Option<String>, // snake_case "male" / "female"
    pub university: Option<String>,
}

#[cfg(feature = "server")]
impl AttributeCode {
    /// Point read by code — replaces the DynamoDB read on
    /// `(ATTRIBUTE_CODE#<code>, ATTRIBUTE_CODE)`. Returns `None` when the code
    /// does not exist.
    pub async fn get_by_code(code: &str) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(Self::query().code(StringOp::Eq(code.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert (insert-or-update on `code`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["code"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
