use crate::features::spaces::pages::actions::actions::follow::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Opaque jsonb wrapper for a `UserType` column. `UserType` is a shared
/// `common` enum we must not modify, so it cannot derive `PostgresEnum` here;
/// instead we store it as jsonb (serde_repr int — the same wire form the
/// client already saw). Stays cross-platform because `SpaceFollowAction`
/// embeds it and is returned to the web client.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(transparent)]
pub struct FollowUserType(pub UserType);

impl From<UserType> for FollowUserType {
    fn from(v: UserType) -> Self {
        Self(v)
    }
}

/// A space follow action (singleton-ish per space).
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SpaceActionFollow#{uuid}`. It becomes a surrogate `id` PK plus
/// `space_id` + `follow_id` (the former sk uuid). Stays cross-platform: the
/// `create_follow` endpoint returns it to the web client, which reads
/// `follow_id`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_follow_actions", unique(space_id, follow_id)))]
pub struct SpaceFollowAction {
    #[serde(default)]
    pub id: uuid::Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub space_id: String,
    pub follow_id: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub user_pk: String,
    #[serde(default)]
    pub display_name: String,
    #[serde(default)]
    pub profile_url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub user_type: FollowUserType,
}

impl From<SpaceFollowAction>
    for crate::features::spaces::pages::actions::types::SpaceActionSummary
{
    fn from(follow: SpaceFollowAction) -> Self {
        use crate::features::spaces::pages::actions::types::SpaceActionType;
        let action_id = follow.follow_id;
        Self {
            action_id,
            action_type: SpaceActionType::Follow,
            title: String::new(),
            description: String::new(),
            created_at: follow.created_at,
            updated_at: follow.updated_at,
            total_score: None,
            total_point: None,
            quiz_score: None,
            quiz_total_score: None,
            quiz_passed: None,
            user_participated: false,
            credits: 0,
            prerequisite: false,
            comment_count: None,
            status: None,
            depends_on: Vec::new(),
            dependencies_met: true,
        }
    }
}

#[cfg(feature = "server")]
impl SpaceFollowAction {
    pub fn new(space_pk: SpacePartition) -> Self {
        let follow_id = uuid::Uuid::now_v7().to_string();
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            follow_id,
            created_at: now,
            updated_at: now,
            user_pk: String::new(),
            display_name: String::new(),
            profile_url: String::new(),
            username: String::new(),
            user_type: FollowUserType::default(),
        }
    }

    /// The follow action for a space, if one exists (singleton per space).
    pub async fn find_for_space(space_pk: &SpacePartition) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_pk.0.clone())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// The former sk value as a `SpaceActionFollowEntityType` (bare id).
    pub fn follow_entity_type(&self) -> SpaceActionFollowEntityType {
        SpaceActionFollowEntityType(self.follow_id.clone())
    }

    pub fn can_edit(
        user_role: &SpaceUserRole,
    ) -> crate::features::spaces::pages::actions::actions::follow::Result<()> {
        match user_role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(crate::features::spaces::pages::actions::actions::follow::Error::NoPermission),
        }
    }
}
