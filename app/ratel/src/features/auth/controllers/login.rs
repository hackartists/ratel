// Migrated from packages/main-api/src/controllers/v3/auth/login.rs
use crate::features::auth::models::*;
#[cfg(feature = "server")]
use crate::features::auth::utils::evm::{build_siwe_message, generate_nonce, recover_address};
use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(untagged)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum LoginRequest {
    Phone {
        phone: String,
        code: String,

        device_id: Option<String>,
    },
    // Backward-compat: password login used by already-shipped mobile apps
    // (the Android build currently in App Store review). Declared BEFORE the
    // email-code `Email` variant so an untagged `{email,password}` body
    // matches here instead of failing `Email{email,code}`.
    EmailPassword {
        email: String,
        password: String,
        #[serde(default)]
        device_id: Option<String>,
    },
    Email {
        email: String,
        code: String,
        #[serde(default)]
        device_id: Option<String>,
    },
    OAuth {
        provider: OauthProvider,
        access_token: String,
        // Optional so existing web clients don't break. Mobile clients
        // pass a stable device-scoped UUID so the server can mint a
        // refresh_token that survives app restarts.
        #[serde(default)]
        device_id: Option<String>,
    },
    Telegram {
        telegram_raw: String,
        #[serde(default)]
        device_id: Option<String>,
    },
    Wallet {
        signature: String,
        evm_address: String,
        message: String,
        #[serde(default)]
        device_id: Option<String>,
    },
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct LoginResponse {
    #[serde(flatten)]
    pub user: User,
    pub refresh_token: Option<String>,
}

#[post("/api/auth/login", session: Extension<tower_sessions::Session>)]
pub async fn login_handler(req: LoginRequest) -> Result<LoginResponse> {
    debug!("Login request: {:?}", req);
    let Extension(session) = session;

    let user = match req.clone() {
        LoginRequest::Phone {
            phone,
            code,
            device_id: _,
        } => login_with_phone(phone, code).await?,
        LoginRequest::EmailPassword {
            email,
            password,
            device_id: _,
        } => login_with_email_password(email, password).await?,
        LoginRequest::Email {
            email,
            code,
            device_id: _,
        } => login_with_email(email, code).await?,
        LoginRequest::OAuth {
            provider,
            access_token,
            device_id: _,
        } => login_with_oauth(provider, access_token).await?,
        LoginRequest::Telegram {
            telegram_raw,
            device_id: _,
        } => login_with_telegram(telegram_raw).await?,
        LoginRequest::Wallet {
            signature,
            evm_address,
            message,
            device_id: _,
        } => wallet_login_handler(evm_address, signature, message, &session).await?,
    };

    session
        .insert(SESSION_KEY_USER_ID, user.pk().to_string())
        .await?;

    let device_id: Option<String> = match &req.clone() {
        LoginRequest::Phone { device_id, .. } => device_id.clone(),
        LoginRequest::EmailPassword { device_id, .. } => device_id.clone(),
        LoginRequest::Email { device_id, .. } => device_id.clone(),
        LoginRequest::OAuth { device_id, .. } => device_id.clone(),
        LoginRequest::Telegram { device_id, .. } => device_id.clone(),
        LoginRequest::Wallet { device_id, .. } => device_id.clone(),
    };

    let refresh_token = if let Some(device_id) = device_id {
        let (rt, plain) = UserRefreshToken::new(&user, device_id);
        rt.save().await?;

        Some(plain)
    } else {
        None
    };

    Ok(LoginResponse {
        user,
        refresh_token,
    })
}

/// Default avatar for auto-created accounts (phone signup has no profile-picture
/// step). Same URL the web signup modal falls back to for OAuth/wallet/email
/// signups with no uploaded photo.
#[cfg(feature = "server")]
const DEFAULT_PROFILE_URL: &str = "https://metadata.ratel.foundation/ratel/default-profile.png";

/// Mints a random display name + matching username for an auto-created phone
/// account. `names::Generator::with_naming(Numbered)` emits lowercase
/// `word-word-1234`, which already satisfies `validate_username`'s character
/// rules (lowercase alphanumeric + `_`/`-`) — but not always its 3-20 char
/// length cap (the dictionary has entries like "black-and-white"), so this
/// retries past both a failed length check and a username/team collision.
#[cfg(feature = "server")]
async fn generate_phone_identity() -> Result<(String, String)> {
    use crate::features::auth::utils::validator::validate_username;
    use crate::features::posts::models::Team;

    for _ in 0..20 {
        let raw = names::Generator::with_naming(names::Name::Numbered)
            .next()
            .unwrap();
        let username = raw.clone();
        let display_name = raw.replace('-', " ");

        if validate_username(&username).is_err() {
            continue;
        }
        if User::find_by_username(&username).await?.is_some() {
            continue;
        }
        if Team::find_by_username(&username).await?.is_some() {
            continue;
        }

        return Ok((display_name, username));
    }

    Err(Error::UsernameAlreadyExists)
}

/// Unified phone auth: verifies the SMS code, then logs in the existing
/// `UserPhoneNumber`-linked user or auto-creates one on first use (no
/// password, no separate signup step — see `signup.rs`'s retired
/// `signup_with_phone`, which this supersedes).
#[cfg(feature = "server")]
pub async fn login_with_phone(phone: String, code: String) -> Result<User> {
    // Verify the phone verification code
    let now = crate::common::utils::time::get_now_timestamp();
    let verification = PhoneVerification::find_by_phone(&phone).await?;

    if verification.is_none() {
        return Err(Error::NotFoundVerificationCode);
    }

    #[cfg(feature = "bypass")]
    if code.eq("000000") {
        // Bypass verification for testing
    } else {
        let phone_verification = verification.clone().unwrap();

        if phone_verification.expired_at < now {
            return Err(Error::ExpiredVerification);
        }

        if phone_verification.value != code {
            phone_verification.increase_attempt_count().await?;
            return Err(Error::InvalidVerificationCode);
        }
    }

    #[cfg(not(feature = "bypass"))]
    {
        let phone_verification = verification.clone().unwrap();

        if phone_verification.expired_at < now {
            return Err(Error::ExpiredVerification);
        }

        if phone_verification.value != code {
            phone_verification.increase_attempt_count().await?;
            return Err(Error::InvalidVerificationCode);
        }
    }

    // Get or create user by phone number
    let existing_phone = UserPhoneNumber::find_by_phone_number(&phone).await?;

    let user = if existing_phone.is_none() {
        // Auto-create on first use: random display name/username (same
        // generator `User::new_phone` used to use), the shared default
        // avatar, and `Individual` rather than `Anonymous` — this is a real,
        // fully-usable account, just one that skipped the profile-entry step.
        let (display_name, username) = generate_phone_identity().await?;
        let email = format!("{}@phone.placeholder", username);

        let mut user = User::new(
            display_name,
            email,
            DEFAULT_PROFILE_URL.to_string(),
            true,  // term_agreed: no ToS checkbox in the SMS flow, default to agreed
            false, // informed_agreed
            UserType::Individual,
            username,
            None, // No password
        );
        // Populate the indexed `phone` column too, not just the
        // `UserPhoneNumber` linkage row, so admin tooling / future lookups
        // via `User::find_by_phone` work.
        user.phone = Some(phone.clone());

        let user_phone = UserPhoneNumber::new(user.pk(), phone.clone());

        // Create the user row first, then persist the phone linkage row (no
        // cross-table transaction yet).
        user.create().await?;
        user_phone.save().await?;

        user
    } else {
        let user_phone = existing_phone.ok_or(AuthError::PhoneNotFound)?;
        let user_pk: Partition = user_phone
            .user_pk
            .parse()
            .map_err(|_| AuthError::UserNotFound)?;
        User::find_by_pk(&user_pk)
            .await?
            .ok_or(AuthError::UserNotFound)?
    };

    Ok(user)
}

#[cfg(feature = "server")]
pub async fn login_with_oauth(provider: OauthProvider, access_token: String) -> Result<User> {
    let email = provider.get_email(&access_token).await?;

    let user = User::find_by_email(&email)
        .await?
        .ok_or(AuthError::UserNotFound)?;

    Ok(user)
}

#[cfg(feature = "server")]
pub async fn login_with_email(email: String, code: String) -> Result<User> {
    crate::features::auth::controllers::verify_code::verify_email_code(&email, &code).await?;

    // Valid code but no account → caller (frontend) treats this as "go signup".
    // A tombstoned (soft-deleted) row is treated the same as "no account".
    let user = User::find_by_email(&email)
        .await?
        .ok_or(AuthError::UserNotFound)?;
    if user.deleted_at.is_some() {
        return Err(AuthError::UserNotFound.into());
    }
    Ok(user)
}

/// Backward-compat: password login for already-shipped mobile apps (the
/// Android build in App Store review). Looks the user up by email + hashed
/// password. New clients use the email-code `login_with_email` path.
#[cfg(feature = "server")]
pub async fn login_with_email_password(email: String, password: String) -> Result<User> {
    let hashed_password = crate::common::utils::password::hash_password(&password);
    User::find_by_email_and_password(&email, &hashed_password)
        .await?
        .ok_or(AuthError::InvalidCredentials.into())
}

#[cfg(feature = "server")]
pub async fn login_with_telegram(telegram_raw: String) -> Result<User> {
    let telegram_user = crate::features::auth::utils::telegram::parse_telegram_raw(
        telegram_raw.clone(),
    )
    .map_err(|e| {
        crate::error!("Failed to parse telegram raw data: {e}");
        AuthError::InvalidTelegramData
    })?;
    tracing::debug!("Parsed telegram user: {:?}", telegram_user);
    let existing_telegram = UserTelegram::find_by_telegram_id(telegram_user.id).await?;
    let user = if existing_telegram.is_none() {
        let username = telegram_user
            .username
            .clone()
            .unwrap_or(format!("telegram{}", telegram_user.id))
            .to_lowercase();
        let display_name = format!(
            "{} {}",
            telegram_user.first_name.unwrap_or_default(),
            telegram_user.last_name.unwrap_or_default()
        );
        let email = format!("{}@telegram.placeholder", username);
        let user = User::new(
            display_name,
            email,
            telegram_user.photo_url.unwrap_or_default(),
            false,
            false,
            UserType::Anonymous,
            username,
            None,
        );
        let user_telegram = UserTelegram::new(user.pk(), telegram_user.id, telegram_raw);

        // Create the user row first, then persist the telegram linkage row
        // (no cross-table transaction yet).
        user.create().await?;
        user_telegram.save().await?;
        user
    } else {
        let user_telegram = existing_telegram.ok_or(AuthError::UserNotFound)?;
        let user_pk: Partition = user_telegram
            .user_pk
            .parse()
            .map_err(|_| AuthError::UserNotFound)?;
        User::find_by_pk(&user_pk)
            .await?
            .ok_or(AuthError::UserNotFound)?
    };

    Ok(user)
}

/// Returns `is_new_user: true` if the address is not registered.

#[cfg(feature = "server")]
pub async fn wallet_login_handler(
    address: String,
    signature: String,
    message: String,
    session: &tower_sessions::Session,
) -> Result<User> {
    // Verify nonce from session
    let stored_nonce: Option<String> = session.get("wallet_nonce").await.map_err(|e| {
        crate::error!("session: {e}");
        AuthError::SessionFailed
    })?;

    let stored_nonce = stored_nonce.ok_or_else(|| AuthError::NonceNotFound)?;

    if !message.contains(&stored_nonce) {
        return Err(AuthError::NonceMismatch.into());
    }

    // Verify signature
    let recovered_address = recover_address(&message, &signature)?;
    if recovered_address.to_lowercase() != address.to_lowercase() {
        return Err(AuthError::InvalidSignature.into());
    }

    // Clear nonce (one-time use)
    session.remove::<String>("wallet_nonce").await.ok();

    let evm_record = UserEvmAddress::find_by_evm(&address.to_lowercase()).await?;

    if let Some(evm_record) = evm_record {
        let user_pk: Partition = evm_record
            .user_pk
            .parse()
            .map_err(|_| AuthError::UserNotFound)?;
        let user = User::find_by_pk(&user_pk)
            .await?
            .ok_or(AuthError::UserNotFound)?;

        return Ok(user);
    }
    Err(AuthError::UserNotFound.into())
}

// ── Wallet address check ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct WalletCheckRequest {
    pub evm_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct WalletCheckResponse {
    pub exists: bool,
}

#[post("/api/auth/wallet/check")]
pub async fn wallet_check_handler(req: WalletCheckRequest) -> Result<WalletCheckResponse> {
    let record = UserEvmAddress::find_by_evm(&req.evm_address.to_lowercase()).await?;

    Ok(WalletCheckResponse {
        exists: record.is_some(),
    })
}

// ── Nonce generation ────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct WalletNonceResponse {
    pub nonce: String,
    pub message: String,
}

/// Generate a nonce for SIWE verification (used by both login and signup).
#[post("/api/auth/wallet/nonce", session: Extension<tower_sessions::Session>)]
pub async fn wallet_nonce_handler() -> crate::common::Result<WalletNonceResponse> {
    tracing::info!("[wallet-server] nonce_handler called");
    let Extension(session) = session;
    let nonce = generate_nonce();
    let message = build_siwe_message(&nonce);

    session
        .insert("wallet_nonce", nonce.clone())
        .await
        .map_err(|e| {
            crate::error!("session: {e}");
            AuthError::SessionFailed
        })?;

    Ok(WalletNonceResponse { nonce, message })
}
