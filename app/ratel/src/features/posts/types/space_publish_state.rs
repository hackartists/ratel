use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Copy, serde_with::SerializeDisplay, serde_with::DeserializeFromStr, Default, DynamoEnum, Eq, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "PostsSpacePublishState", rename_all = "SCREAMING_SNAKE_CASE"))]
pub enum SpacePublishState {
    #[default]
    Draft,
    Published,
}
