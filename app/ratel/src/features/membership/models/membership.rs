use crate::features::membership::models::Currency;
use crate::features::membership::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
use uuid::Uuid;

pub const ENTERPRISE_MONTHLY_REFILL_CREDITS: i64 = 1_000_000;
pub const ENTERPRISE_MAX_CREDITS_PER_SPACE: i64 = 1_000;

/// Membership tier. Postgres stores it as a `TEXT` column (a `#[postgres(text)]`
/// enum, because the `Enterprise(String)` catch-all can't be a native PG enum).
/// The wire representation is unchanged — `Display`/`FromStr` (via `DynamoEnum`)
/// still drive JSON, so response DTOs keep emitting `"Free"`, `"ENTERPRISE#..."`
/// etc. The DB `pg_label` (snake_case unit labels + raw enterprise inner string)
/// is a separate, internally-consistent channel.
#[derive(
    Debug,
    Clone,
    PartialEq,
    PartialOrd,
    Ord,
    Eq,
    SerializeDisplay,
    DeserializeFromStr,
    Default,
    DynamoEnum,
)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "server", postgres(text))]
pub enum MembershipTier {
    #[default]
    Free,
    Pro,
    Max,
    Vip,
    Enterprise(String),
}

/// Membership lifecycle status. Unit-variant enum → `TEXT` column.
#[derive(
    Debug, Clone, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum, Eq, PartialEq,
)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEnum))]
#[cfg_attr(feature = "server", postgres(text))]
pub enum MembershipStatus {
    #[default]
    Active,
    Expired,
    Cancelled,
    Suspended,
}

/// Membership plan catalog. One row per tier.
///
/// Postgres migration: the DynamoDB identity `pk = Membership(tier)` +
/// `sk = Membership` collapses to a surrogate `id` PK with the natural key
/// `unique(tier)`. The `find_active` GSI (`is_active` + `display_order`) is
/// unused in application code, so `is_active`/`display_order` remain plain
/// columns and the aux GSI sort-key duplicate (`display_order_indexed`) is
/// dropped.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "memberships"))]
pub struct Membership {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(unique))]
    pub tier: MembershipTier,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,

    pub credits: i64,
    pub price_dollars: i64,
    pub price_won: i64,
    pub display_order: i32,
    pub duration_days: i32,
    pub max_credits_per_space: i64,

    pub is_active: bool,
}

#[cfg(feature = "server")]
impl Membership {
    pub fn calculate_remaining_price(&self, currency: Currency, remaining_days: i32) -> i64 {
        if self.duration_days <= 0 || remaining_days <= 0 || remaining_days >= self.duration_days {
            return self.price_in_currency(currency);
        }

        let daily_price = self.price_in_currency(currency) as f64 / self.duration_days as f64;
        let remaining_price = daily_price * remaining_days as f64;
        remaining_price.round() as i64
    }

    pub fn price_in_currency(&self, currency: Currency) -> i64 {
        match currency {
            Currency::Usd => self.price_dollars,
            Currency::Krw => self.price_won,
        }
    }

    /// The catalog row for a tier. Replaces the DynamoDB
    /// `get(Membership(tier), Membership)` point lookup.
    pub async fn get_by_membership_tier(tier: &MembershipTier) -> Result<Self> {
        use postgres::ops::EnumOp;
        Membership::repository()
            .find_one(Membership::query().tier(EnumOp::Eq(tier.clone())))
            .await
            .map_err(crate::common::Error::from)?
            .ok_or_else(|| Error::NotFound("Membership not found".to_string()))
    }
}

#[cfg(feature = "server")]
impl From<Membership> for MembershipResponse {
    fn from(membership: Membership) -> Self {
        Self {
            id: MembershipPartition(membership.tier.to_string()),
            tier: membership.tier,
            price_dollars: membership.price_dollars,
            credits: membership.credits,
            duration_days: membership.duration_days,
            display_order: membership.display_order,
            is_active: membership.is_active,
            created_at: membership.created_at,
            updated_at: membership.updated_at,
            max_credits_per_space: membership.max_credits_per_space,
        }
    }
}

