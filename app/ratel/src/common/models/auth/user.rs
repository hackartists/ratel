#[cfg(feature = "server")]
use tower_sessions::Session;

use crate::common::types::UserType;
use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Auth user.
///
/// Postgres migration: the DynamoDB single-table identity
/// (`pk = Partition::User(id)`, `sk = EntityType::User`) collapses onto a
/// surrogate `id: Uuid` primary key — that `id` **is** the user id the rest of
/// the app previously carried inside `Partition::User(..)`. The former GSIs
/// (email / username / phone / user_type / created_at) become plain indexed
/// columns; application-level uniqueness checks in the auth controllers are
/// preserved (DynamoDB GSIs were not unique, so no UNIQUE constraint is added
/// here — that would change behaviour).
///
/// The struct stays cross-platform (the client deserializes it as the flattened
/// body of `LoginResponse` / `get_me`), so `PostgresEntity` and its column
/// attributes are `#[cfg_attr(feature = "server", ...)]`-gated. Cross-feature
/// callers keep referencing users by the `Partition::User(..)` **string** form
/// via [`User::pk`]; only the storage layer changed.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, Default, PartialEq)]
// Serialize through `UserWire` so every response carrying a user still emits the
// legacy `pk`/`sk` keys. See `UserWire` for why. Deserialization is unaffected —
// the derive still reads this struct's own fields.
#[serde(into = "UserWire")]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "users"))]
pub struct User {
    /// Surrogate primary key = the user id (was the payload of
    /// `Partition::User(..)`). Minted `now_v7` by the constructors so a
    /// cross-feature reference built from `pk()` **before** the row is inserted
    /// stays valid (login flows link `UserPhoneNumber` / `UserTelegram` in the
    /// same transaction).
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    pub display_name: String,
    pub profile_url: String,
    #[cfg_attr(feature = "server", postgres(index))]
    pub email: String,
    // NOTE: username is linked with gsi2-index of team model.
    #[cfg_attr(feature = "server", postgres(index))]
    pub username: String,
    #[serde(default)]
    #[cfg_attr(feature = "server", postgres(index))]
    pub phone: Option<String>,

    pub term_agreed: bool,
    pub informed_agreed: bool,

    #[cfg_attr(feature = "server", postgres(index))]
    pub user_type: UserType,

    pub followers_count: i64,
    pub followings_count: i64,

    // profile contents
    pub description: String,
    pub password: Option<String>,

    pub points: i64,

    /// Cross-posting onboarding (FR-2 #13). `false` for fresh signups; flipped
    /// to `true` once the user clicks Continue / Skip on the post-signup
    /// "Connect your networks" interstitial, or completes any connection on
    /// it. Existing rows without this attribute deserialize as `false` (one
    /// extra interstitial impression after the field rolls out — acceptable).
    #[serde(default)]
    pub interstitial_seen: bool,

    /// Soft-deletion timestamp (ms). `None` for active accounts. When set, the
    /// account is tombstoned: `email`/`username` are anonymized so the original
    /// identifiers are freed for re-signup, and auth/login paths reject the row.
    /// Existing rows without this attribute deserialize as `None`.
    #[serde(default)]
    pub deleted_at: Option<i64>,
}

impl User {
    pub fn did(&self) -> String {
        format!("did:web:ratel.foundation:{}", self.username)
    }

    /// The bare user id string (was the payload of `Partition::User(..)`).
    pub fn id(&self) -> String {
        self.id.to_string()
    }

    /// The `Partition::User(..)` form of this user's id. Cross-feature code that
    /// still stores user references as `"USER#.."` partition strings uses this
    /// where it used to read the `pk` field directly.
    pub fn pk(&self) -> Partition {
        Partition::User(self.id.to_string())
    }
}

/// The wire form of [`User`]. Identical to `User` plus the legacy `pk`/`sk` keys.
///
/// WHY THIS EXISTS
/// ---------------
/// The shipped Android build (the last release before the DynamoDB→Postgres cut)
/// deserializes `User` with
///
/// ```ignore
/// pub pk: Partition,     // required — no #[serde(default)]
/// pub sk: EntityType,    // required — no #[serde(default)]
/// ```
///
/// Moving the model to Postgres replaced those keys with `id`, which silently
/// changed the *wire contract* as well as the storage layout: the struct is both
/// the table row and the API response body. That build now fails to parse every
/// response carrying a user — login, signup, `/api/auth/me`, account switching —
/// with `missing field 'pk'`, surfacing in the app as a bare "internal error".
/// Verification-code endpoints kept working because their response
/// (`{"expired_at":..}`) carries no user, which is why mail still arrives while
/// login does not.
///
/// Both keys are derivable from `id` (`pk = USER#{id}`, `sk = USER`), so they are
/// recomputed on the way out rather than stored — no column, no schema version
/// bump, no checksum change. Newer clients ignore the two extra keys.
///
/// Adding a field to `User` without adding it here is a compile error, so the two
/// cannot drift.
#[derive(serde::Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UserWire {
    /// `Partition::User(id)` — renders as `USER#{id}`.
    pub pk: Partition,
    /// Always `EntityType::User`; the old model had one row shape per user.
    pub sk: EntityType,

    pub id: Uuid,
    pub created_at: i64,
    pub updated_at: i64,
    pub display_name: String,
    pub profile_url: String,
    pub email: String,
    pub username: String,
    pub phone: Option<String>,
    pub term_agreed: bool,
    pub informed_agreed: bool,
    pub user_type: UserType,
    pub followers_count: i64,
    pub followings_count: i64,
    pub description: String,
    pub password: Option<String>,
    pub points: i64,
    pub interstitial_seen: bool,
    pub deleted_at: Option<i64>,
}

