use crate::features::spaces::pages::actions::actions::poll::*;

use super::condition::QuestionCondition;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "snake_case", tag = "answer_type")]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum Question {
    SingleChoice(ChoiceQuestion),
    MultipleChoice(ChoiceQuestion),
    ShortAnswer(SubjectiveQuestion),
    Subjective(SubjectiveQuestion),
    Checkbox(CheckboxQuestion),
    Dropdown(DropdownQuestion),
    LinearScale(LinearScaleQuestion),
    PrivacyConsent(PrivacyConsentQuestion),
}

impl Default for Question {
    fn default() -> Self {
        Self::SingleChoice(ChoiceQuestion::default())
    }
}

impl Question {
    pub fn title(&self) -> &str {
        match self {
            Question::SingleChoice(q) => &q.title,
            Question::MultipleChoice(q) => &q.title,
            Question::ShortAnswer(q) => &q.title,
            Question::Subjective(q) => &q.title,
            Question::Checkbox(q) => &q.title,
            Question::Dropdown(q) => &q.title,
            Question::LinearScale(q) => &q.title,
            Question::PrivacyConsent(q) => &q.title,
        }
    }

    /// The condition gating whether this question is shown.
    pub fn display_condition(&self) -> Option<&QuestionCondition> {
        match self {
            Question::SingleChoice(q) | Question::MultipleChoice(q) => q.display_condition.as_ref(),
            Question::ShortAnswer(q) | Question::Subjective(q) => q.display_condition.as_ref(),
            Question::Checkbox(q) => q.display_condition.as_ref(),
            Question::Dropdown(q) => q.display_condition.as_ref(),
            Question::LinearScale(q) => q.display_condition.as_ref(),
            Question::PrivacyConsent(q) => q.display_condition.as_ref(),
        }
    }

    /// Option texts that end the poll when picked; only choice questions have them.
    pub fn terminate_on(&self) -> Option<&[String]> {
        match self {
            Question::SingleChoice(q) | Question::MultipleChoice(q) => Some(&q.terminate_on),
            _ => None,
        }
    }

    /// Option texts of single- and multiple-choice questions, the only kinds a
    /// display condition can reference.
    pub fn choice_options(&self) -> Option<&[String]> {
        match self {
            Question::SingleChoice(q) | Question::MultipleChoice(q) => Some(&q.options),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct LinearScaleQuestion {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub min_value: i64,
    pub max_value: i64,
    pub min_label: String,
    pub max_label: String,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct DropdownQuestion {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub options: Vec<String>,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct CheckboxQuestion {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub options: Vec<String>,
    pub is_multi: bool,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct SubjectiveQuestion {
    pub title: String,
    pub description: String,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

/// A consent question: shows rich-text terms the respondent must agree to,
/// then collects a phone number verified via SMS code. Phone collection is
/// always on for this question type — there is no per-question toggle.
#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct PrivacyConsentQuestion {
    pub title: String,
    pub description: Option<String>,
    pub terms_title: String,
    /// Rich-text consent body, stored as sanitized HTML (same convention as
    /// other HTML content fields, e.g. poll/space descriptions).
    pub terms_body_html: String,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct ChoiceQuestion {
    pub title: String,
    pub description: Option<String>,
    pub image_url: Option<String>,
    pub options: Vec<String>,
    pub is_required: Option<bool>,
    pub allow_other: Option<bool>,
    /// Option texts that end the poll when picked: later questions are skipped
    /// and the response is submitted immediately.
    #[serde(default)]
    pub terminate_on: Vec<String>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}
