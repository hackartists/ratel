use crate::features::spaces::pages::actions::actions::poll::*;

use super::Question;

#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
use std::collections::HashMap;

#[derive(Debug, Clone, Eq, PartialEq, serde::Serialize, serde::Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(rename_all = "snake_case", tag = "answer_type")]
pub enum SpacePollSummary {
    SingleChoice {
        total_count: i64,
        answers: HashMap<i32, i64>,
        #[serde(default)]
        other_answers: HashMap<String, i64>,
    },
    MultipleChoice {
        total_count: i64,

        answers: HashMap<i32, i64>,
        #[serde(default)]
        other_answers: HashMap<String, i64>,
    },
    ShortAnswer {
        total_count: i64,
        answers: HashMap<String, i64>,
    },
    Subjective {
        total_count: i64,
        answers: HashMap<String, i64>,
    },
    Checkbox {
        total_count: i64,
        answers: HashMap<i32, i64>,
    },
    Dropdown {
        total_count: i64,
        answers: HashMap<i32, i64>,
    },
    LinearScale {
        total_count: i64,
        answers: HashMap<i32, i64>,
    },
    PrivacyConsent {
        /// Respondents who either agreed or declined; questions left
        /// unanswered (hidden, skipped after a termination, or optional) are
        /// not counted.
        total_count: i64,
        /// Agreed-and-verified responses. Answers that failed server
        /// verification are never persisted.
        agreed_count: i64,
        /// Responses that declined the consent and thereby ended the poll.
        #[serde(default)]
        declined_count: i64,
    },
}

impl SpacePollSummary {
    pub fn aggregate_answer(&mut self, answer: Answer) {
        match self {
            SpacePollSummary::SingleChoice {
                answers,
                other_answers,
                total_count,
            } => {
                if let Answer::SingleChoice { answer, other } = answer {
                    let mut has_any = false;

                    if let Some(idx) = answer {
                        *answers.entry(idx).or_insert(0) += 1;
                        has_any = true;
                    }

                    if let Some(other_text) = other {
                        if !other_text.is_empty() {
                            *other_answers.entry(other_text).or_insert(0) += 1;
                            has_any = true;
                        }
                    }

                    if has_any {
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::MultipleChoice {
                answers,
                other_answers,
                total_count,
            } => {
                if let Answer::MultipleChoice { answer, other } = answer {
                    let mut has_any = false;

                    if let Some(idxs) = answer {
                        for idx in idxs {
                            *answers.entry(idx).or_insert(0) += 1;
                        }
                        has_any = true;
                    }

                    if let Some(other_text) = other {
                        if !other_text.is_empty() {
                            *other_answers.entry(other_text).or_insert(0) += 1;
                            has_any = true;
                        }
                    }

                    if has_any {
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::ShortAnswer {
                answers,
                total_count,
            } => {
                if let Answer::ShortAnswer { answer } = answer {
                    if let Some(answer) = answer {
                        *answers.entry(answer).or_insert(0) += 1;
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::Subjective {
                answers,
                total_count,
            } => {
                if let Answer::Subjective { answer } = answer {
                    if let Some(answer) = answer {
                        *answers.entry(answer).or_insert(0) += 1;
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::Checkbox {
                answers,
                total_count,
            } => {
                if let Answer::Checkbox { answer } = answer {
                    if let Some(idxs) = answer {
                        for idx in idxs {
                            *answers.entry(idx).or_insert(0) += 1;
                        }
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::Dropdown {
                answers,
                total_count,
            } => {
                if let Answer::Dropdown { answer } = answer {
                    if let Some(idx) = answer {
                        *answers.entry(idx).or_insert(0) += 1;
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::LinearScale {
                answers,
                total_count,
            } => {
                if let Answer::LinearScale { answer } = answer {
                    if let Some(idx) = answer {
                        *answers.entry(idx).or_insert(0) += 1;
                        *total_count += 1;
                    }
                }
            }
            SpacePollSummary::PrivacyConsent {
                total_count,
                agreed_count,
                declined_count,
            } => {
                if let Answer::PrivacyConsent {
                    agreed,
                    declined,
                    phone,
                    ..
                } = answer
                {
                    if declined {
                        *total_count += 1;
                        *declined_count += 1;
                    } else if agreed && phone.is_some() {
                        *total_count += 1;
                        *agreed_count += 1;
                    }
                }
            }
        }
    }
}

impl From<Question> for SpacePollSummary {
    fn from(question: Question) -> Self {
        match question {
            Question::SingleChoice(_) => SpacePollSummary::SingleChoice {
                answers: HashMap::new(),
                other_answers: HashMap::new(),
                total_count: 0,
            },
            Question::MultipleChoice(_) => SpacePollSummary::MultipleChoice {
                answers: HashMap::new(),
                other_answers: HashMap::new(),
                total_count: 0,
            },
            Question::ShortAnswer(_) => SpacePollSummary::ShortAnswer {
                answers: HashMap::new(),
                total_count: 0,
            },
            Question::Subjective(_) => SpacePollSummary::Subjective {
                total_count: 0,
                answers: HashMap::new(),
            },
            Question::Checkbox(_) => SpacePollSummary::Checkbox {
                total_count: 0,
                answers: HashMap::new(),
            },
            Question::Dropdown(_) => SpacePollSummary::Dropdown {
                total_count: 0,
                answers: HashMap::new(),
            },
            Question::LinearScale(_) => SpacePollSummary::LinearScale {
                total_count: 0,
                answers: HashMap::new(),
            },
            Question::PrivacyConsent(_) => SpacePollSummary::PrivacyConsent {
                total_count: 0,
                agreed_count: 0,
                declined_count: 0,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::PrivacyConsentQuestion;

    fn consent_answer(agreed: bool, declined: bool, phone: Option<&str>) -> Answer {
        Answer::PrivacyConsent {
            agreed,
            declined,
            phone: phone.map(str::to_string),
            code: None,
        }
    }

    #[test]
    fn privacy_consent_summary_counts_agreed_and_declined() {
        let mut summary =
            SpacePollSummary::from(Question::PrivacyConsent(PrivacyConsentQuestion::default()));
        summary.aggregate_answer(consent_answer(true, false, Some("+821012345678")));
        summary.aggregate_answer(consent_answer(false, true, None));
        summary.aggregate_answer(consent_answer(false, true, None));
        summary.aggregate_answer(consent_answer(false, false, None));
        assert_eq!(
            summary,
            SpacePollSummary::PrivacyConsent {
                total_count: 3,
                agreed_count: 1,
                declined_count: 2,
            }
        );
    }

    #[test]
    fn privacy_consent_summary_deserializes_without_declined_count() {
        let summary: SpacePollSummary = serde_json::from_str(
            r#"{"answer_type":"privacy_consent","total_count":4,"agreed_count":4}"#,
        )
        .unwrap();
        assert_eq!(
            summary,
            SpacePollSummary::PrivacyConsent {
                total_count: 4,
                agreed_count: 4,
                declined_count: 0,
            }
        );
    }
}
