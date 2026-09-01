use crate::features::spaces::pages::report::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Per-space analyze document (singleton per space).
///
/// Postgres migration: the DynamoDB identity was `pk = Space(space_id)` +
/// `sk = SpaceAnalyze` (one row per space). It becomes a surrogate `id` PK
/// with the space reference flattened to a plain `space_id` column, unique so
/// the singleton invariant survives (`unique(space_id)`). The embedded
/// analysis payloads (`lda_topics`, `tf_idf`, `remove_topics`, `network`) are
/// opaque jsonb columns (see the newtype wrappers below).
///
/// `space_id` is a cross-feature reference (spaces feature) — plain column,
/// **no FK** for now.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresEntity)]
#[postgres(table = "space_analyzes", unique(space_id))]
pub struct SpaceAnalyze {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,

    #[serde(default)]
    #[postgres(order)]
    pub created_at: i64,

    #[serde(default)]
    pub lda_topics: LdaTopics,
    #[serde(default)]
    pub network: NetworkGraph,
    #[serde(default)]
    pub tf_idf: TfidfRows,
    #[serde(default)]
    pub remove_topics: RemoveTopics,

    #[serde(default)]
    pub html_contents: Option<String>,

    #[serde(default)]
    pub metadata_url: Option<String>,
}

/// jsonb wrapper — bare JSON array of LDA topic rows.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct LdaTopics(pub Vec<TopicRow>);

/// jsonb wrapper — bare JSON array of TF-IDF rows.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct TfidfRows(pub Vec<TfidfRow>);

/// jsonb wrapper — bare JSON array of removed-topic strings.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct RemoveTopics(pub Vec<String>);

#[cfg(feature = "server")]
impl SpaceAnalyze {
    /// The analyze row for a space, if it exists yet.
    pub async fn get_for(space_id: &SpacePartition) -> postgres::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().space_id(StringOp::Eq(space_id.0.clone())))
            .await
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct TopicRow {
    pub topic: String,
    pub keyword: String,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct TfidfRow {
    pub keyword: String,
    pub tf_idf: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
pub struct NetworkGraph {
    pub nodes: Vec<NetworkCentralityRow>,
    pub edges: Vec<NetworkEdgeRow>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct NetworkCentralityRow {
    pub node: String,
    pub degree_centrality: f64,
    pub betweenness_centrality: f64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct NetworkEdgeRow {
    pub source: String,
    pub target: String,
    pub weight: u32,
}
