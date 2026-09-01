use super::helpers::*;
use crate::common::models::migration::LastBackfillVersion;

#[by_macros::pg_test]
async fn test_last_backfill_version_default_unset() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    let row = LastBackfillVersion::load().await.unwrap();
    assert!(row.is_none(), "no migration row should exist initially");
}

#[by_macros::pg_test]
async fn test_advance_to_from_zero_inserts() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    LastBackfillVersion::advance_to(0, 1).await.unwrap();
    let row = LastBackfillVersion::load()
        .await
        .unwrap()
        .expect("row should exist after advance");
    assert_eq!(row.version, 1);
}

#[by_macros::pg_test]
async fn test_advance_to_with_correct_expected_succeeds() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    LastBackfillVersion::advance_to(0, 1).await.unwrap();
    LastBackfillVersion::advance_to(1, 2).await.unwrap();
    let row = LastBackfillVersion::load()
        .await
        .unwrap()
        .expect("row should exist");
    assert_eq!(row.version, 2);
}

#[by_macros::pg_test]
async fn test_advance_to_with_wrong_expected_fails() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    LastBackfillVersion::advance_to(0, 1).await.unwrap();
    let res = LastBackfillVersion::advance_to(0, 2).await;
    assert!(res.is_err(), "advancing with stale expected should be rejected");
    let row = LastBackfillVersion::load()
        .await
        .unwrap()
        .expect("row should still be at 1");
    assert_eq!(row.version, 1, "version must not advance on conflict");
}

#[by_macros::pg_test]
async fn test_run_migrations_skips_when_migrate_unset() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    std::env::remove_var("MIGRATE");
    crate::common::migrations::run_migrations(&ctx.ddb).await.unwrap();

    let row = LastBackfillVersion::load().await.unwrap();
    assert!(row.is_none(), "MIGRATE unset must not advance version");
}

#[by_macros::pg_test]
async fn test_run_migrations_runs_m001() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    // Seed a SpaceScore so the backfill has work to do.
    use crate::features::activity::models::SpaceScore;
    use crate::features::activity::types::AuthorPartition;
    let user_pk = ctx.test_user.0.pk();
    let space_part = SpacePartition("seed".into());
    let author = AuthorPartition::from(user_pk.clone());
    let mut s = SpaceScore::new(space_part, author, "u".into(), "".into());
    s.total_score = 5_000;
    s.save().await.unwrap();

    // Exercise the real `run_migrations` entry point. Post-Postgres-migration
    // it is a deliberate **no-op**: the m001 character-XP backfill (SpaceScore →
    // CharacterXp) was retired when `CharacterXp` / `SpaceScore` moved off
    // DynamoDB, and m002 (Biyard PendingReward) was deleted with BiyardService.
    // Backfilling existing data is now the ETL migration's job, not the runtime
    // runner's — so the runner neither advances `LastBackfillVersion` nor seeds
    // CharacterXp for a fresh environment. This test now pins that contract:
    // `run_migrations` with `MIGRATE=true` completes cleanly as a safe no-op.
    // (The version-advance MECHANISM is still covered by the `test_advance_to_*`
    // and idempotency tests in this file.)
    let ddb = ctx.ddb.clone();
    run_with_env("MIGRATE", "true", move || async move {
        crate::common::migrations::run_migrations(&ddb)
            .await
            .expect("run_migrations must succeed as a no-op");
    })
    .await;

    // Retired migrations write nothing: no `LastBackfillVersion` row is created
    // for a fresh environment, and no CharacterXp is backfilled from SpaceScore.
    assert!(
        LastBackfillVersion::load().await.unwrap().is_none(),
        "retired no-op runner must not write a version row on a fresh DB"
    );
    use crate::features::character::models::CharacterXp;
    assert!(
        CharacterXp::get_by_user(&user_pk).await.unwrap().is_none(),
        "retired m001 backfill must not seed CharacterXp"
    );
}

#[by_macros::pg_test]
async fn test_run_migrations_idempotent_at_version() {
    let ctx = TestContext::setup().await;
    reset_migration_state(&ctx.ddb).await;
    // Pre-advance to the latest known migration version so `run_migrations`
    // has nothing to do. Bumping this whenever a new migration lands keeps
    // the "already at HEAD = no-op" invariant honest.
    LastBackfillVersion::advance_to(0, 1).await.unwrap();
    LastBackfillVersion::advance_to(1, 2).await.unwrap();

    let ddb = ctx.ddb.clone();
    run_with_env("MIGRATE", "true", move || async move {
        crate::common::migrations::run_migrations(&ddb).await.unwrap();
    })
    .await;

    let row = LastBackfillVersion::load().await.unwrap().unwrap();
    assert_eq!(row.version, 2, "no further migrations to run");
}

// m002 (backfill_pending_rewards) tests were removed alongside the
// BiyardService deletion; the runner now stops at version 1.
