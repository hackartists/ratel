use crate::features::spaces::pages::apps::apps::file::*;

#[derive(Debug, Clone, PartialEq, Eq, SerializeDisplay, DeserializeFromStr, Default, DynamoEnum)]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", type = "string"))]
pub enum FileLinkTarget {
    #[default]
    Files,
    Overview,
    Board(String),
    Quiz(String),
}
