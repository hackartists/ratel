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
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
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
// Serialize through `SpaceActionWire` so the shipped mobile build still finds
// the legacy `pk`/`sk`/`space_pk` keys. See `SpaceActionWire`.
#[serde(into = "SpaceActionWire")]
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

/// Wire form of [`SpaceAction`] — identical plus the three legacy key fields.
///
/// Same reason as `UserWire`. This one is embedded raw in the meet / poll / quiz
/// / discussion response DTOs, so a missing key breaks every action screen and
/// the space entry page that renders their cards.
///
/// The DynamoDB identity was `pk = CompositePartition(SpacePartition, action_id)`
/// + `sk = SPACE_ACTION`, plus a separate `space_pk` column — all three
/// recoverable from the `(space_id, action_id)` natural key.
///
/// `credits`/`total_points` need no bridging (`u64`→`i64` is the same JSON
/// number for these counters) and `depends_on` is a `#[serde(transparent)]`
/// newtype over the old `Vec<String>`.
// No `JsonSchema` here: `SpaceAction` itself does not derive it, and
// `SpaceActionDependsOn` has no impl.
#[derive(Serialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SpaceAction"))]
pub struct SpaceActionWire {
    /// `CompositePartition(SpacePartition(space_id), action_id)`.
    pub pk: CompositePartition<SpacePartition, String>,
    /// Always `EntityType::SpaceAction`.
    pub sk: EntityType,
    /// `Partition::Space(space_id)` — the old separate column.
    pub space_pk: Partition,

    pub id: uuid::Uuid,
    pub space_id: String,
    pub action_id: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub title: String,
    pub description: String,
    pub space_action_type: SpaceActionType,
    pub prerequisite: bool,
    pub credits: i64,
    pub total_points: i64,
    pub activity_score: i64,
    pub additional_score: i64,
    pub status: Option<SpaceActionStatus>,
    pub depends_on: SpaceActionDependsOn,
}

impl From<SpaceAction> for SpaceActionWire {
    fn from(a: SpaceAction) -> Self {
        Self {
            pk: CompositePartition(SpacePartition(a.space_id.clone()), a.action_id.clone()),
            sk: EntityType::SpaceAction,
            space_pk: Partition::Space(a.space_id.clone()),

            id: a.id,
            space_id: a.space_id,
            action_id: a.action_id,
            created_at: a.created_at,
            updated_at: a.updated_at,
            title: a.title,
            description: a.description,
            space_action_type: a.space_action_type,
            prerequisite: a.prerequisite,
            credits: a.credits,
            total_points: a.total_points,
            activity_score: a.activity_score,
            additional_score: a.additional_score,
            status: a.status,
            depends_on: a.depends_on,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `SpaceAction`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: CompositePartition<SpacePartition, String>,
        sk: EntityType,
        space_pk: Partition,
        title: String,
    }

    #[test]
    fn shipped_build_can_parse_current_space_action() {
        let a = SpaceAction {
            space_id: "sp1".into(),
            action_id: "ac1".into(),
            title: "t".into(),
            ..Default::default()
        };
        let json = serde_json::to_value(&a).expect("serialize");
        assert_eq!(json["space_pk"], serde_json::json!("SPACE#sp1"));
        assert_eq!(json["sk"], serde_json::json!("SPACE_ACTION"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpaceAction::default()).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `SpaceAction` serializes through
// `SpaceActionWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for SpaceAction {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <SpaceActionWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <SpaceActionWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <SpaceActionWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <SpaceActionWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <SpaceActionWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <SpaceActionWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceActionWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceActionWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <SpaceActionWire as ts_rs::TS>::output_path()
    }
}
