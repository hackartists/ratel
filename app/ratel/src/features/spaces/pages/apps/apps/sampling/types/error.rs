use crate::common::*;
use thiserror::Error;

/// Errors raised by the Sampling app. Everything is a client error except
/// `SaveFailed`, which wraps an internal persistence failure.
#[derive(Debug, Error, Serialize, Deserialize, Translate, Clone, PartialEq, Eq)]
pub enum SpaceSamplingError {
    #[error("sampling app not installed")]
    #[translate(
        en = "The Sampling app is not installed in this space.",
        ko = "이 스페이스에 표본 추출 앱이 설치되어 있지 않습니다."
    )]
    NotEnabled,

    #[error("sampling not configured")]
    #[translate(
        en = "Save the Sampling settings before starting sampling.",
        ko = "표본 추출을 시작하려면 먼저 Sampling 설정을 저장하세요."
    )]
    NotConfigured,

    #[error("sampling required before start")]
    #[translate(
        en = "Run Sampling before starting this space.",
        ko = "이 스페이스는 시작하기 전에 표본 추출을 진행해야 합니다."
    )]
    SamplingRequired,

    #[error("invalid sampling transition")]
    #[translate(
        en = "Sampling can only start while the space is open.",
        ko = "표본 추출은 모집중 상태에서만 시작할 수 있습니다."
    )]
    InvalidTransition,

    #[error("sampling config locked")]
    #[translate(
        en = "Sampling settings can no longer change after sampling has started.",
        ko = "표본 추출이 시작된 후에는 Sampling 설정을 변경할 수 없습니다."
    )]
    ConfigLocked,

    #[error("invalid entry poll")]
    #[translate(
        en = "Choose a prerequisite poll as the entry poll.",
        ko = "엔트리 폴로 사전 참여 설문을 선택하세요."
    )]
    InvalidEntryPoll,

    #[error("invalid sampling dimension")]
    #[translate(
        en = "Sampling items must be distinct single-choice questions of the entry poll.",
        ko = "표본 추출 항목은 엔트리 폴의 서로 다른 단일 선택 문항이어야 합니다."
    )]
    InvalidDimension,

    #[error("invalid population rule")]
    #[translate(
        en = "Population rules must use single-choice questions of the entry poll.",
        ko = "모집단 조건은 엔트리 폴의 단일 선택 문항만 사용할 수 있습니다."
    )]
    InvalidRule,

    #[error("invalid unique question")]
    #[translate(
        en = "Duplicate-prevention questions must be distinct short-answer questions of the entry poll.",
        ko = "중복 참여 방지 문항은 엔트리 폴의 서로 다른 단답형 문항이어야 합니다."
    )]
    InvalidUniqueQuestion,

    #[error("invalid total samples")]
    #[translate(
        en = "The sample size must be at least 1.",
        ko = "표본 수는 1 이상이어야 합니다."
    )]
    InvalidTotal,

    #[error("sampling config outdated")]
    #[translate(
        en = "The entry poll changed after the settings were saved. Save the Sampling settings again.",
        ko = "설정 저장 후 엔트리 폴이 변경되었습니다. Sampling 설정을 다시 저장하세요."
    )]
    ConfigOutdated,

    #[error("space not in sampling")]
    #[translate(
        en = "Entry is only possible while sampling is in progress.",
        ko = "표본 추출 중에만 입장할 수 있습니다."
    )]
    NotSampling,

    #[error("not in population")]
    #[translate(
        en = "You are not part of this space's population.",
        ko = "이 스페이스의 모집단에 포함되어 있지 않습니다."
    )]
    NotInPopulation,

    #[error("sampling cell full")]
    #[translate(
        en = "Your sample group is already full.",
        ko = "해당 표본 그룹의 모집이 마감되어 입장할 수 없습니다."
    )]
    CellFull,

    #[error("not selected")]
    #[translate(
        en = "You were not selected for the sample.",
        ko = "표본으로 선정되지 않아 입장할 수 없습니다."
    )]
    NotSelected,

    #[error("unique answer already entered")]
    #[translate(
        en = "This information has already been used to join the sample.",
        ko = "이미 참여한 정보입니다."
    )]
    AlreadyEntered,

    #[error("sampling save failed")]
    #[translate(
        en = "Failed to save the Sampling data.",
        ko = "Sampling 데이터 저장에 실패했습니다."
    )]
    SaveFailed,
}

#[cfg(feature = "server")]
impl SpaceSamplingError {
    pub fn status_code(&self) -> crate::axum::http::StatusCode {
        use crate::axum::http::StatusCode;
        match self {
            SpaceSamplingError::SaveFailed => StatusCode::INTERNAL_SERVER_ERROR,
            _ => StatusCode::BAD_REQUEST,
        }
    }
}

#[cfg(feature = "server")]
impl dioxus::fullstack::axum::response::IntoResponse for SpaceSamplingError {
    fn into_response(self) -> crate::axum::response::Response {
        use crate::axum::response::IntoResponse;
        (self.status_code(), self.to_string()).into_response()
    }
}

#[cfg(feature = "server")]
impl dioxus::fullstack::AsStatusCode for SpaceSamplingError {
    fn as_status_code(&self) -> crate::axum::http::StatusCode {
        self.status_code()
    }
}
