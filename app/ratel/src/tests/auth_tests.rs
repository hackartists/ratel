use super::*;

// Helper: sign up a brand-new passwordless email user via the public endpoints.
// Returns the email used.
async fn signup_email_user(app: &axum::Router) -> String {
    let email = format!("auth-{}@test.com", uuid::Uuid::now_v7());
    // validate_username caps at 20 chars; uuid.simple() is 32 hex, so take
    // the trailing 12 (random) chars → "u" + 12 = 13 chars, still unique.
    let username = format!("u{}", &uuid::Uuid::now_v7().simple().to_string()[20..]);

    let (s, _, _) = crate::test_post! {
        app: app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "email": email } }
    };
    assert_eq!(s, 200, "send-code should succeed");

    let (s, _, _) = crate::test_post! {
        app: app.clone(),
        path: "/api/auth/signup",
        body: { "req": {
            "email": email, "code": "000000", "display_name": "T",
            "username": username, "profile_url": "", "description": "",
            "term_agreed": true, "informed_agreed": false
        } }
    };
    assert_eq!(s, 200, "signup should succeed");

    email
}

#[by_macros::pg_test]
async fn test_email_code_login_existing_user() {
    let ctx = TestContext::setup().await;

    let email = signup_email_user(&ctx.app).await;

    // login with email + code
    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "email": email, "code": "000000" } }
    };
    assert_eq!(s, 200, "email-code login: {:?}", body);
}

#[by_macros::pg_test]
async fn test_email_code_login_unknown_user_returns_not_found() {
    let ctx = TestContext::setup().await;

    let email = format!("nouser-{}@test.com", uuid::Uuid::now_v7());
    let (_, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "email": email } }
    };
    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "email": email, "code": "000000" } }
    };
    assert_ne!(
        s, 200,
        "unknown user must not log in (frontend branches to signup)"
    );
}

#[by_macros::pg_test]
async fn test_email_code_signup_no_password_creates_user() {
    let ctx = TestContext::setup().await;

    let email = format!("signup-{}@test.com", uuid::Uuid::now_v7());
    // validate_username caps at 20 chars; uuid.simple() is 32 hex, so take
    // the trailing 12 (random) chars → "u" + 12 = 13 chars, still unique.
    let username = format!("u{}", &uuid::Uuid::now_v7().simple().to_string()[20..]);

    let (_, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "email": email } }
    };
    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/signup",
        body: { "req": {
            "email": email, "code": "000000", "display_name": "T",
            "username": username, "profile_url": "", "description": "",
            "term_agreed": true, "informed_agreed": false
        } }
    };
    assert_eq!(s, 200, "passwordless signup: {:?}", body);
    // No `password` field is sent; user is created and session established.
}

/// Backward compatibility / no-migration proof: an account that already has a
/// stored password (i.e. created before this change) must still log in via the
/// new email+code flow, with the password ignored. `find_by_email` keys off the
/// email index only, so the legacy `password` attribute is irrelevant.
#[by_macros::pg_test]
async fn test_legacy_password_user_logs_in_with_email_code() {
    let ctx = TestContext::setup().await;

    let email = format!("legacy-{}@test.com", uuid::Uuid::now_v7());
    // validate_username caps at 20 chars; uuid.simple() is 32 hex, so take
    // the trailing 12 (random) chars → "u" + 12 = 13 chars, still unique.
    let username = format!("u{}", &uuid::Uuid::now_v7().simple().to_string()[20..]);

    // Simulate a pre-existing account the same way old signups created them:
    // a real User row carrying a `Some(password_hash)`.
    let legacy = crate::common::models::auth::User::new(
        "Legacy User".to_string(),
        email.clone(),
        String::new(),
        true,
        true,
        crate::common::types::UserType::Individual,
        username,
        Some("legacy-sha3-hash".to_string()),
    );
    legacy.create().await.expect("create legacy user");

    // Request a fresh code (no pre-existing verification record needed) ...
    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "email": email } }
    };
    assert_eq!(s, 200, "send-code for legacy email should succeed");

    // ... and log in with email + code only — no password supplied.
    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "email": email, "code": "000000" } }
    };
    assert_eq!(
        s, 200,
        "legacy password-having user must log in via email-code: {:?}",
        body
    );
}