/// A user's current membership. One row per user (`unique(user_pk)`).
///
/// Postgres migration: DynamoDB `pk = <user>` + `sk = UserMembership`
/// collapses to a surrogate `id` with `unique(user_pk)`. `membership_pk` /
/// `next_membership` (formerly `MembershipPartition`) become the `MembershipTier`
/// enum directly — the join to `memberships.tier` is by enum value. `user_pk`
/// holds the owning user's full `Partition` string (`USER#…`), a cross-feature
/// reference, so no `references=` FK yet.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "user_memberships", unique(user_pk)))]
pub struct UserMembership {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub user_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,
    pub expired_at: i64,

    #[cfg_attr(feature = "server", postgres(index))]
    pub membership_pk: MembershipTier,
    pub status: MembershipStatus,

    pub total_credits: i64,
    pub remaining_credits: i64,

    pub auto_renew: bool,
    pub next_membership: Option<MembershipTier>,

    #[serde(default)]
    pub monthly_refill_credits: i64,
    #[serde(default)]
    pub next_refill_at: i64,
}

#[cfg(feature = "server")]
impl UserMembership {
    pub fn new(
        user_pk: UserPartition,
        membership_pk: MembershipTier,
        duration_days: i32,
        credits: i64,
    ) -> Result<Self> {
        let created_at = crate::common::utils::time::now();
        let expired_at = if duration_days <= 0 {
            i64::MAX
        } else {
            created_at + (duration_days as i64) * (24 * 60 * 60 * 1_000)
        };

        let owner: Partition = user_pk.into();

        Ok(Self {
            id: Uuid::now_v7(),
            user_pk: owner.to_string(),
            membership_pk,
            created_at,
            updated_at: created_at,
            expired_at,
            total_credits: credits,
            remaining_credits: credits,
            auto_renew: true,
            status: MembershipStatus::Active,
            next_membership: None,
            monthly_refill_credits: 0,
            next_refill_at: 0,
        })
    }

    pub fn with_auto_renew(mut self, auto_renew: bool) -> Self {
        self.auto_renew = auto_renew;
        self
    }

