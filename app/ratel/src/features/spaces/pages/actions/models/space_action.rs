use crate::features::spaces::pages::actions::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::ops::StringOp;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Opaque jsonb wrapper for the action's dependency list. Stays cross-platform
/// (embedded in `SpaceAction`, which is serialized to the web client); the
/// ORM `PostgresJson` derive is applied only on the server build. `serde`
/// treats the single-field tuple newtype transparently, so the wire form is a
/// bare JSON array — identical to what the client saw before.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
pub struct SpaceActionDependsOn(pub Vec<String>);

impl std::ops::Deref for SpaceActionDependsOn {
    type Target = Vec<String>;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl std::ops::DerefMut for SpaceActionDependsOn {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<Vec<String>> for SpaceActionDependsOn {
    fn from(v: Vec<String>) -> Self {
        Self(v)
    }
}

/// A space action (poll / quiz / discussion / follow / meet companion row).
///
/// Postgres migration: the DynamoDB identity was
/// `pk = CompositePartition(SpacePartition, action_id)` + `sk = SPACE_ACTION`.
/// It becomes a surrogate `id` PK with the former key parts flattened:
/// - `space_id` — cross-feature reference (spaces), bare id, indexed, **no FK**.
/// - `action_id` — the concrete action entity's bare uuid (poll/quiz/post/…).
///   `(space_id, action_id)` is the natural key.
///
/// Stays cross-platform because it is embedded raw in several `*Response` DTOs
/// (meet/poll/quiz/discussion). The `PostgresEntity` derive is server-only.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_actions", unique(space_id, action_id)))]
pub struct SpaceAction {
    #[serde(default)]
    pub id: uuid::Uuid,

    /// Cross-feature reference to the space (bare id).
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_id: String,
    /// The concrete action entity's bare id (poll/quiz/post/follow/meet uuid).
    pub action_id: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    pub title: String,
    pub description: String,
    pub space_action_type: SpaceActionType,
    pub prerequisite: bool,

    pub credits: i64,
    pub total_points: i64,

    #[serde(default)]
    pub activity_score: i64,
    #[serde(default)]
    pub additional_score: i64,

    #[serde(default)]
    pub status: Option<SpaceActionStatus>,

    #[serde(default)]
    pub depends_on: SpaceActionDependsOn,
}

#[cfg(feature = "server")]
impl SpaceAction {
    pub fn new(
        space_id: SpacePartition,
        action_id: String,
        space_action_type: SpaceActionType,
    ) -> Self {
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_id: space_id.0,
            action_id,
            space_action_type,
            title: String::new(),
            description: String::new(),
            prerequisite: false,
            created_at: now,
            updated_at: now,
            credits: 0,
            total_points: 0,
            activity_score: 0,
            additional_score: 0,
            status: Some(SpaceActionStatus::Designing),
            depends_on: SpaceActionDependsOn::default(),
        }
    }

    /// Fetch the single `SpaceAction` row for `(space_id, action_id)`.
    pub async fn get_one(
        space_id: &SpacePartition,
        action_id: &str,
    ) -> crate::common::Result<Option<Self>> {
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .action_id(StringOp::Eq(action_id.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every action row for a space, oldest first (mirrors the DynamoDB
    /// `find_by_space(..).oldest()` scan).
    pub async fn list_by_space(space_id: &SpacePartition) -> crate::common::Result<Vec<Self>> {
        use postgres::Order;
        Self::repository()
            .find(
                Self::query()
                    .space_id(StringOp::Eq(space_id.0.clone()))
                    .order_by(SpaceActionColumn::CreatedAt, Order::Asc),
            )
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }

    /// Persist all in-memory field changes (upsert on the surrogate `id`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert(self)
            .await
            .map_err(crate::common::Error::from)
    }
}

impl SpaceAction {
    /// Build the absolute participant-facing deep link for this action. Used
    /// by inbox + email notifications.
    pub fn get_cta_url(&self) -> String {
        let space_id = SpacePartition(self.space_id.clone());
        let route = Route::SpaceIndexPage { space_id };
        let endpoint = crate::common::CommonConfig::default().env.web_endpoint();
        format!("{}{}", endpoint, route)
    }
}
