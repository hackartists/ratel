use crate::features::spaces::pages::actions::actions::quiz::*;

#[get("/api/spaces/{space_pk}/quizzes/{quiz_id}/answers", role: SpaceUserRole)]
pub async fn get_quiz_answer(
    space_pk: SpacePartition,
    quiz_id: SpaceQuizEntityType,
) -> Result<QuizAnswerResponse> {
    SpaceQuiz::can_edit(&role)?;

    let answer = SpaceQuizAnswer::get_one(&space_pk, &quiz_id)
        .await?
        .ok_or(Error::NotFound("Quiz answer not found".into()))?;

    Ok(answer.into())
}
