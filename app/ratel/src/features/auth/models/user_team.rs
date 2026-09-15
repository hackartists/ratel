// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserTeam(team_pk)`
// → surrogate `id` PK + natural key `(user_pk, team_pk)` (UNIQUE). The
// `find_by_team` GSI (all memberships of a team) becomes an indexed equality
// query on `team_pk`. Both `user_pk` and `team_pk` are cross-feature `Partition`
// references (`"USER#…"` / `"TEAM#…"` strings) — no FK for now.
use crate::features::auth::*;
#[cfg(feature = "server")]
use crate::features::social::pages::member::dto::TeamRole;
#[cfg(feature = "server")]
use postgres::{PostgresEntity, PostgresJson};
#[cfg(feature = "server")]
use uuid::Uuid;

/// `TeamRole` is a foreign enum (social feature) with no `PostgresEnum` derive,
/// so it is stored as an opaque jsonb newtype column. Roundtrips the exact
/// enum value.
#[cfg(feature = "server")]
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct TeamRoleJson(pub TeamRole);

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_teams", unique(user_pk, team_pk))]
pub struct UserTeam {
    pub id: Uuid,

    #[postgres(index)]
    pub user_pk: String,
    #[postgres(index)]
    pub team_pk: String,

    #[postgres(order)]
    pub last_used_at: i64,

    pub display_name: String,
    pub profile_url: String,
    pub username: String,

    pub dao_address: Option<String>,

    /// Single-source-of-truth role on the team. Replaces the prior
    /// TeamGroup/UserTeamGroup permissions chain.
    #[serde(default)]
    pub role: TeamRoleJson,
}

#[cfg(feature = "server")]
impl UserTeam {
    pub fn new(
        user_pk: Partition,
        team_pk: Partition,
        display_name: String,
        profile_url: String,
        username: String,
        dao_address: Option<String>,
        role: TeamRole,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            team_pk: team_pk.to_string(),
            last_used_at: now,
            display_name,
            profile_url,
            username,
            dao_address,
            role: TeamRoleJson(role),
        }
    }

    /// Every membership row for `user_pk`.
    pub async fn find_by_user(user_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Every membership row for `team_pk` (was `find_by_team`).
    pub async fn find_by_team(team_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// The single `(user_pk, team_pk)` membership row, if any.
    pub async fn get_membership(
        user_pk: &Partition,
        team_pk: &Partition,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .team_pk(StringOp::Eq(team_pk.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "team_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}

#[derive(Default, Serialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UserTeamResponse {
    pub nickname: String,
    pub profile_url: String,
    pub username: String,
    pub user_type: UserType,
    pub dao_address: Option<String>,
}

#[cfg(feature = "server")]
impl From<UserTeam> for UserTeamResponse {
    fn from(user_team: UserTeam) -> Self {
        Self {
            nickname: user_team.display_name,
            profile_url: user_team.profile_url,
            username: user_team.username,
            dao_address: user_team.dao_address,
            user_type: UserType::Team,
        }
    }
}
