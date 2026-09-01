use crate::common::{
    models::reward::{UserReward, UserRewardHistory},
    types::*,
    utils::time::get_now_timestamp_millis,
    *,
};
use crate::features::spaces::types::SpaceError;
use postgres::PostgresEntity;
use std::str::FromStr;
use uuid::Uuid;

/// jsonb wrapper for the reward's [`RewardPeriod`] (a common-owned enum that
/// cannot derive `PostgresJson` from here).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct RewardPeriodJson(pub RewardPeriod);

/// jsonb wrapper for the reward's [`RewardCondition`] (common-owned enum).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct RewardConditionJson(pub RewardCondition);

/// A space-scoped reward configuration.
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = RewardKey { space_pk, action_id, behavior }`. It collapses to the
/// natural key `(space_id, action_id, behavior)` (composite UNIQUE) on a
/// surrogate `id` PK. `behavior` is stored as its `RewardUserBehavior` Display
/// string; `period` / `condition` are opaque jsonb wrappers. The running
/// `total_points` / `total_claims` counters are bumped with atomic SQL
/// (`… SET c = c + $d`) — mirroring the original atomic DynamoDB `ADD`.
///
/// `space_id` is a cross-feature reference (spaces) — plain column, **no FK**.
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "space_rewards", unique(space_id, action_id, behavior))]
pub struct SpaceReward {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    pub action_id: String,
    /// `RewardUserBehavior` Display form (natural-key part).
    pub behavior: String,

    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub description: String,

    pub credits: i64,
    pub point: i64,

    pub total_points: i64,
    pub total_claims: i64,

    pub period: RewardPeriodJson,
    pub condition: RewardConditionJson,
}

impl SpaceReward {
    pub fn can_edit(role: &SpaceUserRole) -> crate::common::Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }

    pub fn get_amount(&self) -> i64 {
        self.point * self.credits
    }

    /// The typed behavior parsed from the stored Display string.
    pub fn behavior_enum(&self) -> RewardUserBehavior {
        RewardUserBehavior::from_str(&self.behavior).unwrap_or_default()
    }

    /// Reconstruct the original DynamoDB-era [`RewardKey`] from the flattened
    /// columns — still the natural identifier that the (un-migrated)
    /// `UserReward` / `UserRewardHistory` models key off.
    pub fn reward_key(&self) -> RewardKey {
        RewardKey::from((
            SpacePartition(self.space_id.clone()),
            self.action_id.clone(),
            self.behavior_enum(),
        ))
    }
}

#[cfg(feature = "server")]
impl SpaceReward {
    pub fn new(
        space_pk: SpacePartition,
        action_id: String,
        behavior: RewardUserBehavior,
        description: String,
        credits: i64,
        point: i64,
        period: RewardPeriod,
        condition: RewardCondition,
    ) -> Self {
        let now = get_now_timestamp_millis();

        Self {
            id: Uuid::now_v7(),
            space_id: space_pk.0,
            action_id,
            behavior: behavior.to_string(),
            created_at: now,
            updated_at: now,
            credits,
            point,
            description,
            period: RewardPeriodJson(period),
            condition: RewardConditionJson(condition),
            total_points: 0,
            total_claims: 0,
        }
    }

    /// Natural-key upsert on `(space_id, action_id, behavior)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "action_id", "behavior"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    pub async fn get_by_action(
        space_pk: SpacePartition,
        action_id: String,
        behavior: RewardUserBehavior,
    ) -> crate::common::Result<Self> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(space_pk.0))
                    .action_id(StringOp::Eq(action_id))
                    .behavior(StringOp::Eq(behavior.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)?
            .ok_or(SpaceRewardError::NotFound.into())
    }

    /// Every reward configured for a space, optionally filtered to one action.
    pub async fn list_by_action(
        space_pk: SpacePartition,
        action_id: Option<String>,
    ) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        let mut query = Self::query().space_id(StringOp::Eq(space_pk.0));
        if let Some(action_id) = action_id {
            query = query.action_id(StringOp::Eq(action_id));
        }
        Self::repository()
            .find(query)
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }

    /// Atomic `total_claims += claims`, `total_points += points` for one
    /// reward. Mirrors the original in-transaction DynamoDB `ADD`.
    async fn increment_totals(
        &self,
        claims_delta: i64,
        points_delta: i64,
        updated_at: i64,
    ) -> crate::common::Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET total_claims = total_claims + "
        ));
        Value::from(claims_delta).push_bind(&mut qb);
        qb.push(", total_points = total_points + ");
        Value::from(points_delta).push_bind(&mut qb);
        qb.push(", updated_at = ");
        Value::from(updated_at).push_bind(&mut qb);
        qb.push(" WHERE space_id = ");
        Value::from(self.space_id.clone()).push_bind(&mut qb);
        qb.push(" AND action_id = ");
        Value::from(self.action_id.clone()).push_bind(&mut qb);
        qb.push(" AND behavior = ");
        Value::from(self.behavior.clone()).push_bind(&mut qb);

        Self::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("space reward totals increment failed: {e}");
            SpaceError::RewardDistributionFailed
        })?;
        Ok(())
    }

    /// Look up the reward for an action and award it to `target_pk` if
    /// configured. Returns `Ok(None)` when no reward exists or the creator
    /// set zero credits (i.e. the action carries no boost) so the caller
    /// can treat "no reward configured" as a normal outcome.
    ///
    /// Postgres migration: dropped the `cli: &aws_sdk_dynamodb::Client`
    /// parameter — every model this touches (`SpaceReward`, `UserReward`,
    /// `UserRewardHistory`, `User`, `Team`) is Postgres-backed now and reads
    /// from the global connection pool.
    pub async fn award_if_configured(
        space_pk: SpacePartition,
        action_id: String,
        behavior: RewardUserBehavior,
        target_pk: Partition,
        owner_pk: Option<Partition>,
    ) -> crate::common::Result<Option<UserReward>> {
        let space_reward =
            match Self::get_by_action(space_pk.clone(), action_id.clone(), behavior.clone()).await {
                Ok(r) => r,
                Err(e) => {
                    tracing::debug!(
                        space_pk = %space_pk,
                        action_id = %action_id,
                        behavior = ?behavior,
                        error = %e,
                        "no space reward configured for action — skipping"
                    );
                    return Ok(None);
                }
            };

        if space_reward.credits <= 0 {
            return Ok(None);
        }

        match Self::award(&space_reward, target_pk.clone(), owner_pk).await {
            Ok(user_reward) => Ok(Some(user_reward)),
            // Repeat claims inside the same period are expected on subsequent
            // activities — swallow them so the event handler stays idempotent.
            Err(e)
                if matches!(
                    e,
                    crate::common::Error::SpaceReward(SpaceRewardError::AlreadyClaimedInPeriod)
                ) =>
            {
                crate::warn!(
                    space_pk = %space_pk,
                    action_id = %action_id,
                    behavior = ?behavior,
                    target_pk = %target_pk,
                    error = %e,
                    "reward already claimed in this period — skipping duplicate claim"
                );
                Ok(None)
            }
            Err(e) => Err(e),
        }
    }

    /// Award a configured reward.
    ///
    /// Postgres migration: `UserReward`, `UserRewardHistory`, `User`, and
    /// `Team` are all Postgres-backed now, so the ledger + balance writes run
    /// inside one `postgres::Tx` transaction — replacing the original
    /// DynamoDB `transact_write_items!`. The actor's `UserRewardHistory`
    /// insert is the idempotency gate: its `UNIQUE(target_pk, reward_key,
    /// time_key)` constraint replaces the old `attribute_not_exists(pk)`
    /// conditional put, and a conflict there rolls back the whole
    /// transaction and maps to `AlreadyClaimedInPeriod`, same as before. The
    /// `SpaceReward` totals row stays a separate atomic `UPDATE` applied
    /// *after* the transaction commits (unchanged ordering from the
    /// pre-migration version, which also applied it post-commit).
    pub async fn award(
        space_reward: &SpaceReward,
        target_pk: Partition,
        owner_pk: Option<Partition>,
    ) -> crate::common::Result<UserReward> {
        if space_reward.credits <= 0 {
            return Err(SpaceRewardError::NoCreditsConfigured.into());
        }

        let now = get_now_timestamp_millis();
        let reward_key = space_reward.reward_key();
        let period = space_reward.period.0.clone();

        let user_reward = UserReward::get_for(&target_pk, &reward_key).await?;

        let (current_user_claims, current_user_points) = user_reward
            .as_ref()
            .map(|reward| (reward.total_claims, reward.total_points))
            .unwrap_or((0, 0));

        match &space_reward.condition.0 {
            RewardCondition::None => {}
            RewardCondition::MaxClaims(max) => {
                if space_reward.total_claims >= *max {
                    return Err(SpaceRewardError::MaxClaimsReached.into());
                }
            }
            RewardCondition::MaxPoints(max) => {
                if space_reward.total_points >= *max {
                    return Err(SpaceRewardError::MaxPointsReached.into());
                }
            }
            RewardCondition::MaxUserClaims(max) => {
                if current_user_claims >= *max {
                    return Err(SpaceRewardError::MaxUserClaimsReached.into());
                }
            }
            RewardCondition::MaxUserPoints(max) => {
                if current_user_points >= *max {
                    return Err(SpaceRewardError::MaxUserPointsReached.into());
                }
            }
        }

        // Apply Money Tree multiplier to the participant payout. Per spec
        // FR14, this MUST NOT affect the creator owner-bonus (which is
        // computed separately from the raw amount inside the Biyard service).
        let raw_amount = space_reward.get_amount();
        let mt_permille = {
            use crate::features::character::leveling::multiplier_permille;
            use crate::features::character::models::CharacterSkill;
            use crate::features::character::types::SkillId;
            CharacterSkill::level_or_zero(&target_pk, SkillId::MoneyTree)
                .await
                .map(multiplier_permille)
                .unwrap_or(1000)
        };
        let amount = crate::features::character::leveling::apply_permille(raw_amount, mt_permille);
        if amount > raw_amount {
            tracing::info!(
                target_pk = %target_pk,
                raw_amount,
                mt_permille,
                bonus = amount - raw_amount,
                "money tree bonus applied"
            );
        }

        // `description = "{space_pk}#{space_title}"` is resolved on the
        // way in so the per-event row carries a human-readable label
        // without forcing the read path to join back to SpaceCommon/Post.
        let description =
            crate::common::models::reward::resolve_reward_description(&reward_key).await;
        let action_name = crate::common::models::reward::resolve_action_name(&reward_key);

        let mut history = UserRewardHistory::from_params(
            target_pk.clone(),
            reward_key.clone(),
            &period,
            space_reward.get_amount(),
        );
        if !description.is_empty() {
            history.description = Some(description.clone());
        }
        if !action_name.is_empty() {
            history.action_name = Some(action_name.clone());
        }

        // Build the OWNER bonus (10%) history row when the space is owned by
        // someone other than the actor. See the original rationale: the
        // owner row is namespaced `OWNER#{actor_uid}#{period}` so it shares
        // the actor row's period-lock semantics.
        let owner_history = if let Some(ref owner) = owner_pk {
            if *owner != target_pk {
                let actor_uid = match &target_pk {
                    Partition::User(id) | Partition::Team(id) => id.clone(),
                    _ => String::new(),
                };
                if actor_uid.is_empty() {
                    None
                } else {
                    let owner_amount = space_reward.get_amount() * 10 / 100;
                    let period_key = period.to_time_key(now);
                    let mut oh = UserRewardHistory::from_params_with_time_key(
                        owner.clone(),
                        reward_key.clone(),
                        format!("OWNER#{}#{}", actor_uid, period_key),
                        owner_amount,
                    );
                    if !description.is_empty() {
                        oh.description = Some(description.clone());
                    }
                    if !action_name.is_empty() {
                        oh.action_name = Some(action_name.clone());
                    }
                    Some(oh)
                }
            } else {
                None
            }
        } else {
            None
        };

        // Execute the ledger + balance writes atomically in one Postgres
        // transaction (replaces the DynamoDB `transact_write_items!`).
        let tx = postgres::Tx::begin().await.map_err(|e| {
            crate::error!("failed to begin reward transaction: {e}");
            crate::common::Error::from(SpaceError::RewardDistributionFailed)
        })?;

        let history_repo = UserRewardHistory::repository().with_tx(&tx);
        if let Err(e) = history_repo.insert(&history).await {
            let _ = tx.rollback().await;
            return Err(Self::map_reward_write_error(e));
        }
        if let Some(ref oh) = owner_history {
            if let Err(e) = history_repo.insert(oh).await {
                let _ = tx.rollback().await;
                return Err(Self::map_reward_write_error(e));
            }
        }

        let updated_user_reward =
            match Self::upsert_increment_user_reward(&tx, &target_pk, &reward_key, amount, now).await
            {
                Ok(r) => r,
                Err(e) => {
                    let _ = tx.rollback().await;
                    return Err(e);
                }
            };

        // Scope-A balance: credit local `points` to the actor (and the
        // owner's 10% bonus) in the same transaction, routing to the User
        // row or the Team row by partition kind.
        if let Err(e) = Self::credit_points_tx(&tx, &target_pk, amount, now).await {
            let _ = tx.rollback().await;
            return Err(e);
        }
        if let Some(ref owner) = owner_pk {
            if *owner != target_pk {
                if let Err(e) =
                    Self::credit_points_tx(&tx, owner, amount * 10 / 100, now).await
                {
                    let _ = tx.rollback().await;
                    return Err(e);
                }
            }
        }

        tx.commit().await.map_err(|e| {
            crate::error!("failed to commit reward transaction: {e}");
            crate::common::Error::from(SpaceError::RewardDistributionFailed)
        })?;

        // `SpaceReward` totals — applied after the ledger/balance transaction
        // commits so the period-lock gate above still governs whether the
        // totals move at all (same post-commit ordering as before migration).
        space_reward
            .increment_totals(1, space_reward.get_amount(), now)
            .await?;

        Ok(updated_user_reward)
    }

    /// Maps a `UserRewardHistory` insert conflict (its
    /// `UNIQUE(target_pk, reward_key, time_key)` constraint) to
    /// `AlreadyClaimedInPeriod` — the Postgres equivalent of the old
    /// DynamoDB `attribute_not_exists(pk)` conditional-put failure. Any
    /// other database error is logged and mapped to a generic failure.
    fn map_reward_write_error(e: postgres::Error) -> crate::common::Error {
        if Self::is_unique_violation(&e) {
            return SpaceRewardError::AlreadyClaimedInPeriod.into();
        }
        crate::error!("failed to write reward transaction: {e}");
        SpaceError::RewardDistributionFailed.into()
    }

    /// `true` when `e` is a Postgres unique-violation (SQLSTATE `23505`).
    fn is_unique_violation(e: &postgres::Error) -> bool {
        match e {
            postgres::Error::Sqlx(postgres::sqlx::Error::Database(db_err)) => {
                db_err.code().as_deref() == Some("23505")
            }
            _ => false,
        }
    }

    /// Atomic upsert-increment of the `(target_pk, reward_key)` aggregate
    /// row inside `tx` — `total_claims += 1`, `total_points += amount`.
    /// Mirrors the original DynamoDB `ADD` update-or-create semantics.
    async fn upsert_increment_user_reward(
        tx: &postgres::Tx,
        target_pk: &Partition,
        reward_key: &RewardKey,
        amount: i64,
        now: i64,
    ) -> crate::common::Result<UserReward> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let repo = UserReward::repository().with_tx(tx);
        let table = UserReward::table_name();
        let id = Uuid::now_v7();

        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "INSERT INTO \"{table}\" (id, target_pk, reward_key, created_at, updated_at, total_claims, total_points) VALUES ("
        ));
        Value::from(id).push_bind(&mut qb);
        qb.push(", ");
        Value::from(target_pk.to_string()).push_bind(&mut qb);
        qb.push(", ");
        Value::from(reward_key.to_string()).push_bind(&mut qb);
        qb.push(", ");
        Value::from(now).push_bind(&mut qb);
        qb.push(", ");
        Value::from(now).push_bind(&mut qb);
        qb.push(", 1, ");
        Value::from(amount).push_bind(&mut qb);
        qb.push(format!(
            ") ON CONFLICT (target_pk, reward_key) DO UPDATE SET \
              total_claims = \"{table}\".total_claims + 1, \
              total_points = \"{table}\".total_points + EXCLUDED.total_points, \
              updated_at = EXCLUDED.updated_at \
              RETURNING id, target_pk, reward_key, created_at, updated_at, total_claims, total_points"
        ));

        let row = repo
            .db()
            .fetch_optional(qb)
            .await
            .map_err(|e| {
                crate::error!("user reward upsert-increment failed: {e}");
                crate::common::Error::from(SpaceError::RewardDistributionFailed)
            })?
            .ok_or_else(|| crate::common::Error::from(SpaceError::RewardDistributionFailed))?;

        UserReward::from_pg_row(&row).map_err(crate::common::Error::from)
    }

    /// Atomic `points += amount` on the actor's `User` or `Team` row,
    /// inside `tx`. Unknown partition kinds are a no-op (mirrors the
    /// original `credit_points` closure, which only matched `User`/`Team`).
    async fn credit_points_tx(
        tx: &postgres::Tx,
        pk: &Partition,
        amount: i64,
        now: i64,
    ) -> crate::common::Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        match pk {
            Partition::User(id) => {
                let Ok(user_id) = Uuid::parse_str(id) else {
                    return Ok(());
                };
                let repo = crate::common::models::auth::User::repository().with_tx(tx);
                let table = crate::common::models::auth::User::table_name();
                let mut qb =
                    QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET points = points + "));
                Value::from(amount).push_bind(&mut qb);
                qb.push(", updated_at = ");
                Value::from(now).push_bind(&mut qb);
                qb.push(" WHERE id = ");
                Value::from(user_id).push_bind(&mut qb);
                repo.db().execute(qb).await.map_err(|e| {
                    crate::error!("failed to credit user points: {e}");
                    crate::common::Error::from(SpaceError::RewardDistributionFailed)
                })?;
            }
            Partition::Team(id) => {
                let Ok(team_id) = Uuid::parse_str(id) else {
                    return Ok(());
                };
                let repo = crate::features::posts::models::Team::repository().with_tx(tx);
                let table = crate::features::posts::models::Team::table_name();
                let mut qb =
                    QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET points = points + "));
                Value::from(amount).push_bind(&mut qb);
                qb.push(", updated_at = ");
                Value::from(now).push_bind(&mut qb);
                qb.push(" WHERE id = ");
                Value::from(team_id).push_bind(&mut qb);
                repo.db().execute(qb).await.map_err(|e| {
                    crate::error!("failed to credit team points: {e}");
                    crate::common::Error::from(SpaceError::RewardDistributionFailed)
                })?;
            }
            _ => {}
        }
        Ok(())
    }
}
