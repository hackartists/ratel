use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(
    Debug,
    Clone,
    Copy,
    PartialEq,
    Eq,
    serde_repr::Serialize_repr,
    serde_repr::Deserialize_repr,
    Default,
    EnumProp,
)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema_repr))]
#[repr(u8)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", type = "number"))]
pub enum UserType {
    #[default]
    Individual = 1,
    Team = 2,
    Bot = 3,
    AnonymousSpaceUser = 4,

    SystemAdmin = 98,
    Anonymous = 99,
}
