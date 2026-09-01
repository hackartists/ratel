// Postgres-backed models are server-only (the `postgres` crate is gated behind
// the `server` feature). Web builds never reference these types — the only
// consumers (controllers) import them inside their server-gated bodies.
#[cfg(feature = "server")]
pub mod space_analyze;
#[cfg(feature = "server")]
pub mod space_report;

#[cfg(feature = "server")]
pub use space_analyze::*;
#[cfg(feature = "server")]
pub use space_report::*;
