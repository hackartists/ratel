//! Integration tests for arcade-level endpoints (PR4c surface).
//!
//! Covers:
//!   - GET /api/arcade/wallet — empty balance for new user
//!   - POST /api/arcade/wallet/convert — RP→chip; rp debit + chip credit
//!   - POST /api/arcade/wallet/redeem — disabled in v1
//!   - PUT /api/arcade/admin/settings — operator can tune ratio + buy_in
//!   - admin endpoints reject non-admin
//!
//! FOF lobby ↔ wallet interaction (buy_in / settle) lives in
//! `fact_or_fold_tests.rs` next to the other lobby integration tests.

use super::*;

use crate::common::types::Partition;
use crate::features::arcade::models::ArcadeWalletBalance;
use crate::features::arcade::types::{ArcadeSettingsResponse, ConvertRpResponse, WalletStateResponse};
use postgres::PostgresEntity;

// ── Helpers ───────────────────────────────────────────────────────

/// Set the User's RP balance directly via Postgres so convert tests
/// don't need to thread through admin grant endpoints.
async fn grant_rp_for_test(_ctx: &TestContext, user_pk: &Partition, rp: i64) {
    use crate::common::models::auth::User;
    let Some(id) = User::id_from_partition(user_pk) else {
        panic!("grant_rp_for_test: not a user partition: {user_pk:?}");
    };
    User::repository()
        .update(
            id,
            User::update()
                .points(rp)
                .updated_at(crate::common::utils::time::get_now_timestamp_millis()),
        )
        .await
        .expect("grant rp update");
}

/// Reset the singleton `ArcadeSettings` row so the next read returns
/// `ArcadeSettingsResponse::default()`. Sibling tests that PUT a
/// custom config (e.g. `test_arcade_settings_put_persists`,
/// `test_redeem_flag_can_be_flipped`) leave the row dirty across
/// parallel runs against a shared Postgres instance — any test that
/// asserts default behaviour must reset first.
async fn reset_arcade_settings(_ctx: &TestContext) {
    use crate::features::arcade::models::{ARCADE_SETTINGS_SINGLETON, ArcadeSettings};
    use postgres::ops::StringOp;
    // Absent row is a no-op; either way the post-condition is "row absent".
    if let Some(row) = ArcadeSettings::repository()
        .find_one(
            ArcadeSettings::query().singleton(StringOp::Eq(ARCADE_SETTINGS_SINGLETON.to_string())),
        )
        .await
        .unwrap_or(None)
    {
        let _ = ArcadeSettings::delete_by_id(row.id).await;
    }
}

async fn enable_redeem(ctx: &TestContext, admin: &axum::http::HeaderMap) {
    let (status, _, _) = crate::test_put! {
        app: ctx.app.clone(),
        path: "/api/arcade/admin/settings",
        headers: admin.clone(),
        body: { "req": { "redeem_enabled": true } }
    };
    assert_eq!(status, 200);
}

// ── Wallet — read ─────────────────────────────────────────────────

#[by_macros::pg_test]
async fn test_wallet_zero_balance_for_new_user() {
    let ctx = TestContext::setup().await;
    reset_arcade_settings(&ctx).await;
    let (status, _, body) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/wallet",
        headers: ctx.test_user.1.clone(),
        response_type: WalletStateResponse,
    };
    assert_eq!(status, 200);
    assert_eq!(body.chip_balance, 0);
    // Defaults from ArcadeSettingsResponse::default
    assert_eq!(body.rp_to_chip_ratio_bps, 10_000);
    assert!(!body.redeem_enabled);
}

#[by_macros::pg_test]
async fn test_wallet_requires_auth() {
    let ctx = TestContext::setup().await;
    let (status, _, _) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/wallet",
    };
    assert_ne!(status, 200);
}

// ── Wallet — convert ──────────────────────────────────────────────

#[by_macros::pg_test]
async fn test_convert_rp_to_chip_debits_rp_and_credits_chip() {
    let ctx = TestContext::setup().await;
    // Reset settings so the 1:1 default ratio is in effect — sibling
    // PUT test installs 2:1 which would skew chips_credited below.
    reset_arcade_settings(&ctx).await;
    grant_rp_for_test(&ctx, &ctx.test_user.0.pk(), 500).await;

    let (status, _, body) = crate::test_post! {
        app: ctx.app.clone(),
        path: "/api/arcade/wallet/convert",
        headers: ctx.test_user.1.clone(),
        body: { "req": { "rp_amount": 300 } },
        response_type: ConvertRpResponse,
    };
    assert_eq!(status, 200, "convert must succeed: {:?}", body);
    assert_eq!(body.rp_debited, 300);
    assert_eq!(body.chips_credited, 300); // 1:1 default
    assert_eq!(body.balance_after, 300);

    // Wallet balance reflects credit
    let (_, _, w) = crate::test_get! {
        app: ctx.app.clone(),
        path: "/api/arcade/wallet",
        headers: ctx.test_user.1.clone(),
        response_type: WalletStateResponse,
    };
    assert_eq!(w.chip_balance, 300);
}

#[by_macros::pg_test]
async fn test_convert_rejects_insufficient_rp() {
    let ctx = TestContext::setup().await;
    // RP balance stays at 0
    let (status, _, _) = crate::test_post! {
        app: ctx.app,
        path: "/api/arcade/wallet/convert",
        headers: ctx.test_user.1.clone(),
        body: { "req": { "rp_amount": 100 } }
    };
    assert_ne!(status, 200);
}

