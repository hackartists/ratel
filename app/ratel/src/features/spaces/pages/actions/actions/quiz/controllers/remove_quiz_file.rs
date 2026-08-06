use crate::features::spaces::pages::actions::actions::quiz::*;
use crate::features::spaces::pages::apps::apps::file::{
    delete_file_link, DeleteFileLinkRequest, FileLinkTarget,
};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RemoveQuizFileRequest {
    pub file_url: String,
}

#[delete("/api/spaces/{space_id}/quizzes/{quiz_id}/files", role: SpaceUserRole)]
pub async fn remove_quiz_file(
    space_id: SpacePartition,
    quiz_id: SpaceQuizEntityType,
    req: RemoveQuizFileRequest,
) -> Result<()> {
    SpaceQuiz::can_edit(&role)?;
    let link_target = FileLinkTarget::Quiz(quiz_id.to_string());

    let mut quiz = SpaceQuiz::get_one(&space_id, &quiz_id)
        .await?
        .ok_or(SpaceActionQuizError::NotFound)?;

    let updated_files: Vec<File> = quiz
        .files
        .iter()
        .filter(|f| f.url.as_ref() != Some(&req.file_url))
        .cloned()
        .collect();

    quiz.files = QuizFiles(updated_files);
    SpaceQuiz::repository()
        .upsert(&quiz)
        .await
        .map_err(crate::common::Error::from)?;

    delete_file_link(
        space_id,
        DeleteFileLinkRequest {
            file_url: req.file_url,
            link_target,
        },
    )
    .await?;

    Ok(())
}
