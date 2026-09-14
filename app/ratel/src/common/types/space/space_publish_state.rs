use crate::common::*;

#[derive(Debug, Clone, Copy, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum, Eq, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", type = "string"))]
pub enum SpacePublishState {
    #[default]
    Draft,
    Published,
}
