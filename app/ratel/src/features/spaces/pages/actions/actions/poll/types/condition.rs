use crate::features::spaces::pages::actions::actions::poll::*;

use super::answer::Answer;
use super::question::Question;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

/// How the rules of a [`QuestionCondition`] combine.
#[derive(Debug, Clone, Copy, Eq, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub enum ConditionOperator {
    /// Every rule must be satisfied.
    #[default]
    And,
    /// At least one rule must be satisfied.
    Or,
}

/// One requirement on an earlier question's answer.
///
/// `question_index` points at a single- or multiple-choice question that comes
/// before the question carrying the condition. `allowed_values` are option
/// texts of that question and OR together: a single-choice answer matches when
/// the picked option is listed, a multiple-choice answer matches when any of
/// the picked options is listed.
#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct AnswerRule {
    pub question_index: usize,
    pub allowed_values: Vec<String>,
}

/// Display condition attached to the question it gates.
///
/// A question without a condition is always shown. A question with one is
/// shown only when its rules, combined by `operator`, hold against the answers
/// given to earlier visible questions.
#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(
    feature = "ts-bridge",
    derive(ts_rs::TS),
    ts(export, export_to = "types/")
)]
pub struct QuestionCondition {
    pub operator: ConditionOperator,
    pub rules: Vec<AnswerRule>,
}

/// Whether `answer` to `question` picked at least one option whose text is in
/// `allowed_values`.
///
/// Only single- and multiple-choice questions can match; the free-text
/// "other" entry never does. This is the matching used both by poll display
/// conditions and by action Required Attribute gating.
pub fn answer_matches_values(
    question: &Question,
    answer: &Answer,
    allowed_values: &[String],
) -> bool {
    let options = match question {
        Question::SingleChoice(q) | Question::MultipleChoice(q) => &q.options,
        _ => return false,
    };
    let picked: Vec<i32> = match (question, answer) {
        (
            Question::SingleChoice(_),
            Answer::SingleChoice {
                answer: Some(idx), ..
            },
        ) => vec![*idx],
        (
            Question::MultipleChoice(_),
            Answer::MultipleChoice {
                answer: Some(idxs), ..
            },
        ) => idxs.clone(),
        _ => return false,
    };
    picked.into_iter().any(|idx| {
        usize::try_from(idx)
            .ok()
            .and_then(|i| options.get(i))
            .is_some_and(|value| allowed_values.iter().any(|v| v == value))
    })
}

impl QuestionCondition {
    /// Evaluates the condition. `answer_of(i)` yields the answer to question
    /// `i` only when that question is visible; hidden or unanswered questions
    /// fail every rule that references them.
    pub fn is_satisfied<'a>(
        &self,
        questions: &[Question],
        answer_of: impl Fn(usize) -> Option<&'a Answer>,
    ) -> bool {
        if self.rules.is_empty() {
            return true;
        }
        let rule_ok = |rule: &AnswerRule| match (
            questions.get(rule.question_index),
            answer_of(rule.question_index),
        ) {
            (Some(q), Some(a)) => answer_matches_values(q, a, &rule.allowed_values),
            _ => false,
        };
        match self.operator {
            ConditionOperator::And => self.rules.iter().all(rule_ok),
            ConditionOperator::Or => self.rules.iter().any(rule_ok),
        }
    }
}

/// Which questions a respondent is shown for a given set of answers.
#[derive(Debug, Clone, Eq, PartialEq, Default)]
pub struct PollFlow {
    /// `visible[i]` is true when question `i` is presented to the respondent.
    /// Questions after a termination are never visible.
    pub visible: Vec<bool>,
    /// Index of the visible choice question whose answer ended the poll.
    pub terminated_at: Option<usize>,
}

