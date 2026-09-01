use crate::features::auth::OptionalUser;

use crate::features::spaces::pages::actions::actions::quiz::*;

#[mcp_tool(name = "get_quiz", description = "Get quiz details including questions, attempt count, and the current user's score.")]
#[get("/api/spaces/{space_pk}/quizzes/{quiz_id}", role: SpaceUserRole, user: OptionalUser)]
pub async fn get_quiz(
    #[mcp(description = "Space partition key")]
    space_pk: SpacePartition,
    #[mcp(description = "Quiz sort key (e.g. 'SpaceQuiz#<uuid>')")]
    quiz_id: SpaceQuizEntityType,
) -> Result<QuizResponse> {
    SpaceQuiz::can_view(&role)?;
    let space_id = space_pk;

    let quiz = SpaceQuiz::get_one(&space_id, &quiz_id)
        .await?
        .ok_or(Error::NotFound("Quiz not found".into()))?;

    let mut response: QuizResponse = quiz.into();

    let space_action = crate::features::spaces::pages::actions::models::SpaceAction::get_one(
        &space_id,
        &quiz_id.0,
    )
    .await?
    .ok_or(Error::SpaceActionNotFound)?;

    response.title = space_action.title.clone();
    response.description = space_action.description.clone();
    let action_status = space_action.status.clone();
    response.space_action = space_action;

    let is_ended = matches!(
        action_status,
        Some(crate::features::spaces::pages::actions::types::SpaceActionStatus::Finish)
    );

    let mut include_correct_answers = false;

    if let Some(user) = user.0 {
        let max_attempts = response
            .retry_count
            .saturating_add(1)
            .min(MAX_TOTAL_ATTEMPTS);
        let attempts =
            SpaceQuizAttempt::list_by_quiz_user(&quiz_id, &user.pk(), max_attempts as i32)
                .await?;
        response.attempt_count = attempts.len() as i64;
        let has_passed = if let Some(latest) = attempts.first() {
            let passed = latest.score >= response.pass_score;
            response.my_response = Some(latest.answers.0.clone());
            response.my_score = Some(latest.score);
            response.passed = Some(passed);
            passed
        } else {
            false
        };

        // Reveal correct answers only once the quiz is effectively over.
        // This applies to Creators too — while they're viewing the live
        // participant screen (not the editor), answers must stay hidden so
        // nobody ever sees highlighted correct options during an attempt.
        let retries_used_up = attempts.len() as i64 >= max_attempts;
        include_correct_answers = has_passed || retries_used_up || is_ended;
    }

    if include_correct_answers {
        if let Some(answer) = SpaceQuizAnswer::get_one(&space_id, &quiz_id).await? {
            response.correct_answers = Some(answer.answers.0);
        }
    }

    Ok(response)
}
