use crate::common::models::migration::LastBackfillVersion;

/// Run all pending migrations in version order. Gated by `MIGRATE=true`
/// env var: only executes when set, otherwise a no-op. Safe under
/// concurrent replicas — `LastBackfillVersion::advance_to` issues a
/// conditional update so only one replica wins each version bump.
///
/// Operational rule: set `MIGRATE=true` on **exactly one** instance per
/// release (typically a one-shot Lambda / ECS task). The conditional
/// version bump is a safety net, not the primary contention guard.
pub async fn run_migrations(_cli: &aws_sdk_dynamodb::Client) -> crate::common::Result<()> {
    if std::env::var("MIGRATE").as_deref() != Ok("true") {
        tracing::info!("MIGRATE not set — skipping migrations");
        return Ok(());
    }

    let stored = LastBackfillVersion::load()
        .await?
        .map(|r| r.version)
        .unwrap_or(0);

    tracing::info!(stored_version = stored, "migration runner starting");

    // m001 (character XP backfill from SpaceScore) was retired when the
    // CharacterXp / CharacterXpSource models moved from DynamoDB to Postgres.
    // Prod already ran it (version >= 1 stored) and there's nothing for new
    // environments to back-fill against the old Dynamo table anymore.
    let _ = stored;

    // m002 (Biyard PendingReward backfill) was deleted alongside the
    // BiyardService removal. Prod already ran it (version >= 2 stored),
    // and there's nothing for new environments to back-fill anymore.
    // Skip the gate; the version monotonically advances from whatever
    // prod has, and future migrations stack from `if stored < 3`.

    // Future migrations stack additively here:
    //   if stored < 3 { ... advance_to(cli, stored.max(2), 3) ... }

    tracing::info!("migration runner finished");
    Ok(())
}