impl From<User> for UserWire {
    fn from(u: User) -> Self {
        Self {
            pk: Partition::User(u.id.to_string()),
            sk: EntityType::User,

            id: u.id,
            created_at: u.created_at,
            updated_at: u.updated_at,
            display_name: u.display_name,
            profile_url: u.profile_url,
            email: u.email,
            username: u.username,
            phone: u.phone,
            term_agreed: u.term_agreed,
            informed_agreed: u.informed_agreed,
            user_type: u.user_type,
            followers_count: u.followers_count,
            followings_count: u.followings_count,
            description: u.description,
            password: u.password,
            points: u.points,
            interstitial_seen: u.interstitial_seen,
            deleted_at: u.deleted_at,
        }
    }
}

// ── UserType Postgres column codec ─────────────────────────────────────────
// `UserType` lives in the shared `common::types` crate module and cannot derive
// `PostgresEnum` there. It is a `#[repr(u8)]` `serde_repr` enum, so it is stored
// in a `SMALLINT` column using the SAME numeric discriminants DynamoDB used
// (serde_repr also wrote the numbers), keeping the representation identical.
#[cfg(feature = "server")]
mod user_type_pg {
    use super::UserType;

    impl postgres::PostgresType for UserType {
        type Op = postgres::ops::NumOp<i16>;
        fn sql_type() -> postgres::SqlType {
            postgres::SqlType::SmallInt
        }
        fn migration_default_sql() -> Option<&'static str> {
            // UserType::Individual == 1 (the enum default).
            Some("1")
        }
    }

    impl From<UserType> for postgres::Value {
        fn from(v: UserType) -> Self {
            postgres::Value::I16(v as i16)
        }
    }

    impl postgres::sqlx::Type<postgres::sqlx::Postgres> for UserType {
        fn type_info() -> postgres::sqlx::postgres::PgTypeInfo {
            <i16 as postgres::sqlx::Type<postgres::sqlx::Postgres>>::type_info()
        }
        fn compatible(ty: &postgres::sqlx::postgres::PgTypeInfo) -> bool {
            <i16 as postgres::sqlx::Type<postgres::sqlx::Postgres>>::compatible(ty)
        }
    }

    impl<'q> postgres::sqlx::Encode<'q, postgres::sqlx::Postgres> for UserType {
        fn encode_by_ref(
            &self,
            buf: &mut postgres::sqlx::postgres::PgArgumentBuffer,
        ) -> std::result::Result<postgres::sqlx::encode::IsNull, postgres::sqlx::error::BoxDynError>
        {
            <i16 as postgres::sqlx::Encode<'q, postgres::sqlx::Postgres>>::encode(*self as i16, buf)
        }
    }

    impl<'r> postgres::sqlx::Decode<'r, postgres::sqlx::Postgres> for UserType {
        fn decode(
            value: postgres::sqlx::postgres::PgValueRef<'r>,
        ) -> std::result::Result<Self, postgres::sqlx::error::BoxDynError> {
            let raw = <i16 as postgres::sqlx::Decode<'r, postgres::sqlx::Postgres>>::decode(value)?;
            Ok(match raw {
                1 => UserType::Individual,
                2 => UserType::Team,
                3 => UserType::Bot,
                4 => UserType::AnonymousSpaceUser,
                98 => UserType::SystemAdmin,
                99 => UserType::Anonymous,
                // Unknown discriminant → treat as un-privileged anonymous rather
                // than panicking a query. Should never occur for our own writes.
                _ => UserType::Anonymous,
            })
        }
    }
}

#[cfg(feature = "server")]
impl User {
    pub fn new(
        display_name: String,
        email: String,
        profile_url: String,
        term_agreed: bool,
        informed_agreed: bool,
        user_type: UserType,
        username: String,
        password: Option<String>,
    ) -> Self {
        let now = utils::time::now();

        Self {
            id: uuid::Uuid::now_v7(),
            created_at: now,
            updated_at: now,
            display_name,
            email,
            profile_url,
            term_agreed,
            informed_agreed,
            user_type,
            username,
            password,
            ..Default::default()
        }
    }

