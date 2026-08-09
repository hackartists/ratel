use crate::common::{types::*, utils::time::get_now_timestamp_millis, *};
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Space aggregate root (was DynamoDB `SPACE#{id}` + `SPACE_COMMON`).
///
/// Postgres migration: the single `pk = SPACE#{id}` / `sk = SPACE_COMMON`
/// identity collapses to a surrogate `id` PK with the space's full `Partition`
/// string kept as the `space_pk` natural key (`unique`) so cross-feature
/// look-ups by space partition (`"SPACE#…"`) stay a single-column query.
///
/// `post_pk` and `user_pk` are **cross-feature** references (posts / auth),
/// stored as their full `Partition` strings (`"POST#…"` / `"FEED#…"` /
/// `"USER#…"`) — plain indexed columns, **no FK** for now (FK pass is later).
///
/// `status` / `visibility` / `publish_state` stay their shared `common::types`
/// enum types; their Postgres `TEXT` column codecs live in
/// [`super::pg_enum_glue`] (the shared enums can't derive `PostgresEnum`
/// themselves), so `is_active()` / `is_public()` and every field reader keep
/// working unchanged.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_commons", unique(space_pk)))]
pub struct SpaceCommon {
    #[serde(default)]
    pub id: Uuid,

    /// Natural key — the space's full `Partition` string (`"SPACE#{id}"`).
    pub space_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub status: Option<SpaceStatus>, // Designing, Open, Ongoing, Processing, Finished

    #[cfg_attr(feature = "server", postgres(index))]
    pub visibility: SpaceVisibility, // Private, Public, Team(team_pk)
    #[cfg_attr(feature = "server", postgres(index))]
    pub publish_state: SpacePublishState, // Draft, Published

    /// Cross-feature reference — originating post, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_pk: String,

    #[serde(default)]
    pub content: String,

    /// Cross-feature reference — author user, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
    pub author_username: String,

    pub started_at: Option<i64>,
    pub ended_at: Option<i64>,

    pub custom_booster: Option<i64>,
    pub rewards: Option<i64>,

    #[serde(default)]
    pub reports: i64,

    #[serde(default)]
    pub anonymous_participation: bool,

    #[serde(default)]
    pub join_anytime: bool,

    #[serde(default)]
    pub logo: String,

    #[serde(default)]
    pub participants: i64,

    #[serde(default = "max_quota")]
    pub quota: i64,
    #[serde(default = "max_quota")]
    pub remains: i64,
}

fn max_quota() -> i64 {
    1_000_000
}

impl SpaceCommon {
    pub fn new(
        post_id: FeedPartition,
        user_pk: Partition,
        author_display_name: String,
        author_profile_url: String,
        author_username: String,
    ) -> Self {
        let now = get_now_timestamp_millis();
        let post_pk: Partition = post_id.into();
        let space_pk: Partition = post_pk
            .clone()
            .to_space_pk()
            .expect("Failed to convert post_pk to space_pk");

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            created_at: now,
            updated_at: now,
            post_pk: post_pk.to_string(),
            publish_state: SpacePublishState::Draft,
            status: None,
            visibility: SpaceVisibility::Private,
            user_pk: user_pk.to_string(),
            author_display_name,
            author_profile_url,
            author_username,
            join_anytime: true,
            quota: max_quota(),
            remains: max_quota(),
            ..Default::default()
        }
    }

    /// The space's `Partition` (`"SPACE#{id}"`) parsed back from `space_pk`.
    pub fn partition(&self) -> Partition {
        self.space_pk.parse().unwrap_or_default()
    }

    pub fn should_explicit_participation(&self) -> bool {
        self.anonymous_participation
    }

    pub fn is_published(&self) -> bool {
        self.publish_state == SpacePublishState::Published
    }

    pub fn is_public(&self) -> bool {
        matches!(self.visibility, SpaceVisibility::Public) && self.is_published()
    }

    pub fn is_active(&self) -> bool {
        matches!(self.status, Some(SpaceStatus::Ongoing | SpaceStatus::Open))
    }

    pub fn is_participation_open(&self) -> bool {
        matches!(self.status, Some(SpaceStatus::Open))
            || (self.join_anytime && matches!(self.status, Some(SpaceStatus::Ongoing)))
    }
}

#[cfg(feature = "server")]
impl SpaceCommon {
    /// Point read by space `Partition` (`"SPACE#{id}"`) — replaces the DynamoDB
    /// `get(space_pk, SPACE_COMMON)` read.
    pub async fn get_by_partition(space_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every space authored by a user (`find_by_user_pk` GSI1), newest first.
    pub async fn find_by_user_pk(user_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .order_by(SpaceCommonColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// The space originating from a given post (`find_by_post_pk` GSI2).
    pub async fn find_by_post_pk(post_pk: &Partition) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().post_pk(StringOp::Eq(post_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `space_pk`, preserving the surrogate `id`.
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert_on(&["space_pk"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for SpaceCommon
where
    S: Send + Sync,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self> {
        if let Some(space) = parts.extensions.get::<SpaceCommon>() {
            return Ok(space.clone());
        }
        // URI path differs depending on how this handler is invoked:
        //   - SSR (initial page load):       /spaces/{UUID}/..rest
        //   - Client-side navigation (API):  /api/spaces/{UUID}/..rest
        //
        // Instead of matching a fixed path index, we scan for the "spaces" segment
        // and take the next segment as the space ID, so both cases are handled.
        let mut segments = parts.uri.path().trim_matches('/').split('/');
        let mut space_id_str: Option<&str> = None;
        while let Some(seg) = segments.next() {
            if seg == "spaces" {
                space_id_str = segments.next();
                break;
            }
        }
        let space_id_str = space_id_str.ok_or(Error::MissingSpaceId)?;

        let space_id: SpacePartition = space_id_str.parse()?;
        let space_pk: Partition = space_id.into();
        debug!("Verifying project access for space_id: {}", space_pk);

        let space: SpaceCommon = SpaceCommon::get_by_partition(&space_pk)
            .await
            .map_err(|e| {
                error!("failed to get space common from db: {:?}", e);
                crate::common::Error::SpaceNotFound
            })?
            .ok_or(crate::common::Error::SpaceNotFound)?;
        parts.extensions.insert(space.clone());

        Ok(space)
    }
}
