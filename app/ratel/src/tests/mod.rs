pub mod macros;
pub mod setup;

// Re-export axum so test files can use `axum::Router`, `axum::http::...`
// after `use super::*;` without each declaring its own `use crate::axum;`.
pub use crate::axum;

// ── Shared live-Postgres test runtime ───────────────────────────────────────
// `#[tokio::test]` spins a *fresh* current-thread runtime per test. The global
// sqlx pool is first-wins: the first test seeds it bound to *its* runtime, and
// when that runtime drops the pool's connections die — every later test then
// reuses the dead pool and hangs on its first DB op (`PoolTimedOut`). The fix
// (mirrors asset's pg_test_support D-015): one process-wide multi-thread runtime
// that never drops, and run every test body on it via `pg_block_on`. A process
// mutex serializes the bodies so they don't race on shared tables. Tests use the
// `#[by_macros::pg_test]` attribute (swapped in for `#[tokio::test]`), which
// expands to a plain `#[test]` fn calling `pg_block_on(async move { … })`.
mod pg_runtime {
    use std::sync::{Mutex, OnceLock};

    static RT: OnceLock<tokio::runtime::Runtime> = OnceLock::new();
    static DB_TEST_LOCK: Mutex<()> = Mutex::new(());

    fn rt() -> &'static tokio::runtime::Runtime {
        RT.get_or_init(|| {
            tokio::runtime::Builder::new_multi_thread()
                .worker_threads(4)
                .enable_all()
                .build()
                .expect("build shared test runtime")
        })
    }

    /// Run a test body on the shared, never-dropped runtime, serialized against
    /// every other `pg_test` body. Keeps the global sqlx pool valid across the
    /// whole test process.
    pub fn pg_block_on<F: std::future::Future<Output = ()>>(fut: F) {
        let _guard = DB_TEST_LOCK
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        rt().block_on(fut);
    }
}

pub use pg_runtime::pg_block_on;

mod arcade_tests;
mod auth_tests;
mod cors_tests;
mod cross_posting_tests;
mod discussion_subscription_tests;
mod discussion_tests;
mod fact_or_fold_tests;
mod get_space_admin_tests;
mod get_space_privacy_consent_tests;
mod home_tests;
mod inbox_helper_tests;
mod launchpad_partner_tests;
mod mcp_tests;
mod meet_action_tests;
mod notifications_tests;
mod poll_privacy_consent_tests;
mod respond_poll_privacy_consent_tests;
mod post_tests;
mod report_tests;
mod required_attributes_gating_tests;
mod sampling_tests;
mod space_action_notification_tests;
mod space_member_tests;
mod space_status_change_tests;
mod sub_team_tests;
mod xp_dedup_tests;

pub use setup::*;