    /// One membership row per user, keyed by the natural key `user_pk`.
    pub async fn find_by_user(user_pk: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        UserMembership::repository()
            .find_one(UserMembership::query().user_pk(StringOp::Eq(user_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Every membership on a tier — replaces the `find_by_membership` GSI used
    /// by the admin enterprise-membership listing.
    pub async fn find_by_membership_page(
        tier: MembershipTier,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::EnumOp;
        UserMembership::repository()
            .find(
                UserMembership::query()
                    .membership_pk(EnumOp::Eq(tier))
                    .order_by(UserMembershipColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `user_pk`, preserving the surrogate `id`.
    pub async fn save(&self) -> Result<()> {
        UserMembership::repository()
            .upsert_on(&["user_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    pub fn is_infinite(&self) -> bool {
        self.expired_at == i64::MAX
    }

    pub fn day_unit(&self) -> i64 {
        24 * 60 * 60 * 1_000
    }

    pub fn calculate_remaining_duration_days(&self) -> i32 {
        if self.is_infinite() {
            return -1;
        }

        let now = crate::common::utils::time::now();
        if self.expired_at <= now {
            return 0;
        }

        let remaining_millis = self.expired_at - now;
        let remaining_days = remaining_millis / self.day_unit();
        remaining_days as i32
    }

    pub fn renewal_date_rfc_3339(&self) -> Option<String> {
        if self.is_infinite() {
            return None;
        }

        let datetime = chrono::DateTime::from_timestamp_millis(self.expired_at)?;
        Some(datetime.to_rfc3339())
    }

    pub fn needs_monthly_refill(&self, now: i64) -> bool {
        self.monthly_refill_credits > 0 && self.next_refill_at > 0 && now >= self.next_refill_at
    }

    /// Use credits from this membership (validates and deducts locally).
    /// Must be followed by a DB write to persist.
    pub fn use_credits(&mut self, amount: i64) -> Result<()> {
        if self.remaining_credits < amount {
            return Err(SpaceRewardError::CreditsExceedBalance.into());
        }

        self.remaining_credits -= amount;

        Ok(())
    }
}

#[cfg(feature = "server")]
pub async fn ensure_user_membership_monthly_refill(
    mut membership: UserMembership,
) -> Result<UserMembership> {
    let now = crate::common::utils::time::now();
    if !membership.needs_monthly_refill(now) {
        return Ok(membership);
    }

    membership.total_credits = membership.monthly_refill_credits;
    membership.remaining_credits = membership.monthly_refill_credits;
    membership.updated_at = now;

    let mut next_refill_at = membership.next_refill_at;
    while next_refill_at <= now {
        next_refill_at = crate::common::utils::time::add_one_month(next_refill_at)
            .unwrap_or(next_refill_at + 30 * 24 * 60 * 60 * 1_000);
    }
    membership.next_refill_at = next_refill_at;
    membership.save().await?;

    Ok(membership)
}

#[derive(Debug, Clone, Default, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct MembershipResponse {
    pub id: MembershipPartition,
    pub tier: MembershipTier,
    pub price_dollars: i64,
    pub credits: i64,
    pub duration_days: i32,
    pub display_order: i32,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub max_credits_per_space: i64,
}

#[derive(Debug, Clone, Default, PartialEq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct UserMembershipResponse {
    pub tier: MembershipPartition,
    pub expired_at: i64,
    pub total_credits: i64,
    pub remaining_credits: i64,
    pub max_credits_per_space: i64,
    pub next_membership: Option<MembershipPartition>,
}

impl UserMembershipResponse {
    pub fn is_paid(&self) -> bool {
        !self.tier.0.contains("Free")
    }
}

#[cfg(feature = "server")]
impl From<UserMembership> for UserMembershipResponse {
    fn from(user_membership: UserMembership) -> Self {
        Self {
            tier: MembershipPartition(user_membership.membership_pk.to_string()),
            expired_at: user_membership.expired_at,
            total_credits: user_membership.total_credits,
            remaining_credits: user_membership.remaining_credits,
            max_credits_per_space: 0,
            next_membership: user_membership
                .next_membership
                .map(|tier| MembershipPartition(tier.to_string())),
        }
    }
}

// ── Team Membership ──────────────────────────────────────────────────

/// A team's current membership. One row per team (`unique(team_pk)`). Mirrors
/// [`UserMembership`]; `team_pk` holds the team's `Partition` string (`TEAM#…`).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "team_memberships", unique(team_pk)))]
pub struct TeamMembership {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(index))]
    pub team_pk: String,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,
    pub expired_at: i64,

    #[cfg_attr(feature = "server", postgres(index))]
    pub membership_pk: MembershipTier,
    pub status: MembershipStatus,

    pub total_credits: i64,
    pub remaining_credits: i64,

    pub auto_renew: bool,
    pub next_membership: Option<MembershipTier>,
    #[serde(default)]
    pub monthly_refill_credits: i64,
    #[serde(default)]
    pub next_refill_at: i64,
}

#[cfg(feature = "server")]
impl TeamMembership {
    pub fn new(
        team_pk: TeamPartition,
        membership_pk: MembershipTier,
        duration_days: i32,
        credits: i64,
    ) -> Result<Self> {
        let created_at = crate::common::utils::time::now();
        let expired_at = if duration_days <= 0 {
            i64::MAX
        } else {
            created_at + (duration_days as i64) * (24 * 60 * 60 * 1_000)
        };

        let owner: Partition = team_pk.into();

        Ok(Self {
            id: Uuid::now_v7(),
            team_pk: owner.to_string(),
            membership_pk,
            created_at,
            updated_at: created_at,
            expired_at,
            total_credits: credits,
            remaining_credits: credits,
            auto_renew: true,
            status: MembershipStatus::Active,
            next_membership: None,
            monthly_refill_credits: 0,
            next_refill_at: 0,
        })
    }

    pub fn with_auto_renew(mut self, auto_renew: bool) -> Self {
        self.auto_renew = auto_renew;
        self
    }

    pub async fn find_by_team(team_pk: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        TeamMembership::repository()
            .find_one(TeamMembership::query().team_pk(StringOp::Eq(team_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn find_by_membership_page(
        tier: MembershipTier,
        page: i64,
        page_size: i64,
    ) -> Result<postgres::Page<Self>> {
        use postgres::ops::EnumOp;
        TeamMembership::repository()
            .find(
                TeamMembership::query()
                    .membership_pk(EnumOp::Eq(tier))
                    .order_by(TeamMembershipColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn save(&self) -> Result<()> {
        TeamMembership::repository()
            .upsert_on(&["team_pk"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }

    pub fn is_infinite(&self) -> bool {
        self.expired_at == i64::MAX
    }

    pub fn day_unit(&self) -> i64 {
        24 * 60 * 60 * 1_000
    }

    pub fn calculate_remaining_duration_days(&self) -> i32 {
        if self.is_infinite() {
            return -1;
        }

        let now = crate::common::utils::time::now();
        if self.expired_at <= now {
            return 0;
        }

        let remaining_millis = self.expired_at - now;
        let remaining_days = remaining_millis / self.day_unit();
        remaining_days as i32
    }

    pub fn renewal_date_rfc_3339(&self) -> Option<String> {
        if self.is_infinite() {
            return None;
        }

        let datetime = chrono::DateTime::from_timestamp_millis(self.expired_at)?;
        Some(datetime.to_rfc3339())
    }

    pub fn needs_monthly_refill(&self, now: i64) -> bool {
        self.monthly_refill_credits > 0 && self.next_refill_at > 0 && now >= self.next_refill_at
    }

    pub fn use_credits(&mut self, amount: i64) -> Result<()> {
        if self.remaining_credits < amount {
            return Err(SpaceRewardError::CreditsExceedBalance.into());
        }

        self.remaining_credits -= amount;

        Ok(())
    }
}

#[cfg(feature = "server")]
pub async fn ensure_team_membership_monthly_refill(
    mut membership: TeamMembership,
) -> Result<TeamMembership> {
    let now = crate::common::utils::time::now();
    if !membership.needs_monthly_refill(now) {
        return Ok(membership);
    }

    membership.total_credits = membership.monthly_refill_credits;
    membership.remaining_credits = membership.monthly_refill_credits;
    membership.updated_at = now;

    let mut next_refill_at = membership.next_refill_at;
    while next_refill_at <= now {
        next_refill_at = crate::common::utils::time::add_one_month(next_refill_at)
            .unwrap_or(next_refill_at + 30 * 24 * 60 * 60 * 1_000);
    }
    membership.next_refill_at = next_refill_at;
    membership.save().await?;

    Ok(membership)
}

#[derive(Debug, Clone, Default, PartialEq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct TeamMembershipResponse {
    pub tier: MembershipPartition,
    pub expired_at: i64,
    pub total_credits: i64,
    pub remaining_credits: i64,
    pub max_credits_per_space: i64,
    pub next_membership: Option<MembershipPartition>,
}

#[cfg(feature = "server")]
impl From<TeamMembership> for TeamMembershipResponse {
    fn from(team_membership: TeamMembership) -> Self {
        Self {
            tier: MembershipPartition(team_membership.membership_pk.to_string()),
            expired_at: team_membership.expired_at,
            total_credits: team_membership.total_credits,
            remaining_credits: team_membership.remaining_credits,
            max_credits_per_space: 0,
            next_membership: team_membership
                .next_membership
                .map(|tier| MembershipPartition(tier.to_string())),
        }
    }
}
