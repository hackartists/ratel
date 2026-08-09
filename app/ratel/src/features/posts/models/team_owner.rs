use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// The owner record for a team.
///
/// Postgres migration: the DynamoDB identity `(pk = Team(team_id),
/// sk = TeamOwner)` collapses to a surrogate `id` PK plus the natural key
/// `unique(team_id)` (one owner per team). `user_pk` (the full `Partition`
/// string of the owning user, `"USER#..."`) stays indexed so the owner can be
/// resolved by user. Both ids are cross-feature references — plain columns.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "team_owners", unique(team_id))]
pub struct TeamOwner {
    pub id: Uuid,

    #[postgres(index)]
    pub team_id: Uuid,

    pub display_name: String,
    pub profile_url: String,
    pub username: String,

    #[postgres(index)]
    pub user_pk: String,
}

#[cfg(feature = "server")]
impl TeamOwner {
    pub fn new(team_id: Uuid, user: User) -> Self {
        let user_pk = user.pk().to_string();
        Self {
            id: Uuid::now_v7(),
            team_id,
            display_name: user.display_name,
            profile_url: user.profile_url,
            username: user.username,
            user_pk,
        }
    }

    /// The owner row for a team, if any.
    pub async fn find_by_team(team_id: Uuid) -> Result<Option<Self>> {
        use postgres::ops::UuidOp;
        Self::repository()
            .find_one(Self::query().team_id(UuidOp::Eq(team_id)))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `team_id`.
    pub async fn save(&self) -> Result<()> {
        Self::repository()
            .upsert_on(&["team_id"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}