/// Walks the questions in order and resolves display conditions and
/// termination options against `answers`.
pub fn evaluate_flow(questions: &[Question], answers: &[Answer]) -> PollFlow {
    let mut visible = vec![false; questions.len()];
    let mut terminated_at = None;
    for (i, question) in questions.iter().enumerate() {
        let shown = match question.display_condition() {
            None => true,
            Some(cond) => cond.is_satisfied(questions, |j| {
                if j < i && visible[j] {
                    answers.get(j)
                } else {
                    None
                }
            }),
        };
        visible[i] = shown;
        if !shown {
            continue;
        }
        if let (Some(terminate_on), Some(answer)) = (question.terminate_on(), answers.get(i)) {
            if !terminate_on.is_empty() && answer_matches_values(question, answer, terminate_on) {
                terminated_at = Some(i);
                break;
            }
        }
    }
    PollFlow {
        visible,
        terminated_at,
    }
}

/// Server-side outcome of a valid poll submission.
#[derive(Debug, Clone, Eq, PartialEq)]
pub struct PollAnswerOutcome {
    /// Answers to persist: hidden and post-termination questions are reset to
    /// the empty answer of their type.
    pub answers: Vec<Answer>,
    /// False only when a termination option ended the poll before any other
    /// question was answered.
    pub completed: bool,
}

/// Validates a full submission against the poll's questions, display
/// conditions and termination options.
///
/// Returns `None` when the submission is invalid: wrong length, a visible
/// answer of the wrong type or out of range, a required visible question left
/// empty, or an answer given to a hidden or post-termination question.
pub fn evaluate_answers(questions: &[Question], answers: &[Answer]) -> Option<PollAnswerOutcome> {
    if questions.len() != answers.len() {
        return None;
    }
    let flow = evaluate_flow(questions, answers);
    let mut normalized = Vec::with_capacity(answers.len());
    for (i, (question, answer)) in questions.iter().zip(answers.iter()).enumerate() {
        if flow.visible[i] {
            if !validate_answer(question, answer) {
                return None;
            }
            normalized.push(answer.clone());
        } else {
            if answer.is_answered() {
                return None;
            }
            normalized.push(Answer::empty_for(question));
        }
    }
    let completed = match flow.terminated_at {
        None => true,
        Some(t) => (0..t).any(|i| flow.visible[i] && normalized[i].is_answered()),
    };
    Some(PollAnswerOutcome {
        answers: normalized,
        completed,
    })
}

