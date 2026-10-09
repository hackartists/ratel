use crate::features::auth::controllers::verify_phone_code;
use crate::features::auth::models::PhoneVerification;
use crate::features::spaces::pages::actions::actions::poll::types::{
    Answer, PrivacyConsentQuestion, Question, validate_answers,
};

/// `validate_answers` accepts a fully agreed + phone-present answer for a
/// required privacy_consent question.
#[test]
fn validate_answers_accepts_agreed_privacy_consent() {
    let questions = vec![Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: true,
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
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: false,
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
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: true,
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
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(false),
    })];
    let answers = vec![Answer::PrivacyConsent {
        agreed: false,
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
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
    })];
    let answers = vec![Answer::ShortAnswer {
        answer: Some("wrong type".to_string()),
    }];
    assert!(!validate_answers(questions, answers));
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
