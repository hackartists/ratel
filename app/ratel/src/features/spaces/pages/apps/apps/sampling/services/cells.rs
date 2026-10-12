use crate::features::spaces::pages::actions::actions::poll::{Answer, Question, SpacePoll};
use crate::features::spaces::pages::actions::models::RequiredAttributeRule;
use crate::features::spaces::pages::actions::services::required_attributes::rule_satisfied;
use crate::features::spaces::pages::apps::apps::sampling::SpaceSamplingError;

/// Upper bound on the number of cells a config may produce, so a careless
/// choice of many questions cannot explode the cell table.
pub const MAX_SAMPLING_CELLS: usize = 256;

/// A cell computed from the entry poll: its key, cartesian-product position
/// and option texts.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CellSpec {
    pub key: String,
    pub position: i64,
    pub labels: Vec<String>,
}

fn single_choice_options(poll: &SpacePoll, index: usize) -> Option<&Vec<String>> {
    match poll.questions.0.get(index) {
        Some(Question::SingleChoice(q)) => Some(&q.options),
        _ => None,
    }
}

/// Builds every cell for the chosen sampling questions.
///
/// Each dimension must be a distinct single-choice question with at least
/// one option. Cells follow lexicographic order with the first dimension as
/// the most significant digit. No dimension yields a single cell with an
/// empty key.
pub fn build_cells(poll: &SpacePoll, dims: &[usize]) -> Result<Vec<CellSpec>, SpaceSamplingError> {
    let mut options: Vec<&Vec<String>> = Vec::with_capacity(dims.len());
    for (i, dim) in dims.iter().enumerate() {
        if dims[..i].contains(dim) {
            return Err(SpaceSamplingError::InvalidDimension);
        }
        match single_choice_options(poll, *dim) {
            Some(opts) if !opts.is_empty() => options.push(opts),
            _ => return Err(SpaceSamplingError::InvalidDimension),
        }
    }

    let count = options
        .iter()
        .try_fold(1usize, |acc, opts| acc.checked_mul(opts.len()))
        .ok_or(SpaceSamplingError::InvalidDimension)?;
    if count > MAX_SAMPLING_CELLS {
        return Err(SpaceSamplingError::InvalidDimension);
    }

    let mut cells = Vec::with_capacity(count);
    for position in 0..count {
        let mut rest = position;
        let mut indices = vec![0usize; options.len()];
        for (slot, opts) in options.iter().enumerate().rev() {
            indices[slot] = rest % opts.len();
            rest /= opts.len();
        }
        cells.push(CellSpec {
            key: indices
                .iter()
                .map(|i| i.to_string())
                .collect::<Vec<_>>()
                .join("-"),
            position: position as i64,
            labels: indices
                .iter()
                .zip(options.iter())
                .map(|(i, opts)| opts[*i].clone())
                .collect(),
        });
    }
    Ok(cells)
}

/// The cell key for a respondent, or `None` when any sampling question is
/// unanswered or answered with an option the poll does not have.
pub fn cell_key_for(poll: &SpacePoll, answers: &[Answer], dims: &[usize]) -> Option<String> {
    let mut parts = Vec::with_capacity(dims.len());
    for dim in dims {
        let picked = match answers.get(*dim) {
            Some(Answer::SingleChoice {
                answer: Some(i), ..
            }) => usize::try_from(*i).ok()?,
            _ => return None,
        };
        if picked >= single_choice_options(poll, *dim)?.len() {
            return None;
        }
        parts.push(picked.to_string());
    }
    Some(parts.join("-"))
}

/// Checks that every population rule targets a single-choice question of
/// the entry poll and only allows option texts that exist on it.
pub fn validate_rules(
    poll: &SpacePoll,
    entry_poll_id: &str,
    rules: &[RequiredAttributeRule],
) -> Result<(), SpaceSamplingError> {
    for rule in rules {
        if rule.poll_action_id != entry_poll_id || rule.allowed_values.is_empty() {
            return Err(SpaceSamplingError::InvalidRule);
        }
        let options = single_choice_options(poll, rule.question_index)
            .ok_or(SpaceSamplingError::InvalidRule)?;
        if !rule.allowed_values.iter().all(|v| options.contains(v)) {
            return Err(SpaceSamplingError::InvalidRule);
        }
    }
    Ok(())
}