    pub fn new_phone(phone: String) -> Self {
        let now = utils::time::now();
        let display_name = names::Generator::with_naming(names::Name::Numbered)
            .next()
            .unwrap()
            .replace('-', " ");

        Self {
            id: uuid::Uuid::now_v7(),
            created_at: now,
            updated_at: now,
            display_name: display_name.clone(),
            email: phone.to_string(),
            profile_url: "".to_string(),
            term_agreed: true,
            informed_agreed: false,
            user_type: UserType::Individual,
            username: display_name,
            password: None,
            ..Default::default()
        }
    }

    /// Extract the [`Uuid`] id from a `Partition::User(..)` key, if it is one and
    /// parses. Returns `None` for any other partition or an unparseable id.
    pub fn id_from_partition(pk: &Partition) -> Option<Uuid> {
        match pk {
            Partition::User(uid) => Uuid::parse_str(uid).ok(),
            _ => None,
        }
    }

    /// Load a user by its `Partition::User(..)` key (replaces the old
    /// `User::get(cli, pk, Some(EntityType::User))`).
    pub async fn find_by_pk(pk: &Partition) -> Result<Option<Self>> {
        let Some(id) = Self::id_from_partition(pk) else {
            return Ok(None);
        };
        Self::get_by_id(id).await.map_err(Error::from)
    }

    /// Load a user from a partition **string** (`"USER#.."`).
    pub async fn find_by_pk_str(pk: &str) -> Result<Option<Self>> {
        use std::str::FromStr;
        let Ok(partition) = Partition::from_str(pk) else {
            return Ok(None);
        };
        Self::find_by_pk(&partition).await
    }

    /// First user matching an exact email (replaces gsi3 `find_by_email`).
    pub async fn find_by_email(email: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().email(StringOp::Eq(email.to_string())))
            .await
            .map_err(Error::from)
    }

    /// First user matching an exact username (replaces gsi2 `find_by_username`).
    pub async fn find_by_username(username: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().username(StringOp::Eq(username.to_string())))
            .await
            .map_err(Error::from)
    }

    /// First user matching an exact phone (replaces gsi5 `find_by_phone`).
    pub async fn find_by_phone(phone: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().phone(StringOp::Eq(phone.to_string())))
            .await
            .map_err(Error::from)
    }

    /// Email + hashed-password lookup (replaces the composite gsi1
    /// `find_by_email_and_password`). The password comparison is done in Rust
    /// after the indexed email fetch, so it works regardless of the nullable
    /// password column's query-op ergonomics.
    pub async fn find_by_email_and_password(
        email: &str,
        hashed_password: &str,
    ) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        let page = Self::repository()
            .find(Self::query().email(StringOp::Eq(email.to_string())))
            .await
            .map_err(Error::from)?;
        Ok(page
            .items
            .into_iter()
            .find(|u| u.password.as_deref() == Some(hashed_password)))
    }

    /// All users of a given [`UserType`] (replaces gsi4 `find_by_user_type`).
    pub async fn find_by_user_type(user_type: UserType) -> Result<Vec<Self>> {
        use postgres::ops::NumOp;
        Ok(Self::repository()
            .find(Self::query().user_type(NumOp::Eq(user_type as i16)))
            .await
            .map_err(Error::from)?
            .items)
    }
}

pub const SESSION_KEY_USER_ID: &str = "user_id";

#[cfg(feature = "server")]
async fn extract_user_from_mcp_secret(parts: &Parts) -> Option<User> {
    let auth_header = parts.headers.get("authorization")?.to_str().ok()?;
    debug!("auth header: {}", auth_header);
    if !auth_header.starts_with("McpSecret") {
        return None;
    }

    let raw_secret = auth_header.strip_prefix("McpSecret ")?;
    if raw_secret.is_empty() {
        return None;
    }

    let hashed = crate::common::models::McpClientSecret::hash_secret(raw_secret);
    let secret = crate::common::models::McpClientSecret::find_by_secret_hash(&hashed)
        .await
        .ok()??;
    debug!("found secret: {:?}", secret);

    let user = User::find_by_pk_str(&secret.user_id).await.ok()?;
    debug!("found user: {:?}", user);

    user
}

