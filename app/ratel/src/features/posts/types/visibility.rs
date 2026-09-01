use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(
    Debug, Clone, PartialEq, Eq, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum,
)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
// Postgres migration: stored as a JSONB scalar (serde string form via
// `SerializeDisplay`, e.g. `"Public"` / `"TeamOnly#<pk>"`). Native PG enums
// cannot represent the `TeamOnly(String)` data variant, so JSONB is used.
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub enum Visibility {
    #[default]
    Public,
    Private,
    TeamOnly(String),
    Broadcast,
}

impl From<SpaceVisibility> for Visibility {
    fn from(space_visibility: SpaceVisibility) -> Self {
        match space_visibility {
            SpaceVisibility::Private => Visibility::Private,
            SpaceVisibility::Public => Visibility::Public,
            SpaceVisibility::Team(team_pk) => Visibility::TeamOnly(team_pk),
        }
    }
}
