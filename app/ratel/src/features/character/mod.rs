pub mod controllers;
pub mod dto;
pub mod leveling;
pub mod models;
pub mod services;
pub mod types;

pub use controllers::*;
pub use dto::*;
pub use leveling::*;
pub use models::*;
pub use types::*;

#[allow(unused_imports)]
use crate::common::*;

// Feature-local tests (per the test-layout note in the plan header).
// Compiled only for `cargo test`; never shipped to prod binaries. They drive the
// server functions, so they also need `server` (a client-build `cargo test`,
// e.g. `make gen-ts`, must not compile them).
#[cfg(all(test, feature = "server"))]
mod tests;