/// Checks the display conditions and termination options of a question list
/// as authored: every rule references an earlier single- or multiple-choice
/// question and only that question's option texts, every condition has at
/// least one rule with at least one value, and termination options are
/// options of their own question.
pub fn validate_question_flow(questions: &[Question]) -> bool {
    questions.iter().enumerate().all(|(i, question)| {
        let condition_ok =
            question.display_condition().is_none_or(|cond| {
                !cond.rules.is_empty()
                    && cond.rules.iter().all(|rule| {
                        rule.question_index < i
                            && !rule.allowed_values.is_empty()
                            && questions[rule.question_index].choice_options().is_some_and(
                                |options| rule.allowed_values.iter().all(|v| options.contains(v)),
                            )
                    })
            });
        let terminate_ok = match (question.terminate_on(), question.choice_options()) {
            (Some(values), Some(options)) => values.iter().all(|v| options.contains(v)),
            _ => true,
        };
        condition_ok && terminate_ok
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::{
        ChoiceQuestion, SubjectiveQuestion,
    };

    fn opts(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| v.to_string()).collect()
    }

    fn single(options: &[&str]) -> ChoiceQuestion {
        ChoiceQuestion {
            title: "q".into(),
            options: opts(options),
            ..Default::default()
        }
    }

    fn cond(operator: ConditionOperator, rules: &[(usize, &[&str])]) -> Option<QuestionCondition> {
        Some(QuestionCondition {
            operator,
            rules: rules
                .iter()
                .map(|(i, v)| AnswerRule {
                    question_index: *i,
                    allowed_values: opts(v),
                })
                .collect(),
        })
    }

    fn subjective(required: bool, condition: Option<QuestionCondition>) -> Question {
        Question::Subjective(SubjectiveQuestion {
            title: "s".into(),
            is_required: Some(required),
            display_condition: condition,
            ..Default::default()
        })
    }

    fn pick(i: i32) -> Answer {
        Answer::SingleChoice {
            answer: Some(i),
            other: None,
        }
    }

    fn picks(v: &[i32]) -> Answer {
        Answer::MultipleChoice {
            answer: Some(v.to_vec()),
            other: None,
        }
    }

    fn text(s: &str) -> Answer {
        Answer::Subjective {
            answer: Some(s.into()),
        }
    }

    fn no_text() -> Answer {
        Answer::Subjective { answer: None }
    }

    fn yes_no_branching() -> Vec<Question> {
        vec![
            Question::SingleChoice(single(&["Yes", "No"])),
            subjective(true, cond(ConditionOperator::And, &[(0, &["Yes"])])),
            subjective(true, cond(ConditionOperator::And, &[(0, &["No"])])),
        ]
    }

    #[test]
    fn branches_on_single_choice() {
        let qs = yes_no_branching();
        let out = evaluate_answers(&qs, &[pick(0), text("why yes"), no_text()]).expect("valid");
        assert!(out.completed);
        let flow = evaluate_flow(&qs, &[pick(1), no_text(), no_text()]);
        assert_eq!(flow.visible, vec![true, false, true]);
    }

    #[test]
    fn rejects_answers_to_hidden_questions() {
        let qs = yes_no_branching();
        assert!(evaluate_answers(&qs, &[pick(0), text("a"), text("b")]).is_none());
    }

    #[test]
    fn required_applies_only_to_visible_questions() {
        let qs = yes_no_branching();
        assert!(evaluate_answers(&qs, &[pick(1), no_text(), text("why no")]).is_some());
        assert!(evaluate_answers(&qs, &[pick(1), no_text(), no_text()]).is_none());
    }

    #[test]
    fn and_or_operators() {
        let qs = vec![
            Question::SingleChoice(single(&["A", "B"])),
            Question::SingleChoice(single(&["X", "Y"])),
            subjective(
                false,
                cond(ConditionOperator::And, &[(0, &["A"]), (1, &["X"])]),
            ),
            subjective(
                false,
                cond(ConditionOperator::Or, &[(0, &["A"]), (1, &["X"])]),
            ),
        ];
        let flow = evaluate_flow(&qs, &[pick(0), pick(1), no_text(), no_text()]);
        assert_eq!(flow.visible, vec![true, true, false, true]);
        let flow = evaluate_flow(&qs, &[pick(0), pick(0), no_text(), no_text()]);
        assert_eq!(flow.visible, vec![true, true, true, true]);
        let flow = evaluate_flow(&qs, &[pick(1), pick(1), no_text(), no_text()]);
        assert_eq!(flow.visible, vec![true, true, false, false]);
    }

    #[test]
    fn multiple_choice_matches_any_pick() {
        let qs = vec![
            Question::MultipleChoice(single(&["Red", "Green", "Blue"])),
            subjective(false, cond(ConditionOperator::And, &[(0, &["Blue"])])),
        ];
        assert_eq!(
            evaluate_flow(&qs, &[picks(&[0, 2]), no_text()]).visible,
            vec![true, true]
        );
        assert_eq!(
            evaluate_flow(&qs, &[picks(&[0, 1]), no_text()]).visible,
            vec![true, false]
        );
        assert_eq!(
            evaluate_flow(&qs, &[picks(&[]), no_text()]).visible,
            vec![true, false]
        );
    }

    #[test]
    fn hidden_reference_fails_the_rule() {
        let qs = vec![
            Question::SingleChoice(single(&["Yes", "No"])),
            Question::SingleChoice(ChoiceQuestion {
                display_condition: cond(ConditionOperator::And, &[(0, &["Yes"])]),
                ..single(&["A", "B"])
            }),
            subjective(false, cond(ConditionOperator::And, &[(1, &["A"])])),
        ];
        let flow = evaluate_flow(&qs, &[pick(1), pick(0), no_text()]);
        assert_eq!(flow.visible, vec![true, false, false]);
    }

    fn terminating() -> Vec<Question> {
        vec![
            Question::SingleChoice(ChoiceQuestion {
                terminate_on: opts(&["Stop"]),
                ..single(&["Go", "Stop"])
            }),
            Question::SingleChoice(ChoiceQuestion {
                terminate_on: opts(&["Stop"]),
                ..single(&["Go", "Stop"])
            }),
            subjective(true, None),
        ]
    }

    #[test]
    fn termination_on_first_question_is_incomplete() {
        let qs = terminating();
        let out = evaluate_answers(&qs, &[pick(1), Answer::default(), no_text()]).expect("valid");
        assert!(!out.completed);
        assert_eq!(out.answers[1], Answer::empty_for(&qs[1]));
    }

    #[test]
    fn termination_mid_poll_is_complete() {
        let qs = terminating();
        let out = evaluate_answers(&qs, &[pick(0), pick(1), no_text()]).expect("valid");
        assert!(out.completed);
    }

    #[test]
    fn rejects_answers_after_termination() {
        let qs = terminating();
        assert!(evaluate_answers(&qs, &[pick(1), pick(0), no_text()]).is_none());
        assert!(evaluate_answers(&qs, &[pick(0), pick(1), text("late")]).is_none());
    }

    #[test]
    fn other_text_never_terminates() {
        let qs = vec![
            Question::SingleChoice(ChoiceQuestion {
                terminate_on: opts(&["Stop"]),
                allow_other: Some(true),
                ..single(&["Go", "Stop"])
            }),
            subjective(true, None),
        ];
        let other = Answer::SingleChoice {
            answer: None,
            other: Some("Stop".into()),
        };
        assert!(evaluate_answers(&qs, &[other, no_text()]).is_none());
    }

    #[test]
    fn multiple_choice_termination() {
        let qs = vec![
            subjective(false, None),
            Question::MultipleChoice(ChoiceQuestion {
                terminate_on: opts(&["None of these"]),
                ..single(&["A", "None of these"])
            }),
            subjective(true, None),
        ];
        let out = evaluate_answers(&qs, &[text("hi"), picks(&[0, 1]), no_text()]).expect("valid");
        assert!(out.completed);
        let out = evaluate_answers(&qs, &[no_text(), picks(&[1]), no_text()]).expect("valid");
        assert!(!out.completed);
    }

    #[test]
    fn question_flow_validation() {
        assert!(validate_question_flow(&yes_no_branching()));
        assert!(validate_question_flow(&terminating()));
        let forward = vec![
            subjective(false, cond(ConditionOperator::And, &[(1, &["Yes"])])),
            Question::SingleChoice(single(&["Yes", "No"])),
        ];
        assert!(!validate_question_flow(&forward));
        let unknown_value = vec![
            Question::SingleChoice(single(&["Yes", "No"])),
            subjective(false, cond(ConditionOperator::Or, &[(0, &["Maybe"])])),
        ];
        assert!(!validate_question_flow(&unknown_value));
        let non_choice = vec![
            subjective(false, None),
            subjective(false, cond(ConditionOperator::And, &[(0, &["x"])])),
        ];
        assert!(!validate_question_flow(&non_choice));
        let empty_rules = vec![subjective(false, cond(ConditionOperator::And, &[]))];
        assert!(!validate_question_flow(&empty_rules));
        let bad_terminate = vec![Question::SingleChoice(ChoiceQuestion {
            terminate_on: opts(&["Gone"]),
            ..single(&["Go", "Stop"])
        })];
        assert!(!validate_question_flow(&bad_terminate));
    }

    #[test]
    fn completion_without_termination() {
        let qs = vec![subjective(false, None)];
        assert!(
            evaluate_answers(&qs, &[no_text()])
                .expect("valid")
                .completed
        );
    }
}
