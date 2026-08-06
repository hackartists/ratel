use crate::features::spaces::pages::apps::apps::file::*;

#[derive(Debug, Clone, PartialEq, Eq, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub enum FileLinkTarget {
    #[default]
    Files,
    Overview,
    Board(String),
    Quiz(String),
}
