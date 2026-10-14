use crate::features::spaces::pages::actions::actions::poll::*;

use super::condition::evaluate_answers;
use super::question::{
    CheckboxQuestion, ChoiceQuestion, DropdownQuestion, LinearScaleQuestion,
    PrivacyConsentQuestion, Question, SubjectiveQuestion,
};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "snake_case", tag = "answer_type")]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum Answer {
    SingleChoice {
        answer: Option<i32>,
        #[serde(default)]
        other: Option<String>,
    },
    MultipleChoice {
        answer: Option<Vec<i32>>,
        #[serde(default)]
        other: Option<String>,
    },
    ShortAnswer {
        answer: Option<String>,
    },
    Subjective {
        answer: Option<String>,
    },
    Checkbox {
        answer: Option<Vec<i32>>,
    },
    Dropdown {
        answer: Option<i32>,
    },
    LinearScale {
        answer: Option<i32>,
    },
    PrivacyConsent {
        agreed: bool,
        /// True when the respondent picked "I do not agree". A declined
        /// consent ends the poll, carries `agreed: false` and never a phone.
        /// `false` together with `agreed: false` means not answered yet.
        #[serde(default)]
        declined: bool,
        #[serde(default)]
        phone: Option<String>,
        /// The SMS code submitted at response time. Carried only in the
        /// request DTO for server-side re-verification in `respond_poll`;
        /// always cleared to `None` before the answer is persisted.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },
}

impl Answer {
    pub fn to_option_indices(&self) -> Vec<u32> {
        match self {
            Answer::SingleChoice { answer, .. } => {
                answer.map(|a| vec![a as u32]).unwrap_or_default()
            }
            Answer::MultipleChoice { answer, .. } => answer
                .as_ref()
                .map(|v| v.iter().map(|&a| a as u32).collect())
                .unwrap_or_default(),
            Answer::Checkbox { answer } => answer
                .as_ref()
                .map(|v| v.iter().map(|&a| a as u32).collect())
                .unwrap_or_default(),
            Answer::Dropdown { answer } => answer.map(|a| vec![a as u32]).unwrap_or_default(),
            Answer::LinearScale { answer } => answer.map(|a| vec![a as u32]).unwrap_or_default(),
            Answer::ShortAnswer { .. } | Answer::Subjective { .. } => vec![0],
            Answer::PrivacyConsent { .. } => vec![0],
        }
    }
}

impl Answer {
    /// The unanswered value matching `question`'s answer type.
    pub fn empty_for(question: &Question) -> Self {
        match question {
            Question::SingleChoice(_) => Answer::SingleChoice {
                answer: None,
                other: None,
            },
            Question::MultipleChoice(_) => Answer::MultipleChoice {
                answer: None,
                other: None,
            },
            Question::ShortAnswer(_) => Answer::ShortAnswer { answer: None },
            Question::Subjective(_) => Answer::Subjective { answer: None },
            Question::Checkbox(_) => Answer::Checkbox { answer: None },
            Question::Dropdown(_) => Answer::Dropdown { answer: None },
            Question::LinearScale(_) => Answer::LinearScale { answer: None },
            Question::PrivacyConsent(_) => Answer::PrivacyConsent {
                agreed: false,
                declined: false,
                phone: None,
                code: None,
            },
        }
    }

    /// Whether the respondent actually answered: an option picked, non-blank
    /// text entered, or consent given or declined.
    pub fn is_answered(&self) -> bool {
        let has_text = |v: &Option<String>| v.as_ref().is_some_and(|t| !t.trim().is_empty());
        match self {
            Answer::SingleChoice { answer, other } => answer.is_some() || has_text(other),
            Answer::MultipleChoice { answer, other } => {
                answer.as_ref().is_some_and(|v| !v.is_empty()) || has_text(other)
            }
            Answer::ShortAnswer { answer } | Answer::Subjective { answer } => has_text(answer),
            Answer::Checkbox { answer } => answer.as_ref().is_some_and(|v| !v.is_empty()),
            Answer::Dropdown { answer } | Answer::LinearScale { answer } => answer.is_some(),
            Answer::PrivacyConsent {
                agreed, declined, ..
            } => *agreed || *declined,
        }
    }
}

impl Default for Answer {
    fn default() -> Self {
        Self::SingleChoice {
            answer: None,
            other: None,
        }
    }
}

/// Validates a submission against the poll's questions, display conditions
/// and termination options. See [`evaluate_answers`] for the outcome details.
pub fn validate_answers(questions: Vec<Question>, answers: Vec<Answer>) -> bool {
    evaluate_answers(&questions, &answers).is_some()
}

/// Checks one answer against its question: matching type, indices in range,
/// "other" text only when allowed, and `is_required` honoured.
pub fn validate_answer(question: &Question, answer: &Answer) -> bool {
    match (question.clone(), answer.clone()) {
        (
            Question::SingleChoice(ChoiceQuestion {
                is_required,
                options,
                allow_other,
                ..
            }),
            Answer::SingleChoice { answer, other },
        ) => {
            let has_other = other
                .as_ref()
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
            if is_required.unwrap_or_default() && answer.is_none() && !has_other {
                return false;
            }
            if let Some(ans) = answer {
                if ans < 0 || ans >= options.len() as i32 {
                    return false;
                }
            }
            if other.is_some() && !allow_other.unwrap_or(false) {
                return false;
            }
        }
        (
            Question::MultipleChoice(ChoiceQuestion {
                is_required,
                options,
                allow_other,
                ..
            }),
            Answer::MultipleChoice { answer, other },
        ) => {
            let answers = answer.unwrap_or_default();
            let has_other = other
                .as_ref()
                .map(|value| !value.trim().is_empty())
                .unwrap_or(false);
            if is_required.unwrap_or_default() && answers.is_empty() && !has_other {
                return false;
            }
            for answer in answers {
                if answer < 0 || answer >= options.len() as i32 {
                    return false;
                }
            }
            if other.is_some() && !allow_other.unwrap_or(false) {
                return false;
            }
        }
        (
            Question::ShortAnswer(SubjectiveQuestion { is_required, .. }),
            Answer::ShortAnswer { answer },
        ) => {
            if is_required.unwrap_or_default() && answer.is_none() {
                return false;
            }
        }
        (
            Question::Subjective(SubjectiveQuestion { is_required, .. }),
            Answer::Subjective { answer },
        ) => {
            if is_required.unwrap_or_default() && answer.is_none() {
                return false;
            }
        }
        (
            Question::Checkbox(CheckboxQuestion {
                is_required,
                options,
                is_multi,
                ..
            }),
            Answer::Checkbox { answer },
        ) => {
            let answers = answer.unwrap_or_default();
            if is_required.unwrap_or_default() && answers.is_empty() {
                return false;
            }
            if !is_multi && answers.len() > 1 {
                return false;
            }
            for answer in answers {
                if answer < 0 || answer >= options.len() as i32 {
                    return false;
                }
            }
        }
        (
            Question::Dropdown(DropdownQuestion {
                is_required,
                options,
                ..
            }),
            Answer::Dropdown { answer },
        ) => {
            if is_required.unwrap_or_default() && answer.is_none() {
                return false;
            }
            if let Some(ans) = answer {
                if ans < 0 || ans >= options.len() as i32 {
                    return false;
                }
            }
        }
        (
            Question::LinearScale(LinearScaleQuestion {
                is_required,
                min_value,
                max_value,
                ..
            }),
            Answer::LinearScale { answer },
        ) => {
            if is_required.unwrap_or_default() && answer.is_none() {
                return false;
            }
            if let Some(ans) = answer {
                if (ans as i64) < min_value || (ans as i64) > max_value {
                    return false;
                }
            }
        }
        (
            Question::PrivacyConsent(PrivacyConsentQuestion { is_required, .. }),
            Answer::PrivacyConsent {
                agreed,
                declined,
                phone,
                ..
            },
        ) => {
            if declined {
                return !agreed;
            }
            if is_required.unwrap_or_default() && (!agreed || phone.is_none()) {
                return false;
            }
        }
        _ => {
            return false;
        }
    }
    true
}
