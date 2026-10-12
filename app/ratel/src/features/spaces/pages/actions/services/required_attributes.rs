#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::*;

/// Checks the action's Required Attributes gate — a set of rules independent
/// of (and AND-combined with) `depends_on`. Each rule references a Poll
/// action's single- or multiple-choice question by index and a list of allowed answer
/// values; the rule is satisfied when the user's recorded answer to that
/// question matches one of the allowed values (OR within a rule). A
/// participant who never answered the referenced poll fails the rule.
#[cfg(feature = "server")]
pub async fn required_attributes_met(
    space: &crate::common::models::space::SpaceCommon,
    action: &crate::features::spaces::pages::actions::models::SpaceAction,
    user_pk: &Partition,
) -> crate::common::Result<bool> {
    use crate::SpacePollEntityType;
    use crate::features::spaces::pages::actions::actions::poll::{SpacePoll, SpacePollUserAnswer};

    if action.required_attributes.is_empty() {
        return Ok(true);
    }

    let space_id: SpacePartition = match space.partition() {
        Partition::Space(id) => SpacePartition(id),
        _ => return Ok(false),
    };

    for rule in action.required_attributes.0.iter() {
        let poll_id = SpacePollEntityType(rule.poll_action_id.clone());

        let poll = match SpacePoll::get_one(&space_id, &poll_id).await? {
            Some(p) => p,
            None => return Ok(false),
        };

        let space_pk: Partition = space_id.clone().into();
        let poll_sk: EntityType = poll_id.clone().into();
        let answer = match SpacePollUserAnswer::find_one(&space_pk, &poll_sk, user_pk).await? {
            Some(a) => a,
            None => return Ok(false),
        };

        if !rule_satisfied(rule, &poll, &answer.answers.0) {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Pure evaluation of one Required Attribute rule against an already-loaded
/// poll and the user's answers to it.
///
/// Shared by action gating ([`required_attributes_met`]) and the Sampling
/// app's population check, so both apply the exact same matching as poll
/// display conditions: the referenced question must be single- or
/// multiple-choice and at least one picked option's text must be one of
/// `allowed_values`.
#[cfg(feature = "server")]
pub fn rule_satisfied(
    rule: &crate::features::spaces::pages::actions::models::RequiredAttributeRule,
    poll: &crate::features::spaces::pages::actions::actions::poll::SpacePoll,
    answers: &[crate::features::spaces::pages::actions::actions::poll::Answer],
) -> bool {
    use crate::features::spaces::pages::actions::actions::poll::answer_matches_values;

    match (
        poll.questions.0.get(rule.question_index),
        answers.get(rule.question_index),
    ) {
        (Some(question), Some(answer)) => answer_matches_values(question, answer, &rule.allowed_values),
        _ => false,
    }
}

#[cfg(all(test, feature = "server"))]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::{
        Answer, ChoiceQuestion, PollQuestions, Question, SpacePoll,
    };
    use crate::features::spaces::pages::actions::models::RequiredAttributeRule;

    fn single(title: &str, options: &[&str]) -> Question {
        Question::SingleChoice(ChoiceQuestion {
            title: title.to_string(),
            options: options.iter().map(|o| o.to_string()).collect(),
            ..Default::default()
        })
    }

    fn poll() -> SpacePoll {
        SpacePoll {
            questions: PollQuestions(vec![
                single("Age", &["20s", "30s"]),
                Question::MultipleChoice(ChoiceQuestion {
                    title: "Hobby".to_string(),
                    options: vec!["A".to_string(), "B".to_string()],
                    ..Default::default()
                }),
            ]),
            ..Default::default()
        }
    }

    fn rule(question_index: usize, allowed: &[&str]) -> RequiredAttributeRule {
        RequiredAttributeRule {
            poll_action_id: "p".to_string(),
            question_index,
            allowed_values: allowed.iter().map(|v| v.to_string()).collect(),
        }
    }

    fn pick(i: i32) -> Answer {
        Answer::SingleChoice {
            answer: Some(i),
            other: None,
        }
    }

    #[test]
    fn matches_an_allowed_value() {
        assert!(rule_satisfied(&rule(0, &["30s"]), &poll(), &[pick(1)]));
        assert!(rule_satisfied(&rule(0, &["20s", "30s"]), &poll(), &[pick(0)]));
    }

    #[test]
    fn rejects_a_value_outside_the_allowed_set() {
        assert!(!rule_satisfied(&rule(0, &["30s"]), &poll(), &[pick(0)]));
    }

    #[test]
    fn rejects_out_of_range_indices() {
        assert!(!rule_satisfied(&rule(0, &["30s"]), &poll(), &[pick(7)]));
        assert!(!rule_satisfied(&rule(5, &["30s"]), &poll(), &[pick(1)]));
        assert!(!rule_satisfied(&rule(0, &["30s"]), &poll(), &[pick(-1)]));
    }

    #[test]
    fn matches_any_pick_of_a_multiple_choice_question() {
        let multi = Answer::MultipleChoice {
            answer: Some(vec![0, 1]),
            other: None,
        };
        assert!(rule_satisfied(&rule(1, &["B"]), &poll(), &[pick(0), multi.clone()]));
        assert!(!rule_satisfied(&rule(1, &["C"]), &poll(), &[pick(0), multi]));
    }

    #[test]
    fn rejects_mismatched_answers_and_missing_answers() {
        let multi = Answer::MultipleChoice {
            answer: Some(vec![0]),
            other: None,
        };
        assert!(!rule_satisfied(&rule(0, &["20s"]), &poll(), &[multi]));
        let unanswered = Answer::SingleChoice {
            answer: None,
            other: None,
        };
        assert!(!rule_satisfied(&rule(0, &["20s"]), &poll(), &[unanswered]));
    }
}
