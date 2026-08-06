#[cfg(feature = "server")]
use crate::features::auth::OptionalUser;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use crate::features::posts::types::*;
use crate::features::posts::*;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

#[cfg(feature = "server")]
use super::TeamOwner;

/// A team account.
///
/// Postgres migration: the DynamoDB identity `(pk = Team(team_id), sk = Team)`
/// collapses to a surrogate `id` PK equal to the former team UUID — so the wire
/// `TeamPartition` is still `id.to_string()`. The name/username prefix GSIs
/// become plain indexed columns. Team membership/roles still resolve against
/// the un-migrated `auth::UserTeam` (DynamoDB) rows, so permission methods keep
/// a `cli` parameter.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "teams", unique(username))]
pub struct Team {
    pub id: Uuid,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,

    /// Scope-A local point balance.
    pub points: i64,

    #[postgres(index)]
    pub display_name: String,
    pub profile_url: String,
    #[postgres(index)]
    pub username: String,

    #[postgres(index)]
    pub followers: i64,
    pub followings: i64,

    pub description: String,

    pub dao_address: Option<String>,

    pub thumbnail_url: Option<String>,
    pub allow_invite: bool,
    pub allow_create_space: bool,

    pub is_parent_eligible: bool,
    pub min_sub_team_members: i32,
    pub min_sub_team_age_days: i32,

    pub parent_team_id: Option<String>,
    pub pending_parent_team_id: Option<String>,
}

