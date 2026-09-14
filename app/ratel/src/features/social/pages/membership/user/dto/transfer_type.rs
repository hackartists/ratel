use super::MembershipTier;
use serde;
use super::super::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SocialTransactionType", type = "string"))]
pub enum TransactionType {
    #[default]
    None,

    PurchaseMembership(MembershipTier),
}

impl TryInto<MembershipTier> for TransactionType {
    fn try_into(self) -> Result<MembershipTier> {
        match self {
            TransactionType::PurchaseMembership(tier) => Ok(tier),
            _ => Err(crate::features::social::types::SocialError::InvalidMembershipTier.into()),
        }
    }

    type Error = super::super::Error;
}
