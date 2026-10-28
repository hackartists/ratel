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

/// Canonical form of a privacy-consent phone. On top of
/// [`normalize_unique_answer`] it drops `(`, `)` and `.` and folds the
/// Korean country code into the domestic trunk prefix, so the E.164
/// `+821012345678` the web phone input submits, `+82 010-1234-5678` and the
/// domestic `010-1234-5678` all compare equal. Other country codes keep
/// their E.164 form.
pub fn normalize_unique_phone(raw: &str) -> String {
    let compact: String = normalize_unique_answer(raw)
        .chars()
        .filter(|c| !matches!(c, '(' | ')' | '.'))
        .collect();
    match compact.strip_prefix("+82") {
        Some(national) if national.starts_with('0') => national.to_string(),
        Some(national) if !national.is_empty() => format!("0{national}"),
        _ => compact,
    }
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
/// short answer is keyed by its [`normalize_unique_answer`] form and an
/// agreed privacy consent by its SMS-verified phone in
/// [`normalize_unique_phone`] form. A blank answer, a declined consent or a
/// consent without a phone yields no key and is exempt from the duplicate
/// check.
pub fn unique_keys_for(space_id: &str, questions: &[usize], answers: &[Answer]) -> Vec<String> {
    let mut keys: Vec<String> = questions
        .iter()
        .filter_map(|index| {
            match answers.get(*index) {
                Some(Answer::ShortAnswer {
                    answer: Some(raw), ..
                }) => Some(normalize_unique_answer(raw)),
                Some(Answer::PrivacyConsent {
                    agreed: true,
                    phone: Some(phone),
                    ..
                }) => Some(normalize_unique_phone(phone)),
                _ => None,
            }
            .filter(|normalized| !normalized.is_empty())
            .map(|normalized| unique_key_hash(space_id, *index, &normalized))
        })
        .collect();
    keys.sort();
    keys.dedup();
    keys
}

/// Checks that every unique question is a distinct short-answer or
/// privacy-consent question of the entry poll.
pub fn validate_unique_questions(
    poll: &SpacePoll,
    questions: &[usize],
) -> Result<(), SpaceSamplingError> {
    for (i, index) in questions.iter().enumerate() {
        if questions[..i].contains(index) {
            return Err(SpaceSamplingError::InvalidUniqueQuestion);
        }
        if !matches!(
            poll.questions.0.get(*index),
            Some(Question::ShortAnswer(_) | Question::PrivacyConsent(_))
        ) {
            return Err(SpaceSamplingError::InvalidUniqueQuestion);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::features::spaces::pages::actions::actions::poll::{
        ChoiceQuestion, PollQuestions, PrivacyConsentQuestion, SubjectiveQuestion,
    };

    fn consent(agreed: bool, declined: bool, phone: Option<&str>) -> Answer {
        Answer::PrivacyConsent {
            agreed,
            declined,
            phone: phone.map(|p| p.to_string()),
            code: None,
        }
    }

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
                Question::PrivacyConsent(PrivacyConsentQuestion {
                    title: "Consent".to_string(),
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
        assert_eq!(validate_unique_questions(&poll(), &[4]), Ok(()));
        assert_eq!(validate_unique_questions(&poll(), &[1, 3, 4]), Ok(()));
        for bad in [
            vec![0],
            vec![2],
            vec![9],
            vec![1, 1],
            vec![4, 4],
            vec![4, 0],
        ] {
            assert_eq!(
                validate_unique_questions(&poll(), &bad),
                Err(SpaceSamplingError::InvalidUniqueQuestion),
                "{bad:?}"
            );
        }
    }

    #[test]
    fn korean_phone_variants_normalize_to_the_domestic_form() {
        for raw in [
            "+821012345678",
            "+82 10-1234-5678",
            "+82 010 1234 5678",
            "010-1234-5678",
            "(010) 1234.5678",
        ] {
            assert_eq!(normalize_unique_phone(raw), "01012345678", "{raw}");
        }
        assert_eq!(normalize_unique_phone("+1 415-555-0100"), "+14155550100");
        assert_eq!(normalize_unique_phone("+82"), "+82");
        assert_eq!(normalize_unique_phone(" - "), "");
    }

    #[test]
    fn agreed_consent_is_keyed_by_its_phone() {
        let answers = |phone: &str| {
            vec![
                short(None),
                short(None),
                short(None),
                short(None),
                consent(true, false, Some(phone)),
            ]
        };
        let e164 = unique_keys_for("s", &[4], &answers("+821012345678"));
        let domestic = unique_keys_for("s", &[4], &answers("010-1234-5678"));
        assert_eq!(e164.len(), 1);
        assert_eq!(e164, domestic);
        assert_eq!(e164, vec![unique_key_hash("s", 4, "01012345678")]);
        assert_ne!(e164, unique_keys_for("s", &[4], &answers("+821087654321")));
    }

    #[test]
    fn declined_or_phoneless_consent_yields_no_key() {
        for answer in [
            consent(false, true, None),
            consent(false, false, None),
            consent(true, false, None),
            consent(true, false, Some("  ")),
            consent(false, false, Some("+821012345678")),
        ] {
            assert!(
                unique_keys_for("s", &[0], &[answer.clone()]).is_empty(),
                "{answer:?}"
            );
        }
    }

    #[test]
    fn short_answer_and_consent_keys_combine() {
        let answers = vec![
            short(None),
            short(Some("010-1234-5678")),
            short(None),
            short(None),
            consent(true, false, Some("+821012345678")),
        ];
        let keys = unique_keys_for("s", &[1, 4], &answers);
        assert_eq!(keys.len(), 2);
        assert!(keys.contains(&unique_key_hash("s", 1, "01012345678")));
        assert!(keys.contains(&unique_key_hash("s", 4, "01012345678")));
    }
}