#[cfg(feature = "server")]
impl Team {
    pub fn new(
        display_name: String,
        profile_url: String,
        username: String,
        description: String,
    ) -> Self {
        let now = crate::common::utils::time::get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            created_at: now,
            updated_at: now,
            points: 0,
            display_name,
            profile_url,
            username,
            description,
            followers: 0,
            followings: 0,
            dao_address: None,
            thumbnail_url: None,
            allow_invite: false,
            allow_create_space: false,
            is_parent_eligible: false,
            min_sub_team_members: 0,
            min_sub_team_age_days: 0,
            parent_team_id: None,
            pending_parent_team_id: None,
        }
    }

    /// The team's `TeamPartition`-shaped `Partition` (`"TEAM#..."`).
    pub fn partition(&self) -> Partition {
        Partition::Team(self.id.to_string())
    }

    /// Fetch a team by its unique `username`.
    pub async fn find_by_username(username: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().username(StringOp::Eq(username.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Persist a full-row update (upsert on the PK).
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert(self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Create a team + its owner row + the creator's `UserTeam` membership.
    ///
    /// NOTE: `Team` + `TeamOwner` land in Postgres (single `Tx`), while the
    /// creator's `UserTeam` membership is still a DynamoDB write (auth feature
    /// not yet migrated). The former single DynamoDB transaction is therefore
    /// split across two stores — atomicity across the boundary is lost until
    /// auth migrates. `cli` is retained solely for the `UserTeam` write.
    pub async fn create_new_team(
        user: &User,
        cli: &aws_sdk_dynamodb::Client,
        display_name: String,
        profile_url: String,
        username: String,
        description: String,
    ) -> Result<(Partition, i64)> {
        let team = Team::new(display_name, profile_url, username, description);
        let team_owner = TeamOwner::new(team.id, user.clone());
        let team_pk = team.partition();
        let created_at = team.created_at;

        let tx = postgres::Tx::begin()
            .await
            .map_err(crate::common::Error::from)?;
        Self::repository()
            .with_tx(&tx)
            .insert(&team)
            .await
            .map_err(crate::common::Error::from)?;
        TeamOwner::repository()
            .with_tx(&tx)
            .insert(&team_owner)
            .await
            .map_err(crate::common::Error::from)?;
        tx.commit().await.map_err(crate::common::Error::from)?;

        let user_team = crate::features::auth::UserTeam::new(
            user.pk(),
            team_pk.clone(),
            team.display_name.clone(),
            team.profile_url.clone(),
            team.username.clone(),
            team.dao_address.clone(),
            crate::features::social::pages::member::dto::TeamRole::Owner,
        );
        user_team.create().await?;

        Ok((team_pk, created_at))
    }

    pub async fn get_permitted_team(
        cli: &aws_sdk_dynamodb::Client,
        team_pk: Partition,
        user_pk: Partition,
        perm: TeamGroupPermission,
    ) -> Result<Self> {
        if !Self::has_permission(cli, &team_pk, &user_pk, perm).await? {
            return Err(PostError::TeamNotFound.into());
        }

        let team_id = Self::team_uuid(&team_pk)?;
        let team = Self::get_by_id(team_id)
            .await?
            .ok_or::<Error>(PostError::TeamNotFound.into())?;

        Ok(team)
    }

    fn team_uuid(team_pk: &Partition) -> Result<Uuid> {
        match team_pk {
            Partition::Team(id) => {
                Uuid::parse_str(id).map_err(|_| PostError::TeamNotFound.into())
            }
            _ => Err(PostError::TeamNotFound.into()),
        }
    }

    pub async fn has_permission(
        cli: &aws_sdk_dynamodb::Client,
        team_pk: &Partition,
        user_pk: &Partition,
        perm: TeamGroupPermission,
    ) -> Result<bool> {
        let Some(role) = Self::get_user_role(cli, team_pk, user_pk).await? else {
            return Ok(false);
        };
        let permissions: TeamGroupPermissions = role.to_legacy_permissions().into();
        Ok(permissions.contains(perm))
    }

    /// Resolve the user's role on this team. `TeamOwner` (Postgres) takes
    /// precedence, then the (DynamoDB) `UserTeam.role`. `None` when the user is
    /// not a member.
    pub async fn get_user_role(
        cli: &aws_sdk_dynamodb::Client,
        team_pk: &Partition,
        user_pk: &Partition,
    ) -> Result<Option<crate::features::social::pages::member::dto::TeamRole>> {
        use crate::features::social::pages::member::dto::TeamRole;
        let team_id = Self::team_uuid(team_pk)?;
        if let Some(owner) = TeamOwner::find_by_team(team_id).await? {
            if owner.user_pk == user_pk.to_string() {
                return Ok(Some(TeamRole::Owner));
            }
        }
        let user_team = crate::features::auth::UserTeam::get_membership(user_pk, team_pk).await?;
        Ok(user_team.map(|ut| ut.role.0))
    }

    pub async fn get_permissions_by_team_pk(
        cli: &aws_sdk_dynamodb::Client,
        team_pk: &Partition,
        user_pk: &Partition,
    ) -> Result<TeamGroupPermissions> {
        let role = Self::get_user_role(cli, team_pk, user_pk)
            .await?
            .unwrap_or_default();
        Ok(role.to_legacy_permissions().into())
    }
}

#[cfg(feature = "server")]
fn extract_team_identifier(parts: &Parts) -> Result<String> {
    let path = parts.uri.path().trim_matches('/');
    let segments: Vec<&str> = path.split('/').filter(|s| !s.is_empty()).collect();

    // Pattern 1: /api/teams/:team_id/... (client-side API call)
    // Pattern 2: /v3/teams/:team_id/... (membership/payment API call)
    for i in 1..segments.len() {
        if segments[i] == "teams" && matches!(segments[i - 1], "api" | "v3") {
            if let Some(&value) = segments.get(i + 1) {
                return Ok(value.to_string());
            }
        }
    }

    // /:username/... (SSR page URL)
    if let Some(&first) = segments.first() {
        if first.eq_ignore_ascii_case("api") {
            return Err(PostError::InvalidTeamContext.into());
        }
        return Ok(first.to_string());
    }

    Err(PostError::InvalidTeamContext.into())
}

/// Resolve a team from a path identifier — either a raw team id (`TeamPartition`)
/// or a `username`.
#[cfg(feature = "server")]
async fn resolve_team_from_identifier(team_id: &str) -> Result<Team> {
    if let Ok(team_pk) = team_id.parse::<TeamPartition>() {
        let team_pk: Partition = team_pk.into();
        if let Partition::Team(id) = &team_pk {
            if let Ok(uuid) = Uuid::parse_str(id) {
                if let Some(team) = Team::get_by_id(uuid).await? {
                    return Ok(team);
                }
            }
        }
    }

    Team::find_by_username(team_id)
        .await?
        .ok_or::<Error>(PostError::TeamNotFound.into())
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for Team
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self> {
        if let Some(team) = parts.extensions.get::<Team>() {
            return Ok(team.clone());
        }

        let team_id = extract_team_identifier(parts)?;
        let team = resolve_team_from_identifier(&team_id).await?;
        parts.extensions.insert(team.clone());

        Ok(team)
    }
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for TeamGroupPermissions
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        if let Some(permissions) = parts.extensions.get::<TeamGroupPermissions>() {
            return Ok(permissions.clone());
        }

        let team = Team::from_request_parts(parts, state).await?;
        let user: Option<crate::features::auth::User> =
            OptionalUser::from_request_parts(parts, state).await?.into();
        let cli = crate::features::posts::config::get().dynamodb();
        let permissions = if let Some(user) = user {
            Team::get_permissions_by_team_pk(cli, &team.partition(), &user.pk())
                .await
                .unwrap_or_else(|_| TeamGroupPermissions::empty())
        } else {
            TeamGroupPermissions::empty()
        };

        parts.extensions.insert(permissions.clone());
        Ok(permissions)
    }
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for crate::features::social::pages::member::dto::TeamRole
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        use crate::features::social::pages::member::dto::TeamRole;
        if let Some(role) = parts.extensions.get::<TeamRole>() {
            return Ok(*role);
        }

        let team = Team::from_request_parts(parts, state).await?;
        let user: Option<crate::features::auth::User> =
            OptionalUser::from_request_parts(parts, state).await?.into();
        let user = user.ok_or(Error::UnauthorizedAccess)?;

        let team_pk = team.partition();
        if let Some(owner) = TeamOwner::find_by_team(team.id).await? {
            if owner.user_pk == user.pk().to_string() {
                parts.extensions.insert(TeamRole::Owner);
                return Ok(TeamRole::Owner);
            }
        }
        let user_team =
            crate::features::auth::UserTeam::get_membership(&user.pk(), &team_pk).await?;
        let role = user_team
            .map(|ut| ut.role.0)
            .ok_or(Error::UnauthorizedAccess)?;

        parts.extensions.insert(role);
        Ok(role)
    }
}
