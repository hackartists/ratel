use dioxus_translate::Translate;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error, Serialize, Deserialize, Translate, Clone, PartialEq)]
pub enum CharacterError {
    #[error("skill not found")]
    #[translate(en = "Skill not found", ko = "스킬을 찾을 수 없습니다")]
    SkillNotFound,

    #[error("skill not yet released")]
    #[translate(
        en = "This skill is not yet available",
        ko = "아직 출시되지 않은 스킬입니다"
    )]
    SkillNotReleased,

    #[error("insufficient skill points")]
    #[translate(en = "Insufficient skill points", ko = "스킬 포인트가 부족합니다")]
    InsufficientSp,

    #[error("skill at max level")]
    #[translate(
        en = "This skill is already at maximum level",
        ko = "이미 최대 레벨입니다"
    )]
    AlreadyMaxLevel,

    #[error("internal character store error")]
    #[translate(
        en = "Something went wrong",
        ko = "문제가 발생했습니다"
    )]
    Internal,
}

#[cfg(feature = "server")]
impl CharacterError {
    pub fn status_code(&self) -> crate::axum::http::StatusCode {
        // The validation / precondition variants map cleanly to 400 Bad
        // Request (vs. 500, which would be misleading for "v2 skill not yet
        // released" or "you don't have enough SP"). `Internal` is a store /
        // infrastructure failure and is the only 500.
        match self {
            CharacterError::Internal => {
                crate::axum::http::StatusCode::INTERNAL_SERVER_ERROR
            }
            _ => crate::axum::http::StatusCode::BAD_REQUEST,
        }
    }
}
