use crate::features::spaces::pages::actions::actions::poll::*;
#[cfg(feature = "server")]
use crate::common::utils::time::get_now_timestamp_millis;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use std::collections::HashMap;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Opaque jsonb payload holding a poll's aggregated result document. Mirrors
/// how the DynamoDB item stored the whole aggregation nested under one row.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, postgres::PostgresJson)]
pub struct SpacePollResultBody {
    pub summaries: Vec<SpacePollSummary>,
    pub summaries_by_gender: HashMap<String, Vec<SpacePollSummary>>,
    pub summaries_by_age: HashMap<String, Vec<SpacePollSummary>>,
    pub summaries_by_school: HashMap<String, Vec<SpacePollSummary>>,
    pub sample_answers: Vec<SpacePollUserAnswer>,
    pub final_answers: Vec<SpacePollUserAnswer>,
}

/// Aggregated poll result snapshot.
///
/// Postgres migration: the DynamoDB identity was `pk = SpacePartition` +
/// `sk = SPACE_POLL_RESULT`. It becomes a surrogate `id` PK plus `space_id`
/// and one opaque jsonb `body`. Server-only.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize, Deserialize, Default, PostgresEntity)]
#[postgres(table = "space_poll_results", unique(space_id))]
pub struct SpacePollResult {
    pub id: Uuid,

    #[postgres(index)]
    pub space_id: String,

    #[postgres(order)]
    pub created_at: i64,

    pub body: SpacePollResultBody,
}

#[cfg(feature = "server")]
impl SpacePollResult {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        space_pk: Partition,
        summaries: Vec<SpacePollSummary>,
        summaries_by_gender: HashMap<String, Vec<SpacePollSummary>>,
        summaries_by_age: HashMap<String, Vec<SpacePollSummary>>,
        summaries_by_school: HashMap<String, Vec<SpacePollSummary>>,
        sample_answers: Vec<SpacePollUserAnswer>,
        final_answers: Vec<SpacePollUserAnswer>,
    ) -> Self {
        let created_at = get_now_timestamp_millis();
        let space_id = match space_pk {
            Partition::Space(id) => id,
            other => other.to_string(),
        };

        Self {
            id: Uuid::now_v7(),
            space_id,
            created_at,
            body: SpacePollResultBody {
                summaries,
                summaries_by_gender,
                summaries_by_age,
                summaries_by_school,
                sample_answers,
                final_answers,
            },
        }
    }
}