#[cfg(feature = "server")]
async fn extract_user_from_parts<S>(parts: &mut Parts, state: &S) -> Result<User>
where
    S: Send + Sync,
    Session: FromRequestParts<S, Rejection: std::fmt::Debug>,
{
    if let Some(user) = parts.extensions.get::<User>() {
        return Ok(user.clone());
    }

    // Try MCP secret auth first: Authorization: McpSecret {secret}
    if let Some(user) = extract_user_from_mcp_secret(parts).await {
        parts.extensions.insert(user.clone());
        return Ok(user);
    }

    let session = Session::from_request_parts(parts, state)
        .await
        .map_err(|e| {
            tracing::error!("no session found from request: {:?}", e);
            Error::NoSessionFound
        })?;

    let user_pk: Partition = session
        .get(SESSION_KEY_USER_ID)
        .await
        .map_err(|e| {
            tracing::error!("no user id found from session: {:?}", e);
            Error::NoSessionFound
        })?
        .ok_or(Error::NoSessionFound)?;

    let user = User::find_by_pk(&user_pk).await.map_err(|e| {
        tracing::error!("failed to get user from db: {:?}", e);
        Error::NoSessionFound
    });

    if user.is_err() {
        tracing::error!("no user found: {:?}", user);
        if let Err(e) = session.flush().await {
            tracing::error!("failed to flush session: {:?}", e);
        }
        return Err(Error::NoSessionFound);
    }

    let user = user.unwrap();

    if user.is_none() {
        if let Err(e) = session.flush().await {
            tracing::error!("failed to flush session: {:?}", e);
        }
        return Err(Error::NoSessionFound);
    }

    let user = user.unwrap();
    parts.extensions.insert(user.clone());
    Ok(user)
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for User
where
    S: Send + Sync,
    Session: FromRequestParts<S, Rejection: std::fmt::Debug>,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        tracing::debug!("extracting user from request parts. Path: {:?}", parts.uri);

        extract_user_from_parts(parts, state).await
    }
}

pub struct OptionalUser(pub Option<User>);

impl From<OptionalUser> for Option<User> {
    fn from(value: OptionalUser) -> Self {
        value.0
    }
}

#[cfg(feature = "server")]
impl<S> FromRequestParts<S> for OptionalUser
where
    S: Send + Sync,
    Session: FromRequestParts<S, Rejection: std::fmt::Debug>,
{
    type Rejection = Error;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self> {
        Ok(OptionalUser(extract_user_from_parts(parts, state).await.ok()))
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// A faithful copy of the `User` struct as it exists in the shipped Android
    /// build (commit 38ac1fcd8, 2026-06-12 — the last release before the
    /// DynamoDB→Postgres cut). Field names, types and serde attributes are
    /// copied verbatim from that revision. `pk`/`sk` carry no `#[serde(default)]`
    /// there, which is the whole point of these tests.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedUser {
        pk: Partition,
        sk: EntityType,
        created_at: i64,
        updated_at: i64,
        display_name: String,
        profile_url: String,
        email: String,
        username: String,
        #[serde(default)]
        phone: Option<String>,
        term_agreed: bool,
        informed_agreed: bool,
        user_type: UserType,
        followers_count: i64,
        followings_count: i64,
        description: String,
        password: Option<String>,
        points: i64,
        #[serde(default)]
        interstitial_seen: bool,
    }

    fn sample_user() -> User {
        User {
            id: Uuid::now_v7(),
            username: "victor".into(),
            email: "victor@biyard.co".into(),
            ..Default::default()
        }
    }

    /// The fix: a user serialized by this server is parseable by the shipped app.
    #[test]
    fn shipped_build_can_parse_current_user() {
        let json = serde_json::to_value(sample_user()).expect("serialize");

        assert!(json.get("pk").is_some(), "wire form must carry `pk`");
        assert!(json.get("sk").is_some(), "wire form must carry `sk`");

        serde_json::from_value::<ShippedUser>(json)
            .expect("shipped build must be able to deserialize this");
    }

    /// The bug: drop the two legacy keys — exactly what this server emitted
    /// between the Postgres migration and this patch — and the shipped build
    /// fails. Its transport maps that failure to `Error::Internal`, which the
    /// app renders as a bare "internal error" on login.
    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(sample_user()).expect("serialize");
        let obj = json.as_object_mut().unwrap();
        obj.remove("pk");
        obj.remove("sk");

        let err = serde_json::from_value::<ShippedUser>(json)
            .expect_err("must fail — this is the reported bug");
        assert!(
            err.to_string().contains("missing field `pk`"),
            "expected a missing-`pk` error, got: {err}"
        );
    }

    /// `pk` must round-trip as the `USER#{id}` partition string the old client
    /// stores and sends back on later calls.
    #[test]
    fn legacy_pk_is_the_user_partition_string() {
        let user = sample_user();
        let id = user.id.to_string();
        let json = serde_json::to_value(&user).expect("serialize");

        assert_eq!(json["pk"], serde_json::json!(format!("USER#{id}")));
        assert_eq!(json["sk"], serde_json::json!("USER"));
    }
}
