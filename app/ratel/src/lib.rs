#![allow(unused_imports, dead_code, ambiguous_glob_reexports)]
pub mod common;
pub mod config;
mod constants;

pub use crate::common::*;
pub mod features;
pub use features::*;

#[cfg(feature = "tauri-web")]
pub mod tauri;


// `axum` is pulled in transitively through `dioxus-fullstack` and exposed at
// `dioxus::fullstack::axum`. Re-export it here so all in-crate paths can use
// `crate::axum::Router`, `crate::axum::routing::post`, etc. without going
// through `dioxus::fullstack::axum::...` everywhere.
#[cfg(feature = "server")]
pub use dioxus::fullstack::axum;

// `schemars` is pulled in transitively through `rmcp`. The `JsonSchema`
// derive macro emits code that references the `schemars` crate by its
// unqualified name (`schemars::...`), so we need to expose it at the crate
// root for `#[derive(rmcp::schemars::JsonSchema)]` callsites to resolve.
#[cfg(feature = "server")]
pub use rmcp::schemars;

use features::auth::{OptionalUser, User};

// Server-function integration tests (`make test`: `--features server,bypass`).
// Gated on `server` so a `cargo test` of a client build — `make gen-ts` runs
// `--features tauri-web,ts-bridge` — doesn't compile them against client stubs.
#[cfg(all(test, feature = "server"))]
pub mod tests;
