use crate::features::spaces::pages::actions::actions::quiz::*;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct QuizAnswerResponse {
    pub quiz_id: SpaceQuizEntityType,
    pub space_id: SpacePartition,
    pub created_at: i64,
    pub updated_at: i64,
    pub answers: Vec<QuizCorrectAnswer>,
}

#[cfg(feature = "server")]
impl From<SpaceQuizAnswer> for QuizAnswerResponse {
    fn from(answer: SpaceQuizAnswer) -> Self {
        Self {
            quiz_id: SpaceQuizEntityType(answer.quiz_id),
            space_id: SpacePartition(answer.space_id),
            created_at: answer.created_at,
            updated_at: answer.updated_at,
            answers: answer.answers.0,
        }
    }
}
