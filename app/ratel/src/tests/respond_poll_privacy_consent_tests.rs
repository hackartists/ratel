//! Regression coverage for the bug reported on the privacy-consent poll
//! flow: a logged-in-by-phone user who agrees to the consent terms and
//! submits must NOT be rejected with "phone verification failed" just
//! because their already-verified login phone carries the client's
//! `code: "verified"` sentinel instead of a real OTP (see
//! `UserPhoneNumber` + `respond_poll`'s `linked_phone` bypass).
use super::*;
use crate::common::models::space::SpaceCommon;
use crate::common::types::{Partition, SpacePublishState, SpaceStatus, SpaceVisibility};
use crate::features::auth::models::{PhoneVerification, UserPhoneNumber};
use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
use crate::features::spaces::pages::actions::actions::poll::types::{
    PrivacyConsentQuestion, Question,
};
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::pages::actions::types::{SpaceActionStatus, SpaceActionType};

/// Seed an Ongoing, owner-is-Creator space with one poll carrying a single
/// required `privacy_consent` question, plus its companion `SpaceAction`
/// (Ongoing, so a plain Participant could also answer it). Returns the raw
/// space id and the poll's bare sk.
async fn seed_consent_poll(ctx: &TestContext) -> (String, String) {
    let space_id = uuid::Uuid::new_v4().to_string();
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let space_pk = Partition::Space(space_id.clone());
    let post_pk = Partition::Feed(space_id.clone());

    let space = SpaceCommon {
        space_pk: space_pk.to_string(),
        created_at: now,
        updated_at: now,
        status: Some(SpaceStatus::Ongoing),
        publish_state: SpacePublishState::Published,
        visibility: SpaceVisibility::Public,
        post_pk: post_pk.to_string(),
        user_pk: ctx.test_user.0.pk().to_string(),
        author_display_name: ctx.test_user.0.display_name.clone(),
        author_profile_url: ctx.test_user.0.profile_url.clone(),
        author_username: ctx.test_user.0.username.clone(),
        ..Default::default()
    };
    space.create().await.expect("create space");

    let post = crate::features::posts::models::Post {
        id: uuid::Uuid::parse_str(&space_id).expect("space_id is a valid uuid"),
        title: "Privacy Consent Response Test Space".to_string(),
        ..Default::default()
    };
    post.create().await.expect("create post");

    let space_partition = crate::common::types::SpacePartition(space_id.clone());
    let mut poll = SpacePoll::try_from(space_partition).expect("default poll");
    poll.questions.0.push(Question::PrivacyConsent(PrivacyConsentQuestion {
        title: "Prize draw consent".to_string(),
        html_title: None,
        description: None,
        terms_title: "Terms".to_string(),
        terms_body_html: "<p>Terms body</p>".to_string(),
        is_required: Some(true),
        display_condition: None,
        termination_message: None,
    }));
    SpacePoll::repository().insert(&poll).await.expect("save poll");

    let mut action = SpaceAction::new(
        crate::common::types::SpacePartition(space_id.clone()),
        poll.poll_id.clone(),
        SpaceActionType::Poll,
    );
    action.status = Some(SpaceActionStatus::Ongoing);
    action.save().await.expect("save space action");

    (space_id, poll.poll_id)
}

/// A phone already linked to the respondent (e.g. the number they used to
/// log in) — the frontend sends the "already verified" sentinel for it, not
/// a real OTP. `respond_poll` must accept this without calling
/// `verify_phone_code` at all.
#[by_macros::pg_test]
async fn respond_poll_accepts_privacy_consent_for_already_linked_phone() {
    let ctx = TestContext::setup().await;
    let (space_id, poll_id) = seed_consent_poll(&ctx).await;

    let phone = format!("+8210{}", uuid::Uuid::new_v4().simple());
    UserPhoneNumber::new(ctx.test_user.0.pk(), phone.clone())
        .save()
        .await
        .expect("link phone to user");

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "privacy_consent", "agreed": true, "phone": phone, "code": "verified" }
                ]
            }
        }
    };
    assert_eq!(
        status, 200,
        "submitting with an already-linked phone + sentinel code must succeed: {body:?}"
    );
}

/// A brand-new phone (not linked to the user) still must round-trip a real
/// OTP against `PhoneVerification` — the bypass must not swallow this path.
#[by_macros::pg_test]
async fn respond_poll_still_requires_real_otp_for_unlinked_phone() {
    let ctx = TestContext::setup().await;
    let (space_id, poll_id) = seed_consent_poll(&ctx).await;

    let phone = format!("+8210{}", uuid::Uuid::new_v4().simple());
    let code = "592014".to_string();
    let now = crate::common::utils::time::get_now_timestamp();
    PhoneVerification::new(phone.clone(), code.clone(), now + 300)
        .save()
        .await
        .expect("save verification");

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "privacy_consent", "agreed": true, "phone": phone, "code": code }
                ]
            }
        }
    };
    assert_eq!(status, 200, "a correct real OTP must still succeed: {body:?}");
}

/// Wrong code for an unlinked phone is rejected (the bypass must not widen
/// to any phone, only ones actually linked to the respondent).
#[by_macros::pg_test]
async fn respond_poll_rejects_wrong_otp_for_unlinked_phone() {
    let ctx = TestContext::setup().await;
    let (space_id, poll_id) = seed_consent_poll(&ctx).await;

    let phone = format!("+8210{}", uuid::Uuid::new_v4().simple());
    let now = crate::common::utils::time::get_now_timestamp();
    PhoneVerification::new(phone.clone(), "111111".to_string(), now + 300)
        .save()
        .await
        .expect("save verification");

    let (status, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "privacy_consent", "agreed": true, "phone": phone, "code": "222222" }
                ]
            }
        }
    };
    assert_ne!(status, 200, "wrong OTP for an unlinked phone must still be rejected");
}

/// Declining the consent ends the poll: `respond_poll` accepts it without a
/// phone or code and persists `agreed: false` with no phone.
#[by_macros::pg_test]
async fn respond_poll_accepts_declined_privacy_consent_without_phone() {
    let ctx = TestContext::setup().await;
    let (space_id, poll_id) = seed_consent_poll(&ctx).await;

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "privacy_consent", "agreed": false, "declined": true, "phone": null }
                ]
            }
        }
    };
    assert_eq!(status, 200, "a declined consent must be accepted: {body:?}");

    let (status, _, body) = crate::test_get! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(status, 200, "{body:?}");
    let stored = &body["my_response"][0];
    assert_eq!(stored["agreed"], false, "{body:?}");
    assert_eq!(stored["declined"], true, "{body:?}");
    assert!(stored["phone"].is_null(), "{body:?}");
}

/// Agreeing without a phone is still rejected.
#[by_macros::pg_test]
async fn respond_poll_rejects_agreed_privacy_consent_without_phone() {
    let ctx = TestContext::setup().await;
    let (space_id, poll_id) = seed_consent_poll(&ctx).await;

    let (status, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: &format!("/api/spaces/{}/polls/{}/respond", space_id, poll_id),
        headers: ctx.test_user.1.clone(),
        body: {
            "req": {
                "answers": [
                    { "answer_type": "privacy_consent", "agreed": true, "phone": null }
                ]
            }
        }
    };
    assert_ne!(status, 200, "agreeing without a phone must be rejected");
}