/// The cell a respondent belongs to, or `None` when their answers fail any
/// population rule (AND across rules, OR within a rule) or leave a sampling
/// question unanswered.
pub fn classify(
    poll: &SpacePoll,
    rules: &[RequiredAttributeRule],
    dims: &[usize],
    answers: &[Answer],
) -> Option<String> {
    if !rules.iter().all(|rule| rule_satisfied(rule, poll, answers)) {
        return None;
    }
    cell_key_for(poll, answers, dims)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::{ChoiceQuestion, PollQuestions};

    fn choice(options: &[&str]) -> ChoiceQuestion {
        ChoiceQuestion {
            title: "q".to_string(),
            options: options.iter().map(|o| o.to_string()).collect(),
            ..Default::default()
        }
    }

    fn poll() -> SpacePoll {
        SpacePoll {
            poll_id: "entry".to_string(),
            questions: PollQuestions(vec![
                Question::SingleChoice(choice(&["20s", "30s"])),
                Question::SingleChoice(choice(&["Male", "Female"])),
                Question::MultipleChoice(choice(&["A", "B"])),
                Question::SingleChoice(choice(&["Yes", "No"])),
            ]),
            ..Default::default()
        }
    }

    fn pick(i: i32) -> Answer {
        Answer::SingleChoice {
            answer: Some(i),
            other: None,
        }
    }

    fn rule(question_index: usize, allowed: &[&str]) -> RequiredAttributeRule {
        RequiredAttributeRule {
            poll_action_id: "entry".to_string(),
            question_index,
            allowed_values: allowed.iter().map(|v| v.to_string()).collect(),
        }
    }

    #[test]
    fn builds_cartesian_cells_in_lexicographic_order() {
        let cells = build_cells(&poll(), &[0, 1]).unwrap();
        let keys: Vec<_> = cells.iter().map(|c| c.key.as_str()).collect();
        assert_eq!(keys, vec!["0-0", "0-1", "1-0", "1-1"]);
        assert_eq!(
            cells[1].labels,
            vec!["20s".to_string(), "Female".to_string()]
        );
        assert_eq!(cells[2].labels, vec!["30s".to_string(), "Male".to_string()]);
        assert_eq!(
            cells.iter().map(|c| c.position).collect::<Vec<_>>(),
            vec![0, 1, 2, 3]
        );
    }

    #[test]
    fn rejects_multiple_choice_missing_and_duplicate_dimensions() {
        assert_eq!(
            build_cells(&poll(), &[2]),
            Err(SpaceSamplingError::InvalidDimension)
        );
        assert_eq!(
            build_cells(&poll(), &[9]),
            Err(SpaceSamplingError::InvalidDimension)
        );
        assert_eq!(
            build_cells(&poll(), &[0, 0]),
            Err(SpaceSamplingError::InvalidDimension)
        );
    }

    #[test]
    fn no_dimension_yields_one_cell() {
        let cells = build_cells(&poll(), &[]).unwrap();
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].key, "");
        assert!(cells[0].labels.is_empty());
    }

    #[test]
    fn computes_cell_keys_from_answers() {
        let answers = vec![
            pick(1),
            pick(0),
            Answer::MultipleChoice {
                answer: None,
                other: None,
            },
            pick(0),
        ];
        assert_eq!(
            cell_key_for(&poll(), &answers, &[0, 1]),
            Some("1-0".to_string())
        );
        assert_eq!(cell_key_for(&poll(), &answers, &[]), Some(String::new()));
    }

    #[test]
    fn unanswered_or_out_of_range_dimension_has_no_cell() {
        let unanswered = vec![
            Answer::SingleChoice {
                answer: None,
                other: None,
            },
            pick(0),
        ];
        assert_eq!(cell_key_for(&poll(), &unanswered, &[0, 1]), None);
        let out_of_range = vec![pick(5), pick(0)];
        assert_eq!(cell_key_for(&poll(), &out_of_range, &[0, 1]), None);
    }

    #[test]
    fn validates_rules_against_the_entry_poll() {
        assert_eq!(
            validate_rules(&poll(), "entry", &[rule(3, &["Yes"])]),
            Ok(())
        );
        assert_eq!(
            validate_rules(
                &poll(),
                "entry",
                &[RequiredAttributeRule {
                    poll_action_id: "other".into(),
                    ..rule(3, &["Yes"])
                }]
            ),
            Err(SpaceSamplingError::InvalidRule)
        );
        assert_eq!(
            validate_rules(&poll(), "entry", &[rule(2, &["A"])]),
            Err(SpaceSamplingError::InvalidRule)
        );
        assert_eq!(
            validate_rules(&poll(), "entry", &[rule(3, &["Maybe"])]),
            Err(SpaceSamplingError::InvalidRule)
        );
        assert_eq!(
            validate_rules(&poll(), "entry", &[rule(3, &[])]),
            Err(SpaceSamplingError::InvalidRule)
        );
    }

    #[test]
    fn classify_applies_rules_before_cells() {
        let yes = vec![
            pick(0),
            pick(1),
            Answer::MultipleChoice {
                answer: None,
                other: None,
            },
            pick(0),
        ];
        let no = vec![
            pick(0),
            pick(1),
            Answer::MultipleChoice {
                answer: None,
                other: None,
            },
            pick(1),
        ];
        let rules = vec![rule(3, &["Yes"])];
        assert_eq!(
            classify(&poll(), &rules, &[0, 1], &yes),
            Some("0-1".to_string())
        );
        assert_eq!(classify(&poll(), &rules, &[0, 1], &no), None);
    }
}
