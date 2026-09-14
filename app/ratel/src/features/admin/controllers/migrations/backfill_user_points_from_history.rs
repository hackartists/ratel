use crate::common::models::auth::AdminUser;
use crate::features::admin::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct BackfillUserPointsResponse {
    /// Total UserRewardHistory rows scanned (per-event log).
    pub history_rows_scanned: usize,
    /// Rows we couldn't deserialize into `UserRewardHistory`.
    pub history_rows_skipped_invalid: usize,
    /// Distinct user pks with a non-zero summed `point`.
    pub users_with_balance: usize,
    /// User rows whose `points` field was updated.
    pub updated: usize,
    /// Users whose `User.points` was already > 0 — left untouched unless
    /// `overwrite=true`.
    pub skipped_already_set: usize,
    /// Users whose pk has no matching ratel User row.
    pub skipped_user_not_found: usize,
    /// Users whose summed history balance came out to 0 or negative.
    pub skipped_zero_balance: usize,
    /// Sum of all point totals written across all users (sanity total).
    pub total_points_written: i64,
    /// When set, no writes actually happen — the response is what *would*
    /// have been written.
    pub dry_run: bool,
}

/// Backfill `User.points` from local `UserRewardHistory` rows.
///
/// Why this exists: with the Scope-A refactor, `User.points` became the
/// authoritative current balance on ratel — credited atomically with
/// every reward write, debited by Launchpad conversions. Users who
/// earned points BEFORE that refactor have their points only in the
/// event log (`UserRewardHistory`) — never propagated to `User.points`.
/// This migration sums every per-event `point` per user and writes the
/// total to `User.points` so the rewards page can serve balances from
/// the local ledger alone.
///
/// The event log is what the rewards page renders ("REWARD HISTORY"),
/// so summing it guarantees the displayed balance equals the credited
/// balance.
///
/// UserRewardHistory event-row layout:
/// - `pk    = USER#{uuid}##REWARD` (or `TEAM#{uuid}##REWARD`)
/// - `sk    = SPACE_REWARD##{...}###{period}`  ← `###` distinguishes
///                event rows from aggregate `UserReward` rows.
/// - `point: i64` — amount credited on this event.
///
/// Idempotent by default: users whose `User.points` is already > 0
/// (either Scope-A activity or a previous run) are skipped. Pass
/// `overwrite=true` only when you've reconciled that the recomputed
/// total is what should land — it WILL destroy any Launchpad-side
/// debits applied to `User.points` since the last reward award.
#[post(
    "/api/admin/migrations/backfill-user-points-from-history?dry_run&overwrite",
    _user: AdminUser
)]
pub async fn backfill_user_points_from_history(
    dry_run: Option<bool>,
    overwrite: Option<bool>,
) -> Result<BackfillUserPointsResponse> {
    use crate::common::models::auth::User;
    use crate::common::models::reward::UserRewardHistory;
    use crate::common::types::Partition;
    use postgres::PostgresEntity;
    use std::collections::HashMap;
    use std::str::FromStr;

    let dry_run = dry_run.unwrap_or(false);
    let overwrite = overwrite.unwrap_or(false);

    let mut response = BackfillUserPointsResponse {
        dry_run,
        ..Default::default()
    };

    // ---- Step 1: page through every UserRewardHistory row, sum `point` per user ----
    //
    // Postgres migration note: the old DynamoDB `contains(sk, "###")`
    // filter distinguished per-event `UserRewardHistory` rows from the
    // aggregate `UserReward` rows that shared the same partition. That
    // distinction no longer applies — `UserRewardHistory` now has its own
    // dedicated table (`user_reward_histories`), so every row here is
    // already a per-event row; no filter is needed.
    //
    // Keyed by raw UUID string (not `Partition`) because `Partition`
    // doesn't derive `Hash`. We carry only USER-target rows forward;
    // TEAM rows are filtered out at insert time.
    let mut totals: HashMap<String, i64> = HashMap::new();

    const PAGE_SIZE: i64 = 200;
    let mut page_num: i64 = 1;
    loop {
        let page = UserRewardHistory::repository()
            .find(UserRewardHistory::query().page(page_num).page_size(PAGE_SIZE))
            .await
            .map_err(|e| {
                crate::error!("UserRewardHistory scan failed: {e}");
                crate::common::Error::NotFound(format!("scan failed: {e}"))
            })?;

        if page.items.is_empty() {
            break;
        }

        for h in page.items {
            response.history_rows_scanned += 1;

            match Partition::from_str(&h.target_pk) {
                Ok(Partition::User(uid)) => {
                    let slot = totals.entry(uid).or_insert(0);
                    *slot = slot.saturating_add(h.point);
                }
                Ok(_) => {
                    // Non-User target (e.g. Team) — not handled by this
                    // migration, same as the old `if let Partition::User(..)`
                    // filter.
                }
                Err(e) => {
                    response.history_rows_skipped_invalid += 1;
                    tracing::debug!(error = %e, "failed to parse UserRewardHistory.target_pk");
                }
            }
        }

        if page_num >= page.total_pages {
            break;
        }
        page_num += 1;
    }

    response.users_with_balance = totals.values().filter(|v| **v > 0).count();

    tracing::info!(
        scanned = response.history_rows_scanned,
        skipped_invalid = response.history_rows_skipped_invalid,
        unique_targets = response.users_with_balance,
        dry_run = dry_run,
        overwrite = overwrite,
        "UserRewardHistory rows aggregated for backfill",
    );

    // ---- Step 2: for each target pk, decide and (optionally) write --
    //
    // We only touch `User` rows here. Team rewards live on a separate
    // `Team.points` field and are populated via the same Scope-A path;
    // back-filling team balances is a sibling migration if/when it's
    // needed.
    let now = crate::common::utils::time::get_now_timestamp_millis();

    for (user_uuid, total) in totals.iter() {
        if *total <= 0 {
            response.skipped_zero_balance += 1;
            continue;
        }

        let target_pk = Partition::User(user_uuid.clone());

        let user = match User::find_by_pk(&target_pk).await {
            Ok(Some(u)) => u,
            Ok(None) => {
                response.skipped_user_not_found += 1;
                tracing::debug!(target_pk = %target_pk, "user row not found in ratel");
                continue;
            }
            Err(e) => {
                crate::error!("User::find_by_pk failed for {target_pk}: {e}");
                response.skipped_user_not_found += 1;
                continue;
            }
        };

        // Idempotency guard. A user with `points > 0` either (a) already
        // ran through this migration, (b) has Scope-A credits we'd be
        // about to clobber with a re-sum that includes those same
        // events again, or (c) has a Launchpad debit applied to a
        // historical balance. Re-running without `overwrite=true` is
        // safe and a no-op for them; with `overwrite=true` we set
        // points to the full history sum, which:
        //   - DOES correctly include every reward ever earned,
        //   - DOES undo any Launchpad debit since the corresponding
        //     award (because debits aren't written to history).
        if user.points > 0 && !overwrite {
            response.skipped_already_set += 1;
            continue;
        }

        if dry_run {
            response.updated += 1;
            response.total_points_written = response.total_points_written.saturating_add(*total);
            continue;
        }

        // Direct `points`/`updated_at` set (was `User::updater(..).with_points(..)`).
        {
            use postgres::Value;
            use postgres::sqlx::{Postgres, QueryBuilder};

            let table = User::table_name();
            let mut qb =
                QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET points = "));
            Value::from(*total).push_bind(&mut qb);
            qb.push(", updated_at = ");
            Value::from(now).push_bind(&mut qb);
            qb.push(" WHERE id = ");
            Value::from(user.id).push_bind(&mut qb);

            if let Err(e) = User::repository().db().execute(qb).await {
                crate::error!("User points update failed for {target_pk}: {e}");
                continue;
            }
        }

        response.updated += 1;
        response.total_points_written = response.total_points_written.saturating_add(*total);
    }

    tracing::info!(
        updated = response.updated,
        skipped_already_set = response.skipped_already_set,
        skipped_user_not_found = response.skipped_user_not_found,
        skipped_zero_balance = response.skipped_zero_balance,
        total_points_written = response.total_points_written,
        dry_run = dry_run,
        "User.points backfill complete",
    );

    Ok(response)
}
