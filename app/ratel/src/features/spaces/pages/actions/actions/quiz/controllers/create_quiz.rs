use crate::features::spaces::pages::actions::actions::quiz::*;

#[mcp_tool(
    name = "create_quiz",
    description = "Create a new quiz action in a space. Requires creator role."
)]
#[post("/api/spaces/{space_pk}/quizzes", role: SpaceUserRole, _space: crate::common::models::space::SpaceCommon)]
pub async fn create_quiz(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
) -> Result<QuizResponse> {
    SpaceQuiz::can_edit(&role)?;
    let quiz = SpaceQuiz::new(space_pk.clone())?;

    let space_action = crate::features::spaces::pages::actions::models::SpaceAction::new(
        space_pk.clone(),
        quiz.quiz_id.clone(),
        crate::features::spaces::pages::actions::types::SpaceActionType::Quiz,
    );

    let quiz_id = quiz.quiz_entity_type();
    let answers = quiz
        .questions
        .iter()
        .map(QuizCorrectAnswer::for_question)
        .collect::<Vec<_>>();
    let answer = SpaceQuizAnswer::new(space_pk, quiz_id, answers);

    // Insert quiz + companion action + answer key atomically (Postgres).
    let tx = postgres::Tx::begin().await.map_err(|e| {
        crate::error!("Failed to begin tx: {e}");
        SpaceActionQuizError::CreateFailed
    })?;
    SpaceQuiz::repository()
        .with_tx(&tx)
        .insert(&quiz)
        .await
        .map_err(|e| {
            crate::error!("Failed to create quiz: {e}");
            SpaceActionQuizError::CreateFailed
        })?;
    crate::features::spaces::pages::actions::models::SpaceAction::repository()
        .with_tx(&tx)
        .insert(&space_action)
        .await
        .map_err(|e| {
            crate::error!("Failed to create quiz action: {e}");
            SpaceActionQuizError::CreateFailed
        })?;
    SpaceQuizAnswer::repository()
        .with_tx(&tx)
        .insert(&answer)
        .await
        .map_err(|e| {
            crate::error!("Failed to create quiz answer: {e}");
            SpaceActionQuizError::CreateFailed
        })?;
    // Emit outbox event (Phase 5) — EssenceIndexQuiz rule on SPACE_QUIZ# INSERT.
    crate::common::events::outbox::EventOutbox::emit_insert_tx(
        &tx,
        crate::common::events::outbox::topic::SPACE_QUIZ,
        &quiz,
    )
    .await
    .map_err(|_| SpaceActionQuizError::CreateFailed)?;
    tx.commit().await.map_err(|e| {
        crate::error!("Failed to commit quiz: {e}");
        SpaceActionQuizError::CreateFailed
    })?;

    // Essence indexing happens via the DynamoDB Stream pipeline.

    let mut response: QuizResponse = quiz.into();
    response.title = space_action.title.clone();
    response.description = space_action.description.clone();
    response.space_action = space_action;

    Ok(response)
}
