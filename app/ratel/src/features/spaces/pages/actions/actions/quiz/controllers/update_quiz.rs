use crate::features::spaces::pages::actions::actions::quiz::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateQuizRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub retry_count: Option<i64>,
    #[serde(default)]
    pub pass_score: Option<i64>,
    #[serde(default)]
    pub questions: Option<Vec<Question>>,
    #[serde(default)]
    pub answers: Option<Vec<QuizCorrectAnswer>>,
    #[serde(default)]
    pub files: Option<Vec<File>>,
}

#[mcp_tool(
    name = "update_quiz",
    description = "Update a quiz (title, description, questions, answers, pass_score, retry_count, files). Requires creator role."
)]
#[post("/api/spaces/{space_pk}/quizzes/{quiz_id}", role: SpaceUserRole)]
pub async fn update_quiz(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Quiz sort key (e.g. 'SpaceQuiz#<uuid>')")] quiz_id: SpaceQuizEntityType,
    #[mcp(
        description = "Quiz update data as JSON. Fields: title, description, retry_count, pass_score, questions, answers, files (all optional)"
    )]
    req: UpdateQuizRequest,
) -> Result<String> {
    SpaceQuiz::can_edit(&role)?;
    let space_id = space_pk;

    let mut existing = SpaceQuiz::get_one(&space_id, &quiz_id)
        .await?
        .ok_or(Error::NotFound("Quiz not found".into()))?;

    let now = crate::common::utils::time::get_now_timestamp_millis();
    existing.updated_at = now;

    // Companion SpaceAction (title/description) — mutated only if requested.
    let mut action_title: Option<String> = None;
    let mut action_description: Option<String> = None;
    if let Some(title) = req.title {
        action_title = Some(title);
    }
    if let Some(description) = req.description {
        action_description = Some(description);
    }
    let should_update_action = action_title.is_some() || action_description.is_some();

    if let Some(retry_count) = req.retry_count {
        if retry_count < 0 {
            return Err(SpaceActionQuizError::InvalidRetryCount.into());
        }
        if retry_count.saturating_add(1) > MAX_TOTAL_ATTEMPTS {
            return Err(SpaceActionQuizError::RetryCountExceedsMax.into());
        }
        existing.retry_count = retry_count;
    }

    let mut questions_for_answers: Option<Vec<Question>> = None;
    if let Some(questions) = req.questions {
        if questions.is_empty() {
            return Err(SpaceActionQuizError::EmptyQuestions.into());
        }
        if questions
            .iter()
            .any(|q| !matches!(q, Question::SingleChoice(_) | Question::MultipleChoice(_)))
        {
            return Err(SpaceActionQuizError::UnsupportedQuestionType.into());
        }
        existing.questions = QuizQuestions(questions.clone());
        questions_for_answers = Some(questions);
    }

    if let Some(pass_score) = req.pass_score {
        if pass_score < 0 {
            return Err(SpaceActionQuizError::InvalidPassScore.into());
        }
        existing.pass_score = pass_score;
    }

    if let Some(mut files) = req.files {
        for file in &mut files {
            if file.id.is_empty() {
                file.id = crate::common::uuid::Uuid::now_v7().to_string();
            }
        }
        existing.files = QuizFiles(files);
    }

    SpaceQuiz::repository()
        .upsert(&existing)
        .await
        .map_err(crate::common::Error::from)?;

    // Emit outbox event (Phase 5) — EssenceIndexQuiz rule on SPACE_QUIZ# MODIFY.
    crate::common::events::outbox::EventOutbox::emit_insert(
        crate::common::events::outbox::topic::SPACE_QUIZ,
        &existing,
    )
    .await
    .ok();

    if should_update_action {
        if let Some(mut action) =
            crate::features::spaces::pages::actions::models::SpaceAction::get_one(
                &space_id, &quiz_id.0,
            )
            .await?
        {
            if let Some(title) = action_title {
                action.title = title;
            }
            if let Some(description) = action_description {
                action.description = description;
            }
            action.updated_at = now;
            action.save().await?;
        }
    }

    // Essence re-indexing happens via the DynamoDB Stream pipeline.

    if let Some(answers) = req.answers {
        let questions =
            questions_for_answers.unwrap_or_else(|| existing.questions.0.clone());

        if questions.len() != answers.len() {
            return Err(SpaceActionQuizError::AnswersLengthMismatch.into());
        }
        for (question, answer) in questions.iter().zip(answers.iter()) {
            validate_quiz_answer(question, answer)?;
        }

        let mut answer_row = SpaceQuizAnswer::get_one(&space_id, &quiz_id)
            .await?
            .unwrap_or_else(|| SpaceQuizAnswer::new(space_id.clone(), quiz_id.clone(), vec![]));
        answer_row.answers = QuizCorrectAnswers(answers);
        answer_row.created_at = now;
        answer_row.updated_at = now;
        answer_row.save().await?;
    }

    Ok("success".to_string())
}

fn validate_quiz_answer(question: &Question, answer: &QuizCorrectAnswer) -> Result<()> {
    match (question, answer) {
        (Question::SingleChoice(q), QuizCorrectAnswer::Single { answer }) => {
            if let Some(idx) = answer {
                if *idx < 0 || (*idx as usize) >= q.options.len() {
                    return Err(SpaceActionQuizError::InvalidSingleAnswerIndex.into());
                }
            }
            Ok(())
        }
        (Question::MultipleChoice(q), QuizCorrectAnswer::Multiple { answers }) => {
            if answers
                .iter()
                .any(|idx| *idx < 0 || (*idx as usize) >= q.options.len())
            {
                return Err(SpaceActionQuizError::InvalidMultipleAnswerIndex.into());
            }
            Ok(())
        }
        _ => Err(SpaceActionQuizError::AnswerTypeMismatch.into()),
    }
}
