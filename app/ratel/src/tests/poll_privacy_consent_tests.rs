use crate::features::auth::controllers::verify_phone_code;
use crate::features::auth::models::PhoneVerification;
use crate::features::spaces::pages::actions::actions::poll::types::{
    Answer, PrivacyConsentQuestion, Question, SubjectiveQuestion, evaluate_answers, evaluate_flow,
    validate_answers,
};

/// `validate_answers` accepts a fully agreed + phone-present answer for a
/// required privacy_consent question.
#[test]
fn validate_answers_accepts_agreed_privacy_consent() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
        display_condition: None,
        termination_message: None,
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: true,
        declined: false,
        phone: Some("+821012345678".to_string()),
        code: Some("123456".to_string()),
    }];
    assert!(validate_answers(questions, answers));
}

/// Rejects when required and the respondent did not check "I agree".
#[test]
fn validate_answers_rejects_unagreed_when_required() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
        display_condition: None,
        termination_message: None,
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: false,
        declined: false,
        phone: Some("+821012345678".to_string()),
        code: None,
    }];
    assert!(!validate_answers(questions, answers));
}

/// Rejects when required and no phone number was supplied, even if agreed.
#[test]
fn validate_answers_rejects_missing_phone_when_required() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
        display_condition: None,
        termination_message: None,
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: true,
        declined: false,
        phone: None,
        code: None,
    }];
    assert!(!validate_answers(questions, answers));
}

/// Not required ⇒ an unagreed/empty answer still validates (optional question).
#[test]
fn validate_answers_allows_empty_when_not_required() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Optional consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(false),
        display_condition: None,
        termination_message: None,
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: false,
        declined: false,
        phone: None,
        code: None,
    }];
    assert!(validate_answers(questions, answers));
}

/// Mismatched question/answer variant pairing is rejected (answer_type must
/// match the question type, same as every other poll question type).
#[test]
fn validate_answers_rejects_mismatched_answer_variant() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
        display_condition: None,
        termination_message: None,
    })];
    let answers = vec![Answer::ShortAnswer {
        answer: Some("wrong type".to_string()),
    }];
    assert!(!validate_answers(questions, answers));
}

/// A poll whose required consent question is followed by two required
/// free-text questions.
fn consent_then_required_questions() -> Vec<Question> {
    let required_text = || {
        Question::Subjective(SubjectiveQuestion {
            title: "Why?".to_string(),
            is_required: Some(true),
            ..Default::default()
        })
    };
    vec![
        Question::PrivacyConsent(PrivacyConsentQuestion {
            title: "Research consent".to_string(),
            terms_title: "Terms".to_string(),
            terms_body_html: "<p>Terms body</p>".to_string(),
            is_required: Some(true),
            ..Default::default()
        }),
        required_text(),
        required_text(),
    ]
}

fn declined_answer() -> Answer {
    Answer::PrivacyConsent {
        agreed: false,
        declined: true,
        phone: None,
        code: None,
    }
}

/// Declining ends the poll: no phone or code is needed and the required
/// questions after it are skipped.
#[test]
fn validate_answers_accepts_declined_privacy_consent_that_terminates() {
    let questions = consent_then_required_questions();
    let answers = vec![
        declined_answer(),
        Answer::Subjective { answer: None },
        Answer::Subjective { answer: None },
    ];
    let flow = evaluate_flow(&questions, &answers);
    assert_eq!(flow.terminated_at, Some(0));
    assert_eq!(flow.visible, vec![true, false, false]);
    assert!(validate_answers(questions, answers));
}

/// Questions after a declined consent are treated as hidden, so answering
/// them is rejected just like after a choice termination.
#[test]
fn validate_answers_rejects_answers_after_declined_privacy_consent() {
    let questions = consent_then_required_questions();
    let answers = vec![
        declined_answer(),
        Answer::Subjective {
            answer: Some("late".to_string()),
        },
        Answer::Subjective { answer: None },
    ];
    assert!(!validate_answers(questions, answers));
}

/// Agreeing still requires a phone, and does not end the poll.
#[test]
fn validate_answers_rejects_agreed_without_phone_when_flow_continues() {
    let questions = consent_then_required_questions();
    let no_phone = vec![
        Answer::PrivacyConsent {
            agreed: true,
            declined: false,
            phone: None,
            code: None,
        },
        Answer::Subjective {
            answer: Some("a".to_string()),
        },
        Answer::Subjective {
            answer: Some("b".to_string()),
        },
    ];
    assert!(!validate_answers(questions.clone(), no_phone));
    let with_phone = vec![
        Answer::PrivacyConsent {
            agreed: true,
            declined: false,
            phone: Some("+821****5678".to_string()),
            code: Some("123456".to_string()),
        },
        Answer::Subjective {
            answer: Some("a".to_string()),
        },
        Answer::Subjective {
            answer: Some("b".to_string()),
        },
    ];
    let outcome = evaluate_answers(&questions, &with_phone).expect("valid");
    assert!(outcome.completed);
}

/// A declined answer is persisted without any phone number or code, even if
/// the client sent one.
#[test]
fn evaluate_answers_strips_phone_from_declined_privacy_consent() {
    let questions = consent_then_required_questions();
    let answers = vec![
        Answer::PrivacyConsent {
            agreed: false,
            declined: true,
            phone: Some("+821****5678".to_string()),
            code: Some("123456".to_string()),
        },
        Answer::Subjective { answer: None },
        Answer::Subjective { answer: None },
    ];
    let outcome = evaluate_answers(&questions, &answers).expect("valid");
    assert_eq!(outcome.answers[0], declined_answer());
    assert!(!outcome.completed);
}

/// Server-side re-verification (requirement 6): the shared `verify_phone_code`
/// helper used by `respond_poll` must succeed with the correct code against a
/// real `PhoneVerification` row, and fail on a wrong code.
#[by_macros::pg_test]
async fn verify_phone_code_round_trips_against_stored_verification() {
    let _ctx = crate::tests::TestContext::setup().await;

    let phone = format!("+8210{}", uuid::Uuid::new_v4().simple());
    let code = "483920".to_string();
    let now = crate::common::utils::time::get_now_timestamp();
    let verification = PhoneVerification::new(phone.clone(), code.clone(), now + 300);
    verification.save().await.expect("save verification");

    verify_phone_code(&phone, &code)
        .await
        .expect("correct code must verify");

    let err = verify_phone_code(&phone, "000001").await;
    assert!(err.is_err(), "wrong code must fail verification");
}

/// Expired verification rows are rejected even with the right code.
#[by_macros::pg_test]
async fn verify_phone_code_rejects_expired_verification() {
    let _ctx = crate::tests::TestContext::setup().await;

    let phone = format!("+8210{}", uuid::Uuid::new_v4().simple());
    let code = "778899".to_string();
    let now = crate::common::utils::time::get_now_timestamp();
    // Already expired.
    let verification = PhoneVerification::new(phone.clone(), code.clone(), now - 10);
    verification.save().await.expect("save verification");

    let err = verify_phone_code(&phone, &code).await;
    assert!(err.is_err(), "expired verification must be rejected");
}
