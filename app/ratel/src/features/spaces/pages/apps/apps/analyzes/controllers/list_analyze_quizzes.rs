use crate::common::ListResponse;
use crate::features::spaces::pages::actions::actions::quiz::{SpaceQuiz, SpaceQuizColumn};
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::apps::apps::analyzes::*;
use crate::features::spaces::pages::apps::models::SpaceApp;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AnalyzeQuizItem {
    pub quiz_id: SpaceQuizEntityType,
    pub title: String,
    pub questions_count: usize,
}

#[mcp_tool(
    name = "list_analyze_quizzes",
    description = "List quizzes in a space available as analyze report sources. Returns id, title (from SpaceAction), and question count. Requires creator role."
)]
#[get("/api/spaces/{space_id}/apps/analyzes/quizzes?bookmark", role: SpaceUserRole)]
pub async fn list_analyze_quizzes(
    #[mcp(description = "Space partition key")] space_id: SpacePartition,
    #[mcp(description = "Pagination bookmark. Omit for first page.")] bookmark: Option<String>,
) -> Result<ListResponse<AnalyzeQuizItem>> {
    use postgres::ops::StringOp;
    use postgres::{Order, PostgresEntity};

    SpaceApp::can_edit(role)?;
    let space_pk: Partition = space_id.clone().into();
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

    let result = SpaceQuiz::repository()
        .find(
            SpaceQuiz::query()
                .space_id(StringOp::Eq(space_id_str))
                .order_by(SpaceQuizColumn::CreatedAt, Order::Desc)
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
    let quizzes = result.items;

    // Quiz title lives on `SpaceAction`, `(space_id, action_id=quiz_id)`.
    // Fetch each title concurrently.
    let action_lookups = quizzes.iter().map(|quiz| {
        let quiz_id = quiz.quiz_id.clone();
        let space_id = space_id.clone();
        async move {
            let title = SpaceAction::get_one(&space_id, &quiz_id)
                .await
                .ok()
                .flatten()
                .map(|a| a.title);
            (quiz_id, title)
        }
    });
    let title_by_quiz_id: std::collections::HashMap<String, String> =
        futures::future::join_all(action_lookups)
            .await
            .into_iter()
            .filter_map(|(quiz_id, title)| title.map(|t| (quiz_id, t)))
            .collect();

    let items = quizzes
        .into_iter()
        .map(|quiz| {
            let title = title_by_quiz_id
                .get(&quiz.quiz_id)
                .cloned()
                .unwrap_or_default();
            AnalyzeQuizItem {
                quiz_id: SpaceQuizEntityType(quiz.quiz_id.clone()),
                title,
                questions_count: quiz.questions.len(),
            }
        })
        .collect();

    Ok(ListResponse { items, bookmark })
}
