// Postgres-backed models are server-only (the `postgres` crate is gated behind
// the `server` feature). Nothing on web references these types — the only
// former web consumer, `dto::CharacterResponse::from_parts`, is itself
// server-gated.
#[cfg(feature = "server")]
mod character_skill;
#[cfg(feature = "server")]
mod character_xp;
#[cfg(feature = "server")]
mod character_xp_source;

#[cfg(feature = "server")]
pub use character_skill::*;
#[cfg(feature = "server")]
pub use character_xp::*;
#[cfg(feature = "server")]
pub use character_xp_source::*;

/// Log a Postgres error server-side and surface a generic error to the caller.
/// Per `conventions/error-handling.md`: never leak DB internals to the user.
#[cfg(feature = "server")]
pub(crate) fn map_db_err(e: postgres::Error) -> crate::common::Error {
    crate::error!("character postgres error: {e}");
    crate::features::character::types::CharacterError::Internal.into()
}
