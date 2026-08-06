// Postgres-backed models are server-only (the `postgres` crate is gated behind
// the `server` feature). No web/component code references these types — every
// caller lives inside a server-gated controller/service body.
#[cfg(feature = "server")]
pub mod attribute_code;
#[cfg(feature = "server")]
pub mod verified_attributes;

#[cfg(feature = "server")]
pub use attribute_code::*;
#[cfg(feature = "server")]
pub use verified_attributes::*;