/// Backward compatibility for already-shipped mobile apps (the Android build
/// in App Store review still sends password-based signup + login). The
/// restored `EmailPassword` variants must keep working alongside the new
/// email-code flow: sign up WITH a password, then log in WITH that password.
#[by_macros::pg_test]
async fn test_password_signup_and_login_backward_compat() {
    let ctx = TestContext::setup().await;

    let email = format!("pw-{}@test.com", uuid::Uuid::now_v7());
    let username = format!("u{}", &uuid::Uuid::now_v7().simple().to_string()[20..]);
    let password = "Secret!234";

    // Old-app signup: {email, password, code} → EmailPassword variant.
    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/signup",
        body: { "req": {
            "email": email, "password": password, "code": "000000",
            "display_name": "PW", "username": username, "profile_url": "",
            "description": "", "term_agreed": true, "informed_agreed": false
        } }
    };
    assert_eq!(s, 200, "password signup: {:?}", body);

    // Old-app login: {email, password} (no code) → EmailPassword variant.
    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "email": email, "password": password } }
    };
    assert_eq!(s, 200, "password login: {:?}", body);

    // Wrong password must be rejected.
    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "email": email, "password": "WrongPass!1" } }
    };
    assert_ne!(s, 200, "wrong password must not log in");
}

// ── Unified phone passwordless auth (login_with_phone) ──────────────────────
// No separate phone signup step: `/api/auth/login` with `LoginRequest::Phone`
// verifies the SMS code and auto-creates the account on first use. These
// tests replace the old `signup_with_phone`/`SignupType::Phone` coverage —
// that path has been retired in favor of this single entry point.

/// First login for a never-seen phone number creates a real, usable account:
/// a generated username that satisfies `validate_username`, a matching
/// display name, the shared default avatar, and the indexed `User.phone`
/// column populated (not just the `UserPhoneNumber` linkage row).
#[by_macros::pg_test]
async fn test_phone_login_first_time_auto_creates_user() {
    let ctx = TestContext::setup().await;

    let phone = format!("+1555{:07}", uuid::Uuid::now_v7().as_u128() % 10_000_000);

    // A PhoneVerification row must exist before login_with_phone will accept
    // the "000000" bypass code (the None check happens before the bypass
    // branch) — mirrors the real SMS flow's send-code step.
    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "phone": phone } }
    };
    assert_eq!(s, 200, "send-code for phone should succeed");

    let (s, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "phone": phone, "code": "000000" } },
        response_type: crate::features::auth::controllers::LoginResponse
    };
    assert_eq!(s, 200, "first-time phone login should auto-create + log in");

    let user = body.user;
    assert_eq!(user.phone.as_deref(), Some(phone.as_str()), "User.phone must be populated");
    assert!(
        !user.username.is_empty() && user.username.len() >= 3 && user.username.len() <= 20,
        "generated username must satisfy validate_username: {:?}",
        user.username
    );
    assert!(
        !user.display_name.is_empty(),
        "generated display_name must not be empty"
    );
    assert_eq!(
        user.profile_url,
        "https://metadata.ratel.foundation/ratel/default-profile.png",
        "auto-created phone user should get the shared default avatar"
    );
    assert_eq!(
        user.user_type,
        crate::common::types::UserType::Individual,
        "auto-created phone user should be Individual, not Anonymous"
    );

    // The UserPhoneNumber linkage row exists and points at this user.
    let linkage = crate::features::auth::UserPhoneNumber::find_by_phone_number(&phone)
        .await
        .expect("query UserPhoneNumber")
        .expect("linkage row must exist after first login");
    assert_eq!(linkage.user_pk, user.pk().to_string());
}

/// Logging in again with the SAME phone number returns the SAME user — no
/// duplicate account, idempotent on the `UserPhoneNumber` linkage.
#[by_macros::pg_test]
async fn test_phone_login_second_time_returns_same_user() {
    let ctx = TestContext::setup().await;

    let phone = format!("+1555{:07}", uuid::Uuid::now_v7().as_u128() % 10_000_000);

    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/verification/send-verification-code",
        body: { "req": { "phone": phone } }
    };
    assert_eq!(s, 200, "send-code for phone should succeed");

    let (s, _, body1) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "phone": phone, "code": "000000" } },
        response_type: crate::features::auth::controllers::LoginResponse
    };
    assert_eq!(s, 200, "first phone login");

    let (s, _, body2) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "phone": phone, "code": "000000" } },
        response_type: crate::features::auth::controllers::LoginResponse
    };
    assert_eq!(s, 200, "second phone login");

    assert_eq!(
        body1.user.id, body2.user.id,
        "same phone must resolve to the same user id across logins"
    );
}

/// A code for a phone number that never requested one is rejected (no
/// `PhoneVerification` row to check against).
#[by_macros::pg_test]
async fn test_phone_login_unknown_code_rejected() {
    let ctx = TestContext::setup().await;

    let phone = format!("+1555{:07}", uuid::Uuid::now_v7().as_u128() % 10_000_000);

    let (s, _, _) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/auth/login",
        body: { "req": { "phone": phone, "code": "123456" } }
    };
    assert_ne!(
        s, 200,
        "a phone with no PhoneVerification row must not log in"
    );
}

