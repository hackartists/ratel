// Migrated from packages/main-api/src/controllers/v3/auth/verification/send_code.rs
use crate::features::auth::models::*;
use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(untagged)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum SendCodeRequest {
    SMS { phone: String },
    Email { email: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct SendCodeResponse {
    pub expired_at: i64,
}

#[post("/api/auth/verification/send-verification-code")]
pub async fn send_code_handler(req: SendCodeRequest) -> Result<SendCodeResponse> {
    match req {
        SendCodeRequest::Email { email } => send_email_code_handler(email).await,
        SendCodeRequest::SMS { phone } => send_phone_code_handler(phone).await,
    }
}

#[cfg(feature = "server")]
pub async fn send_phone_code_handler(phone: String) -> Result<SendCodeResponse> {
    use crate::features::auth::constants::{
        ATTEMPT_BLOCK_TIME, EXPIRATION_TIME, MAX_ATTEMPT_COUNT,
    };
    use crate::features::auth::utils::generate_random_numeric_code;

    let sns = crate::features::auth::config::get().sns();

    let existing = PhoneVerification::find_by_phone(&phone).await?;

    let PhoneVerification {
        value, expired_at, ..
    } = if existing.as_ref().is_some_and(|v| {
        v.expired_at > crate::common::utils::time::get_now_timestamp()
            && v.attempt_count < MAX_ATTEMPT_COUNT
    }) {
        existing.clone().unwrap()
    } else if existing.as_ref().is_some_and(|v| {
        v.attempt_count >= MAX_ATTEMPT_COUNT
            && v.expired_at
                < (crate::common::utils::time::get_now_timestamp() - ATTEMPT_BLOCK_TIME)
    }) {
        return Err(Error::ExceededAttemptPhoneVerification);
    } else {
        let code = generate_random_numeric_code();
        let expired_at = crate::common::utils::time::get_now_timestamp() + EXPIRATION_TIME as i64;

        if let Some(mut v) = existing.clone() {
            v.attempt_count = 0;
            v.value = code.clone();
            v.expired_at = expired_at;
            // Natural-key upsert on `phone` preserves the surrogate id/created_at.
            v.save().await?;
            v
        } else {
            let phone_verification = PhoneVerification::new(phone.clone(), code, expired_at);
            phone_verification.save().await?;
            phone_verification
        }
    };

    // Send SMS with verification code
    let message = format!(
        "Ratel: {} is your code for login. Don't share your code",
        value
    );
    sns.send_sms(&phone, &message).await?;

    Ok(SendCodeResponse { expired_at })
}

#[cfg(feature = "server")]
pub async fn send_email_code_handler(email: String) -> Result<SendCodeResponse> {
    // No existence check: this code serves BOTH login (existing account) and
    // signup (new account) in the unified passwordless flow.
    send_email_code(email).await
}

/// Sends an email verification code without checking for existing accounts.
/// Used by the unified passwordless flow (login + signup share one code).
#[cfg(feature = "server")]
async fn send_email_code(email: String) -> Result<SendCodeResponse> {
    use crate::common::models::notification::Notification;
    use crate::features::auth::constants::{
        ATTEMPT_BLOCK_TIME, EXPIRATION_TIME, MAX_ATTEMPT_COUNT,
    };
    use crate::features::auth::utils::generate_random_code;

    // Reviewer test accounts never receive a real verification email; the fixed
    // code "000000" is accepted at verification time (see `verify_email_code`).
    // Return a normal future expiry so the client's code-entry UI behaves as usual.
    if crate::common::models::auth::TestAccount::is_test_account(&email).await {
        let expired_at = crate::common::utils::time::get_now_timestamp() + EXPIRATION_TIME as i64;
        return Ok(SendCodeResponse { expired_at });
    }

    let existing = EmailVerification::find_by_email(&email).await?;

    let EmailVerification {
        value, expired_at, ..
    } = if existing.as_ref().is_some_and(|v| {
        v.expired_at > crate::common::utils::time::get_now_timestamp()
            && v.attempt_count < MAX_ATTEMPT_COUNT
    }) {
        existing.clone().unwrap()
    } else if existing.as_ref().is_some_and(|v| {
        v.attempt_count >= MAX_ATTEMPT_COUNT
            && v.expired_at
                < (crate::common::utils::time::get_now_timestamp() - ATTEMPT_BLOCK_TIME)
    }) {
        return Err(Error::ExceededAttemptEmailVerification);
    } else {
        let code = generate_random_code();
        let expired_at = crate::common::utils::time::get_now_timestamp() + EXPIRATION_TIME as i64;

        if let Some(mut v) = existing.clone() {
            v.attempt_count = 0;
            v.value = code.clone();
            v.expired_at = expired_at;
            v.save().await?;
            v
        } else {
            let email_verification = EmailVerification::new(email.clone(), code, expired_at);
            email_verification.save().await?;
            email_verification
        }
    };

    // Create a Notification document instead of directly calling SES.
    // DynamoDB Streams will trigger a Lambda function to send the email.
    let notification = Notification::new(NotificationData::SendVerificationCode {
        code: value,
        email: email.clone(),
    });
    notification.save().await?;

    Ok(SendCodeResponse { expired_at })
}
