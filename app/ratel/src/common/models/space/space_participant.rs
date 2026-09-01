use super::*;
use crate::common::models::auth::User;
use crate::common::types::*;
use crate::common::utils::time::get_now_timestamp_millis;
use crate::common::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// `kind` column value for a real participation row (was `sk = SPACE_PARTICIPANT`).
pub const PARTICIPANT_KIND: &str = "PARTICIPANT";
/// `kind` column value for an invitation row (was `sk = SPACE_INVITATION`).
pub const INVITATION_KIND: &str = "INVITATION";

/// A space participant or invitation (was DynamoDB
/// `pk = (space_pk, user_pk)` + `sk = SPACE_PARTICIPANT | SPACE_INVITATION`).
///
/// Postgres migration: surrogate `id` PK. The composite `(space, user)` key
/// plus the participant/invitation discriminator collapses to the natural key
/// `unique(space_pk, user_pk, kind)`. `space_pk` / `user_pk` are **cross-feature**
/// references stored as their full `Partition` strings (`"SPACE#…"` / `"USER#…"`)
/// — plain indexed columns, **no FK** for now. `kind` carries the former `sk`
/// discriminator (`PARTICIPANT` / `INVITATION`).
///
/// `user_type` stays the shared `UserType` enum; its `SMALLINT` Postgres column
/// codec is defined in `common/models/auth/user.rs`.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "space_participants", unique(space_pk, user_pk, kind))
)]
pub struct SpaceParticipant {
    #[serde(default)]
    pub id: Uuid,

    /// Cross-feature reference — the space, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,
    /// Cross-feature reference — the user, full `Partition` string.
    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,

    /// Former `sk` discriminator: `PARTICIPANT` or `INVITATION`.
    pub kind: String,

    pub created_at: i64,
    pub display_name: String,
    #[cfg_attr(feature = "server", postgres(index))]
    pub username: String,
    pub profile_url: String,

    pub user_type: UserType,

    /// Records the user's explicit consent to verify the required
    /// attributes for this space (the "I understand and agree…"
    /// checkbox shown when joining).
    #[serde(default)]
    pub informed_agreed: Option<bool>,

    /// `None` for legacy rows — fall back to `created_at`.
    #[serde(default)]
    pub last_activity_at: Option<i64>,
}

impl SpaceParticipant {
    pub fn is_invitation(&self) -> bool {
        self.kind == INVITATION_KIND
    }

    #[cfg(feature = "server")]
    pub fn new(space_pk: Partition, user_pk: Partition) -> Self {
        use names::{Generator, Name};

        let created_at = get_now_timestamp_millis();
        let display_name = Generator::with_naming(Name::Numbered)
            .next()
            .unwrap()
            .replace('-', " ");
        let username = display_name.replace(' ', "-").to_lowercase();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            user_pk: user_pk.to_string(),
            kind: PARTICIPANT_KIND.to_string(),
            created_at,
            display_name,
            username,
            profile_url: "https://metadata.ratel.foundation/ratel/default-profile.png".to_string(),
            user_type: UserType::AnonymousSpaceUser,
            informed_agreed: None,
            last_activity_at: None,
        }
    }

    pub fn new_non_anonymous(space_pk: Partition, user: User) -> Self {
        let created_at = get_now_timestamp_millis();
        let user_pk = user.pk();
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            user_pk: user_pk.to_string(),
            kind: PARTICIPANT_KIND.to_string(),
            created_at,
            display_name: user.display_name,
            username: user.username,
            profile_url: user.profile_url,
            user_type: user.user_type,
            informed_agreed: None,
            last_activity_at: None,
        }
    }

    pub fn invite(space_pk: Partition, user_pk: Partition, display_name: String) -> Self {
        let created_at = get_now_timestamp_millis();
        let username = display_name.replace(' ', "-").to_lowercase();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            user_pk: user_pk.to_string(),
            kind: INVITATION_KIND.to_string(),
            created_at,
            display_name,
            username,
            profile_url: "https://metadata.ratel.foundation/ratel/default-profile.png".to_string(),
            user_type: UserType::AnonymousSpaceUser,
            informed_agreed: None,
            last_activity_at: None,
        }
    }
}

#[cfg(feature = "server")]
impl SpaceParticipant {
    /// The participation row for `(space, user)`, if any (`kind = PARTICIPANT`).
    pub async fn get_participant(
        space_pk: &Partition,
        user_pk: &Partition,
    ) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .kind(StringOp::Eq(PARTICIPANT_KIND.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// The invitation row for `(space, user)`, if any (`kind = INVITATION`).
    pub async fn get_invitation(
        space_pk: &Partition,
        user_pk: &Partition,
    ) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .kind(StringOp::Eq(INVITATION_KIND.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every participation row for a space, newest first (`find_by_space` GSI2).
    pub async fn find_by_space(space_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()))
                    .order_by(SpaceParticipantColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Every space a user participates in (`find_by_user` GSI1), newest first.
    pub async fn find_by_user(user_pk: &Partition) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .user_pk(StringOp::Eq(user_pk.to_string()))
                    .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()))
                    .order_by(SpaceParticipantColumn::CreatedAt, postgres::Order::Desc),
            )
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Prefix search of participants in a space by username (`search_users_by_space`
    /// GSI3). An empty `prefix` returns all participants.
    pub async fn search_users_by_space(space_pk: &Partition, prefix: &str) -> Result<Vec<Self>> {
        use postgres::ops::StringOp;
        let mut query = Self::query()
            .space_pk(StringOp::Eq(space_pk.to_string()))
            .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()));
        if !prefix.is_empty() {
            query = query.username(StringOp::StartsWith(prefix.to_string()));
        }
        Ok(Self::repository()
            .find(query.order_by(SpaceParticipantColumn::Username, postgres::Order::Asc))
            .await
            .map_err(crate::common::Error::from)?
            .items)
    }

    /// Natural-key upsert on `(space_pk, user_pk, kind)`, preserving `id`.
    pub async fn save(&self) -> Result<Self> {
        Self::repository()
            .upsert_on(&["space_pk", "user_pk", "kind"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}

impl From<(Partition, User)> for SpaceParticipant {
    fn from((space_pk, user): (Partition, User)) -> Self {
        SpaceParticipant {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            user_pk: user.pk().to_string(),
            kind: PARTICIPANT_KIND.to_string(),
            created_at: user.created_at,
            display_name: user.display_name,
            username: user.username,
            user_type: user.user_type,
            profile_url: user.profile_url,
            informed_agreed: None,
            last_activity_at: None,
        }
    }
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for SpaceParticipant
where
    S: Send + Sync,
{
    type Rejection = crate::common::Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        let user = User::from_request_parts(parts, state).await?;
        let space: &SpaceCommon = parts.extensions.get().ok_or(Error::SpaceNotFound)?;

        if let Some(sp) = parts.extensions.get::<SpaceParticipant>() {
            return Ok(sp.clone());
        }

        let space_pk = space.partition();
        let participant: SpaceParticipant = if space.should_explicit_participation() {
            SpaceParticipant::get_participant(&space_pk, &user.pk())
                .await
                .map_err(|_| Error::NotFound("user not found".to_string()))?
                .ok_or(Error::NotFound("user not found".to_string()))?
        } else {
            // Auto-create participation record for spaces that do not require
            // explicit participation.
            (space_pk, user).into()
        };

        parts.extensions.insert(participant.clone());

        Ok(participant)
    }
}
