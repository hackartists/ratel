use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema_repr))]
// Postgres migration: stored as a JSONB scalar (serde repr number).
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[repr(u8)]
pub enum BoosterType {
    #[default]
    NoBoost = 1,
    X2 = 2,
    X10 = 3,
    X100 = 4,
    Custom = 255,
}
