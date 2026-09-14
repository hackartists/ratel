use crate::features::spaces::pages::actions::actions::poll::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(untagged)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum UpdatePollRequest {
    Title { title: String },
    Question { questions: Vec<Question> },
    ResponseEditable { response_editable: bool },
    CanisterUploadEnabled { canister_upload_enabled: bool },
}

#[mcp_tool(
    name = "update_poll",
    description = "Update a poll (title, questions, response_editable). Requires creator role."
)]
#[post("/api/spaces/{space_pk}/polls/{poll_sk}", role: SpaceUserRole)]
pub async fn update_poll(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Poll sort key (e.g. 'SpacePoll#<uuid>')")] poll_sk: SpacePollEntityType,
    #[mcp(
        description = "Poll update data as JSON. Supported variants: {\"title\": \"...\"}, {\"questions\": [...]}, {\"response_editable\": true}"
    )]
    req: UpdatePollRequest,
) -> Result<String> {
    SpacePoll::can_edit(&role)?;
    let space_id = space_pk;

    let now = crate::common::utils::time::get_now_timestamp_millis();

    let mut poll = SpacePoll::get_one(&space_id, &poll_sk)
        .await?
        .ok_or(Error::NotFound("Poll not found".into()))?;
    poll.updated_at = now;

    let mut action_title: Option<String> = None;

    match req {
        UpdatePollRequest::Title { title } => {
            poll.title = title.clone();
            action_title = Some(title);
        }
        UpdatePollRequest::Question { questions } => {
            if questions.is_empty() {
                return Err(SpacePollError::QuestionsEmpty.into());
            }
            poll.questions = PollQuestions(questions);
        }
        UpdatePollRequest::ResponseEditable { response_editable } => {
            poll.response_editable = response_editable;
        }
        UpdatePollRequest::CanisterUploadEnabled {
            canister_upload_enabled,
        } => {
            poll.canister_upload_enabled = canister_upload_enabled;
            // When enabling encrypted upload, force response_editable to false
            // because encrypted votes cannot be edited after submission.
            if canister_upload_enabled {
                poll.response_editable = false;
            }
        }
    }

    SpacePoll::repository()
        .upsert(&poll)
        .await
        .map_err(crate::common::Error::from)?;

    // Emit outbox event (Phase 5) — EssenceIndexPoll rule on SPACE_POLL# MODIFY.
    crate::common::events::outbox::EventOutbox::emit_insert(
        crate::common::events::outbox::topic::SPACE_POLL,
        &poll,
    )
    .await
    .ok();

    if let Some(title) = action_title {
        if let Some(mut action) = SpaceAction::get_one(&space_id, &poll_sk.0).await? {
            action.title = title;
            action.updated_at = now;
            action.save().await?;
        }
    }

    // Essence re-indexing happens via the DynamoDB Stream pipeline.

    Ok("success".to_string())
}
