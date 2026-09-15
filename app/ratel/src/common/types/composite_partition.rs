use std::{fmt::Display, str::FromStr};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

use crate::common::*;

#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[derive(Debug, Clone, SerializeDisplay, DeserializeFromStr, Default, PartialEq, Eq)]
pub struct CompositePartition<T = Partition, S = Partition>(pub T, pub S);

// TypeScript binding (`make gen-ts` only): serialized through `Display` as
// `"{T}##{S}"`, so it is a plain string whatever the parameters are.
#[cfg(feature = "ts-bridge")]
impl<T, S> ts_rs::TS for CompositePartition<T, S> {
    type WithoutGenerics = CompositePartition<(), ()>;

    fn name() -> String {
        "string".to_owned()
    }
    fn inline() -> String {
        "string".to_owned()
    }
    fn inline_flattened() -> String {
        panic!("CompositePartition is a string and cannot be flattened")
    }
    fn decl() -> String {
        panic!("CompositePartition is a string and has no declaration")
    }
    fn decl_concrete() -> String {
        panic!("CompositePartition is a string and has no declaration")
    }
}

impl CompositePartition {
    pub fn user_payment_pk(user_pk: Partition) -> Self {
        CompositePartition(user_pk, Partition::Payment)
    }

    pub fn user_purchase_pk(user_pk: Partition) -> Self {
        CompositePartition(user_pk, Partition::Purchase)
    }

    pub fn team_payment_pk(team_pk: Partition) -> Self {
        CompositePartition(team_pk, Partition::Payment)
    }

    pub fn team_purchase_pk(team_pk: Partition) -> Self {
        CompositePartition(team_pk, Partition::Purchase)
    }
}

impl<T, S> Display for CompositePartition<T, S>
where
    T: Display,
    S: Display,
{
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}##{}", self.0, self.1)
    }
}

impl<T, S> FromStr for CompositePartition<T, S>
where
    T: FromStr<Err: Into<Error>>,
    S: FromStr<Err: Into<Error>>,
{
    type Err = Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        let parts: Vec<&str> = s.splitn(2, "##").collect();
        if parts.len() != 2 {
            return Err(Error::InvalidPartitionKey(
                "invalid composite partition format".to_string(),
            ));
        }
        let part1 = T::from_str(parts[0]).map_err(Into::into)?;
        let part2 = S::from_str(parts[1]).map_err(Into::into)?;
        Ok(CompositePartition(part1, part2))
    }
}

impl From<(Partition, Partition)> for CompositePartition {
    fn from(value: (Partition, Partition)) -> Self {
        CompositePartition(value.0, value.1)
    }
}