#[by_macros::pg_test]
async fn test_convert_rejects_below_minimum() {
    let ctx = TestContext::setup().await;
    // Reset so default min_convert_rp=100 is the gate (siblings can
    // PUT custom min).
    reset_arcade_settings(&ctx).await;
    grant_rp_for_test(&ctx, &ctx.test_user.0.pk(), 10_000).await;
    let (status, _, _) = crate::test_post! {
        app: ctx.app,
        path: "/api/arcade/wallet/convert",
        headers: ctx.test_user.1.clone(),
        // default min_convert_rp = 100; 50 is below
        body: { "req": { "rp_amount": 50 } }
    };
    assert_ne!(status, 200, "below-minimum convert must be rejected");
}

// ── Wallet — redeem (disabled v1) ─────────────────────────────────

#[by_macros::pg_test]
async fn test_redeem_disabled_in_v1() {
    let ctx = TestContext::setup().await;
    // Seed some chips directly so the chips themselves aren't the
    // blocker.
    let user_id = ctx.test_user.0.id();
    let now = crate::common::utils::time::get_now_timestamp_millis();
    ArcadeWalletBalance {
        id: uuid::Uuid::now_v7(),
        user_id,
        created_at: now,
        updated_at: now,
        chip_balance: 500,
    }
    .upsert()
    .await
    .expect("seed balance");

    let (status, _, _) = crate::test_post! {
        app: ctx.app,
        path: "/api/arcade/wallet/redeem",
        headers: ctx.test_user.1.clone(),
        body: { "req": { "chip_amount": 100 } }
    };
    assert_ne!(status, 200, "redeem must be disabled in v1");
}

// ── Admin settings ────────────────────────────────────────────────

#[by_macros::pg_test]
async fn test_arcade_settings_get_returns_defaults() {
    let ctx = TestContext::setup().await;
    reset_arcade_settings(&ctx).await;
    let (_, admin) = ctx.create_admin_user().await;
    let (status, _, body) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/admin/settings",
        headers: admin,
        response_type: ArcadeSettingsResponse,
    };
    assert_eq!(status, 200);
    assert_eq!(body.rp_to_chip_ratio_bps, 10_000);
    assert_eq!(body.default_buy_in_chips, 100);
    assert!(!body.redeem_enabled);
}

#[by_macros::pg_test]
async fn test_arcade_settings_put_persists() {
    let ctx = TestContext::setup().await;
    let (_, admin) = ctx.create_admin_user().await;

    let (status, _, body) = crate::test_put! {
        app: ctx.app.clone(),
        path: "/api/arcade/admin/settings",
        headers: admin.clone(),
        body: { "req": { "default_buy_in_chips": 50, "rp_to_chip_ratio_bps": 20_000 } },
        response_type: ArcadeSettingsResponse,
    };
    assert_eq!(status, 200);
    assert_eq!(body.default_buy_in_chips, 50);
    assert_eq!(body.rp_to_chip_ratio_bps, 20_000);

    // Read-back
    let (_, _, body) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/admin/settings",
        headers: admin,
        response_type: ArcadeSettingsResponse,
    };
    assert_eq!(body.default_buy_in_chips, 50);
    assert_eq!(body.rp_to_chip_ratio_bps, 20_000);
}

#[by_macros::pg_test]
async fn test_arcade_settings_rejects_non_admin() {
    let ctx = TestContext::setup().await;
    let (status, _, _) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/admin/settings",
        headers: ctx.test_user.1.clone(),
    };
    assert_ne!(status, 200);
}

#[by_macros::pg_test]
async fn test_arcade_settings_rejects_invalid_values() {
    let ctx = TestContext::setup().await;
    let (_, admin) = ctx.create_admin_user().await;
    let (status, _, _) = crate::test_put! {
        app: ctx.app,
        path: "/api/arcade/admin/settings",
        headers: admin,
        body: { "req": { "default_buy_in_chips": -10 } }
    };
    assert_ne!(status, 200);
}

// ── SSE realtime ──────────────────────────────────────────────────

#[by_macros::pg_test]
async fn test_events_rejects_unknown_channel() {
    let ctx = TestContext::setup().await;
    // `unknown_kind` is not registered with the hub. PR4f registered
    // `fof.chat` so we use a deliberately bogus kind here.
    let (status, _, _) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/events?channel=unknown_kind:abc",
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(
        status,
        axum::http::StatusCode::NOT_FOUND,
        "unknown channel kind must 404"
    );
}

#[by_macros::pg_test]
async fn test_events_chat_rejects_non_participant() {
    // fof.chat is registered. authorize() loads the round and
    // checks the participant list — a round id that doesn't exist
    // (or that the caller hasn't joined) must come back as
    // ChannelForbidden / 403.
    let ctx = TestContext::setup().await;
    let (status, _, _) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/events?channel=fof.chat:nonexistent-round",
        headers: ctx.test_user.1.clone(),
    };
    assert_eq!(
        status,
        axum::http::StatusCode::FORBIDDEN,
        "non-participant must be denied chat subscribe"
    );
}

#[by_macros::pg_test]
async fn test_events_rejects_unauthenticated() {
    let ctx = TestContext::setup().await;
    let (status, _, _) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/events?channel=fof.chat:abc",
    };
    assert_ne!(status, 200, "unauthenticated SSE subscription must fail");
}

#[by_macros::pg_test]
async fn test_redeem_flag_can_be_flipped() {
    // Demonstrates that the v2 path opens up by flipping the
    // operator-side `redeem_enabled` flag (the wallet impl still
    // returns disabled — this only verifies the settings round-trip).
    let ctx = TestContext::setup().await;
    let (_, admin) = ctx.create_admin_user().await;
    enable_redeem(&ctx, &admin).await;

    let (_, _, body) = crate::test_get! {
        app: ctx.app,
        path: "/api/arcade/admin/settings",
        headers: admin,
        response_type: ArcadeSettingsResponse,
    };
    assert!(body.redeem_enabled, "flag must persist after PUT");
}
