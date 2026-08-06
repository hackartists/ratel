use crate::common::ListResponse;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::poll::{SpacePoll, SpacePollColumn};
use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AnalyzePollItem {
    pub poll_id: SpacePollEntityType,
    pub title: String,
    pub questions_count: usize,
    pub default: bool,
}

#[mcp_tool(
    name = "list_analyze_polls",
    description = "List polls in a space available as analyze report sources. Returns id, title, question count, and whether each is the default poll. Requires creator role."
)]
#[get("/api/spaces/{space_id}/apps/analyzes/polls?bookmark", role: SpaceUserRole)]
pub async fn list_analyze_polls(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Pagination bookmark. Omit for first page.")] bookmark: Option<String>,
) -> Result<ListResponse<AnalyzePollItem>> {
    use postgres::ops::StringOp;
    use postgres::{Order, PostgresEntity};

    SpaceApp::can_edit(role)?;
    let space_pk: Partition = space_id.into();
    let space_id_str = match &space_pk {
        Partition::Space(id) => id.clone(),
        other => other.to_string(),
    };

    const PAGE_SIZE: i64 = 20;
    let page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = SpacePoll::repository()
        .find(
            SpacePoll::query()
                .space_id(StringOp::Eq(space_id_str))
                .order_by(SpacePollColumn::CreatedAt, Order::Desc)
                .page(page)
                .page_size(PAGE_SIZE),
        )
        .await
        .map_err(crate::common::Error::from)?;

    let bookmark = if page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };

    let items = result
        .items
        .into_iter()
        .map(|poll| {
            let default = poll.is_default_poll();
            AnalyzePollItem {
                poll_id: SpacePollEntityType(poll.poll_id.clone()),
                title: poll.title,
                questions_count: poll.questions.len(),
                default,
            }
        })
        .collect();

    Ok(ListResponse { items, bookmark })
}
