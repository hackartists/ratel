use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde_repr::Serialize_repr, serde_repr::Deserialize_repr, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema_repr))]
// Postgres migration: stored as a JSONB scalar (serde repr number 1/2/3).
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[repr(u8)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", type = "number"))]
pub enum PostType {
    #[default]
    Post = 1,
    Repost = 2,
    Artwork = 3,
}
