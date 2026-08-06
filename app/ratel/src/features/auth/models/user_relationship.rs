// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserRelationship(other_user)`
// → surrogate `id` PK + natural key `(user_pk, other_user_pk)` (UNIQUE). The
// `find_by_relationship` GSI (gsi1 pk = the sk / target user) → indexed query on
// `other_user_pk`. Both refs are cross-feature `User` `Partition` strings — no
// FK for now.
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};
#[cfg(feature = "server")]
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr, Default, EnumProp)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema_repr))]
#[repr(u8)]
pub enum Relationship {
    #[default]
    Following = 1,
    Follower = 2,
    Mutual = 3,
}

/// jsonb newtype wrapper so the `Relationship` enum stores as an opaque jsonb
/// column (roundtrips the serde_repr integer, no native `CREATE TYPE`).
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct RelationshipJson(pub Relationship);

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_relationships", unique(user_pk, other_user_pk))]
pub struct UserRelationship {
    pub id: Uuid,

    #[postgres(index)]
    pub user_pk: String,

    /// The other party of the relationship (was the inner value of `sk`).
    #[postgres(index)]
    pub other_user_pk: String,

    pub relationship: RelationshipJson,
}

#[cfg(feature = "server")]
impl UserRelationship {
    pub fn new(pk: Partition, user: Partition, relationship: Relationship) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: pk.to_string(),
            other_user_pk: user.to_string(),
            relationship: RelationshipJson(relationship),
        }
    }

    /// Every relationship row targeting `other_user_pk` (was `find_by_relationship`).
    pub async fn find_by_relationship(
        other_user_pk: &Partition,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().other_user_pk(StringOp::Eq(other_user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "other_user_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
