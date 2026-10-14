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

    /// When `html_title` is set and non-empty, overwrites `title` with its
    /// plain-text form so every plain-text consumer of `title` stays
    /// consistent with what the author typed. The client-sent `title` is
    /// ignored in that case.
    #[cfg(feature = "server")]
    pub fn normalize_title(&mut self) {
        let (title, html_title) = match self {
            Question::SingleChoice(q) | Question::MultipleChoice(q) => {
                (&mut q.title, &q.html_title)
            }
            Question::ShortAnswer(q) | Question::Subjective(q) => (&mut q.title, &q.html_title),
            Question::Checkbox(q) => (&mut q.title, &q.html_title),
            Question::Dropdown(q) => (&mut q.title, &q.html_title),
            Question::LinearScale(q) => (&mut q.title, &q.html_title),
            Question::PrivacyConsent(q) => (&mut q.title, &q.html_title),
        };
        if let Some(html) = html_title.as_deref().filter(|h| !h.trim().is_empty()) {
            *title = crate::features::cross_posting::services::format::strip_html(html);
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

    /// Author-written notice shown in the termination confirmation instead of
    /// the default copy. Only choice and privacy-consent questions can end the
    /// poll; blank text counts as unset.
    pub fn termination_message(&self) -> Option<&str> {
        let message = match self {
            Question::SingleChoice(q) | Question::MultipleChoice(q) => {
                q.termination_message.as_deref()
            }
            Question::PrivacyConsent(q) => q.termination_message.as_deref(),
            _ => None,
        };
        message.filter(|m| !m.trim().is_empty())
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
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
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
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
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
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
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
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
    pub description: String,
    pub is_required: Option<bool>,
    /// Shows this question only when earlier answers satisfy the condition;
    /// `None` means always shown.
    #[serde(default)]
    pub display_condition: Option<QuestionCondition>,
}

/// A consent question: shows rich-text terms the respondent agrees or
/// disagrees to. Agreeing collects a phone number verified via SMS code;
/// disagreeing always ends the poll. Phone collection is always on for this
/// question type — there is no per-question toggle.
#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct PrivacyConsentQuestion {
    pub title: String,
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
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
    /// Notice shown when a respondent disagrees, which ends the poll; `None`
    /// uses the default copy.
    #[serde(default)]
    pub termination_message: Option<String>,
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
    /// Rich-text (HTML) version of `title`. When present the server derives
    /// `title` from it as plain text; `None` for questions authored before
    /// rich-text titles existed.
    #[serde(default)]
    pub html_title: Option<String>,
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
    /// Notice shown when a `terminate_on` option is picked; `None` uses the
    /// default copy.
    #[serde(default)]
    pub termination_message: Option<String>,
}

#[cfg(all(test, feature = "server"))]
mod tests {
    use super::*;

    #[test]
    fn normalize_title_derives_plain_text_from_html_title() {
        let mut q = Question::SingleChoice(ChoiceQuestion {
            title: "client sent".to_string(),
            html_title: Some("<p>Do you <strong>agree</strong> &amp; consent?</p>".to_string()),
            ..Default::default()
        });
        q.normalize_title();
        assert_eq!(q.title(), "Do you agree & consent?");
    }

    #[test]
    fn normalize_title_applies_to_every_variant() {
        let html = Some("<p><em>Rate</em> it</p>".to_string());
        let mut questions = vec![
            Question::MultipleChoice(ChoiceQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::ShortAnswer(SubjectiveQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::Subjective(SubjectiveQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::Checkbox(CheckboxQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::Dropdown(DropdownQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::LinearScale(LinearScaleQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
            Question::PrivacyConsent(PrivacyConsentQuestion {
                html_title: html.clone(),
                ..Default::default()
            }),
        ];
        for q in questions.iter_mut() {
            q.normalize_title();
            assert_eq!(q.title(), "Rate it");
        }
    }

    #[test]
    fn normalize_title_keeps_title_without_html_title() {
        for html_title in [None, Some(String::new()), Some("   ".to_string())] {
            let mut q = Question::Dropdown(DropdownQuestion {
                title: "Plain title".to_string(),
                html_title,
                ..Default::default()
            });
            q.normalize_title();
            assert_eq!(q.title(), "Plain title");
        }
    }

    #[test]
    fn termination_message_defaults_to_none_for_legacy_data() {
        let q: Question = serde_json::from_str(
            r#"{"answer_type":"privacy_consent","title":"Consent","description":null,"terms_title":"t","terms_body_html":"<p>b</p>","is_required":true}"#,
        )
        .unwrap();
        assert_eq!(q.termination_message(), None);
        let q: Question = serde_json::from_str(
            r#"{"answer_type":"single_choice","title":"Legacy","description":null,"image_url":null,"options":["a"],"is_required":null,"allow_other":null}"#,
        )
        .unwrap();
        assert_eq!(q.termination_message(), None);
    }

    #[test]
    fn blank_termination_message_counts_as_unset() {
        let q = Question::MultipleChoice(ChoiceQuestion {
            termination_message: Some("  ".to_string()),
            ..Default::default()
        });
        assert_eq!(q.termination_message(), None);
        let q = Question::PrivacyConsent(PrivacyConsentQuestion {
            termination_message: Some("Thanks for your time.".to_string()),
            ..Default::default()
        });
        assert_eq!(q.termination_message(), Some("Thanks for your time."));
    }

    #[test]
    fn html_title_defaults_to_none_for_legacy_data() {
        let q: Question = serde_json::from_str(
            r#"{"answer_type":"single_choice","title":"Legacy","description":null,"image_url":null,"options":["a"],"is_required":null,"allow_other":null}"#,
        )
        .unwrap();
        match q {
            Question::SingleChoice(c) => {
                assert_eq!(c.title, "Legacy");
                assert_eq!(c.html_title, None);
            }
            other => panic!("unexpected variant: {other:?}"),
        }
    }
}
