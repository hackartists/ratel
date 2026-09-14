use serde;
use super::super::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, PartialEq, PartialOrd, Ord, Eq, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SocialMembershipTier", type = "string"))]
pub enum MembershipTier {
    #[default]
    Free,
    Pro,
    Max,
    Vip,
    Enterprise(String),
}
