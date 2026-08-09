// Postgres migration: DynamoDB `pk = User(user_pk)` + `sk = UserTeamGroup(team_group_sk)`
// → surrogate `id` PK + natural key `(user_pk, team_group_sk)` (UNIQUE). The
// `find_by_team_group_pk` GSI → indexed query on `team_group_sk`; the
// `find_by_team_pk` GSI → indexed query on `team_pk`. `user_pk` / `team_pk` /
// `team_group_sk` are cross-feature reference strings — no FK for now.
#[cfg(feature = "server")]
use crate::features::auth::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "user_team_groups", unique(user_pk, team_group_sk))]
pub struct UserTeamGroup {
    pub id: Uuid,

    #[postgres(index)]
    pub user_pk: String,

    /// The team-group entity key (was the inner value of `sk`).
    #[postgres(index)]
    pub team_group_sk: String,

    pub team_group_permissions: i64,

    #[postgres(index)]
    pub team_pk: String,
}

#[cfg(feature = "server")]
impl UserTeamGroup {
    pub fn new(
        user_pk: Partition,
        team_group_sk: EntityType,
        team_group_permissions: i64,
        team_pk: Partition,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            user_pk: user_pk.to_string(),
            team_group_sk: team_group_sk.to_string(),
            team_group_permissions,
            team_pk: team_pk.to_string(),
        }
    }

    /// Every team-group row for `team_group_sk` (was `find_by_team_group_pk`).
    pub async fn find_by_team_group_pk(
        team_group_sk: &str,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().team_group_sk(StringOp::Eq(team_group_sk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Every team-group row for `team_pk` (was `find_by_team_pk`).
    pub async fn find_by_team_pk(team_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(Self::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["user_pk", "team_group_sk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}
