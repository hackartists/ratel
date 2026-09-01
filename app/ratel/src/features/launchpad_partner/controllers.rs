//! Inner callback handlers. Point balance is the local `User.points`
//! (credited by reward awards, debited here). No console (Biyard) reads.

#![cfg(feature = "server")]

use crate::common::models::auth::User;
use crate::common::types::Partition;
use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::launchpad_partner::config::LaunchpadPartnerConfig;
use crate::features::launchpad_partner::error::PartnerError;
use crate::features::launchpad_partner::models::LaunchpadDeduction;
use crate::features::launchpad_partner::types::{
    DeductBody, DeductResponse, HealthResponse, LookupResponse,
};

/// Read the user's local point balance (`User.points`).
pub async fn lookup(company_user_key: &str) -> Result<LookupResponse, PartnerError> {
    let cfg = LaunchpadPartnerConfig::default();

    let user = User::find_by_pk_str(company_user_key)
        .await
        .map_err(|e| {
            crate::error!("launchpad lookup: get user failed: {e}");
            PartnerError::Server
        })?
        .ok_or(PartnerError::UnknownUser)?;

    Ok(LookupResponse {
        available_points: user.points,
        point_symbol: cfg.point_symbol.to_string(),
    })
}

/// Debit `User.points` by the requested amount (idempotent on
/// `idempotency_key`). Rejects when the balance is insufficient.
pub async fn deduct(req: &DeductBody) -> Result<DeductResponse, PartnerError> {
    if req.point_amount <= 0 {
        return Err(PartnerError::InvalidAmount);
    }

    // Idempotency: replay a stored result instead of double-debiting.
    if let Ok(Some(existing)) =
        LaunchpadDeduction::find_by_keys(&req.company_user_key, &req.idempotency_key).await
    {
        return Ok(DeductResponse {
            brand_tx_id: existing.brand_tx_id,
            deducted_points: existing.point_amount,
            remaining_points: existing.remaining_points,
        });
    }

    let user = User::find_by_pk_str(&req.company_user_key)
        .await
        .map_err(|e| {
            crate::error!("launchpad deduct: get user failed: {e}");
            PartnerError::Server
        })?
        .ok_or(PartnerError::UnknownUser)?;
    if user.points < req.point_amount {
        return Err(PartnerError::Insufficient);
    }

    // Atomic decrement — mirrors the old `updater(...).decrease_points(...)`.
    {
        use postgres::PostgresEntity;
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let table = User::table_name();
        let mut qb =
            QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET points = points - "));
        Value::from(req.point_amount).push_bind(&mut qb);
        qb.push(", updated_at = ");
        Value::from(get_now_timestamp_millis()).push_bind(&mut qb);
        qb.push(" WHERE id = ");
        Value::from(user.id).push_bind(&mut qb);

        User::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("launchpad deduct: decrease_points failed: {e}");
            PartnerError::Server
        })?;
    }

    let remaining = user.points - req.point_amount;
    let brand_tx_id = format!("ratel_{}", req.idempotency_key);
    let row = LaunchpadDeduction::new(
        &req.company_user_key,
        &req.idempotency_key,
        req.point_amount,
        &brand_tx_id,
        remaining,
    );
    if let Err(e) = row.create().await {
        crate::error!("launchpad deduct: idempotency row write failed: {e}");
    }

    // D2: record the spend in the reward history as "포인트 교환" (negative).
    // `RewardPeriod::Unlimited` yields a millisecond time-key so each
    // exchange gets a unique row instead of accumulating into one.
    {
        use crate::common::models::reward::UserRewardHistory;
        use crate::common::types::{RewardKey, RewardPeriod, RewardUserBehavior};

        let mut hist = UserRewardHistory::from_params(
            Partition::User(req.company_user_key.clone()),
            RewardKey {
                space_pk: None,
                action_id: None,
                behavior: RewardUserBehavior::RespondPoll,
            },
            &RewardPeriod::Unlimited,
            -req.point_amount,
        );
        hist.action_name = Some("포인트 교환".to_string());
        hist.month = Some(crate::common::utils::time::current_month());
        hist.transaction_id = Some(brand_tx_id.clone());
        if let Err(e) = hist.create().await {
            crate::error!("launchpad deduct: reward-history write failed: {e}");
        }
    }

    Ok(DeductResponse {
        brand_tx_id,
        deducted_points: req.point_amount,
        remaining_points: remaining,
    })
}

/// Health check — no balance read; just confirms config + signature.
pub fn health() -> HealthResponse {
    let cfg = LaunchpadPartnerConfig::default();
    HealthResponse {
        ok: true,
        project_id: cfg.project_id.to_string(),
        service: "ratel".to_string(),
    }
}
