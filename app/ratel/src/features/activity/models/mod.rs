// Postgres-backed models are server-only (the `postgres` crate is gated behind
// the `server` feature). Nothing on web references these types — the only
// consumers (controllers/services) run their model access inside server-gated
// bodies.
#[cfg(feature = "server")]
mod space_activity;
#[cfg(feature = "server")]
mod space_score;

#[cfg(feature = "server")]
pub use space_activity::*;
#[cfg(feature = "server")]
pub use space_score::*;

/// Log a Postgres error server-side and surface a generic activity error to the
/// caller. Per `conventions/error-handling.md`: never leak DB internals.
#[cfg(feature = "server")]
pub(crate) fn map_db_err(e: postgres::Error) -> crate::common::Error {
    crate::error!("activity postgres error: {e}");
    crate::features::activity::types::ActivityError::AggregationFailed.into()
}
