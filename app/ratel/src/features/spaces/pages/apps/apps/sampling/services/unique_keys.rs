use sha2::{Digest, Sha256};

use crate::features::spaces::pages::actions::actions::poll::{Answer, Question, SpacePoll};
use crate::features::spaces::pages::apps::apps::sampling::SpaceSamplingError;

/// Canonical form of a unique-question answer: lowercase with every
/// whitespace character and `-` removed, so `010-1234-5678` and
/// `01012345678` compare equal.
pub fn normalize_unique_answer(raw: &str) -> String {
    raw.trim()
        .to_lowercase()
        .chars()
        .filter(|c| !c.is_whitespace() && *c != '-')
        .collect()
}

/// Hex SHA-256 of a normalized answer, scoped to the space and the
/// question so equal answers only collide within the same question.
pub fn unique_key_hash(space_id: &str, question_index: usize, normalized: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(space_id.as_bytes());
    hasher.update(b":");
    hasher.update(question_index.to_string().as_bytes());
    hasher.update(b":");
    hasher.update(normalized.as_bytes());
    hex::encode(hasher.finalize())
}

/// Sorted keys of a respondent for the configured unique questions. A
/// question left blank (or blank after normalization) yields no key and is
/// exempt from the duplicate check.
pub fn unique_keys_for(space_id: &str, questions: &[usize], answers: &[Answer]) -> Vec<String> {
    let mut keys: Vec<String> = questions
        .iter()
        .filter_map(|index| match answers.get(*index) {
            Some(Answer::ShortAnswer {
                answer: Some(raw), ..
            }) => {
                let normalized = normalize_unique_answer(raw);
                (!normalized.is_empty()).then(|| unique_key_hash(space_id, *index, &normalized))
            }
            _ => None,
        })
        .collect();
    keys.sort();
    keys.dedup();
    keys
}

/// Checks that every unique question is a distinct short-answer question of
/// the entry poll.
pub fn validate_unique_questions(
    poll: &SpacePoll,
    questions: &[usize],
) -> Result<(), SpaceSamplingError> {
    for (i, index) in questions.iter().enumerate() {
        if questions[..i].contains(index) {
            return Err(SpaceSamplingError::InvalidUniqueQuestion);
        }
        if !matches!(poll.questions.0.get(*index), Some(Question::ShortAnswer(_))) {
            return Err(SpaceSamplingError::InvalidUniqueQuestion);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::{
        ChoiceQuestion, PollQuestions, SubjectiveQuestion,
    };

    fn short(text: Option<&str>) -> Answer {
        Answer::ShortAnswer {
            answer: text.map(|t| t.to_string()),
        }
    }

    fn poll() -> SpacePoll {
        SpacePoll {
            poll_id: "entry".to_string(),
            questions: PollQuestions(vec![
                Question::SingleChoice(ChoiceQuestion {
                    title: "Age".to_string(),
                    options: vec!["20s".to_string()],
                    ..Default::default()
                }),
                Question::ShortAnswer(SubjectiveQuestion {
                    title: "Phone".to_string(),
                    ..Default::default()
                }),
                Question::Subjective(SubjectiveQuestion {
                    title: "Essay".to_string(),
                    ..Default::default()
                }),
                Question::ShortAnswer(SubjectiveQuestion {
                    title: "Email".to_string(),
                    ..Default::default()
                }),
            ]),
            ..Default::default()
        }
    }

    #[test]
    fn normalizes_case_spaces_and_hyphens() {
        assert_eq!(normalize_unique_answer(" 010-1234-5678 "), "01012345678");
        assert_eq!(normalize_unique_answer("010 1234\t5678"), "01012345678");
        assert_eq!(normalize_unique_answer("Hi@Biyard.CO"), "hi@biyard.co");
        assert_eq!(normalize_unique_answer(" - \n "), "");
    }

    #[test]
    fn hash_is_hex_sha256_scoped_by_space_and_question() {
        let h = unique_key_hash("space", 1, "01012345678");
        assert_eq!(h.len(), 64);
        assert!(h.chars().all(|c| c.is_ascii_hexdigit()));
        assert_eq!(h, unique_key_hash("space", 1, "01012345678"));
        assert_ne!(h, unique_key_hash("other", 1, "01012345678"));
        assert_ne!(h, unique_key_hash("space", 3, "01012345678"));
        assert!(!h.contains("01012345678"));
    }

    #[test]
    fn formatting_variants_share_a_key() {
        let a = unique_keys_for("s", &[1], &[short(None), short(Some("010-1234-5678"))]);
        let b = unique_keys_for("s", &[1], &[short(None), short(Some("01012345678"))]);
        assert_eq!(a.len(), 1);
        assert_eq!(a, b);
    }

    #[test]
    fn blank_or_non_short_answers_yield_no_key() {
        let answers = vec![
            Answer::SingleChoice {
                answer: Some(0),
                other: None,
            },
            short(Some("  -  ")),
            Answer::Subjective {
                answer: Some("x".to_string()),
            },
            short(None),
        ];
        assert!(unique_keys_for("s", &[0, 1, 2, 3], &answers).is_empty());
        assert!(unique_keys_for("s", &[], &[short(Some("a"))]).is_empty());
    }

    #[test]
    fn one_key_per_answered_question() {
        let answers = vec![
            short(None),
            short(Some("010")),
            short(None),
            short(Some("010")),
        ];
        let keys = unique_keys_for("s", &[1, 3], &answers);
        assert_eq!(keys.len(), 2);
        let mut sorted = keys.clone();
        sorted.sort();
        assert_eq!(keys, sorted);
    }

    #[test]
    fn only_distinct_short_answer_questions_are_valid() {
        assert_eq!(validate_unique_questions(&poll(), &[]), Ok(()));
        assert_eq!(validate_unique_questions(&poll(), &[1, 3]), Ok(()));
        for bad in [vec![0], vec![2], vec![9], vec![1, 1]] {
            assert_eq!(
                validate_unique_questions(&poll(), &bad),
                Err(SpaceSamplingError::InvalidUniqueQuestion),
                "{bad:?}"
            );
        }
    }
}
