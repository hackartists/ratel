use crate::common::*;

#[derive(Debug, Default, Clone, Serialize, Deserialize, DynamoEnum, Eq, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum RewardCondition {
    #[default]
    None,
    MaxClaims(i64),
    MaxPoints(i64),
    MaxUserClaims(i64),
    MaxUserPoints(i64),
}
