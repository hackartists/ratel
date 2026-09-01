use crate::axum;
use crate::axum::Router;
use crate::common::aws_sdk_dynamodb;
use crate::common::mcp::mcp_router;
use crate::common::models::auth::User;
use crate::common::types::UserType;
use crate::common::utils::password::hash_password;

use crate::App;

#[derive(Clone)]
pub struct TestContext {
    pub app: Router,
    pub ddb: aws_sdk_dynamodb::Client,
    pub test_user: (User, axum::http::HeaderMap),
}

impl TestContext {
    pub async fn setup() -> Self {
        let _ = tracing_subscriber::fmt()
            .with_env_filter("error")
            .try_init();

        // Postgres test harness: init the global pool + migrate the schema for
        // every migrated PostgresEntity model, once per test process. Runs
        // alongside the still-DynamoDB entities during the migration. Uses
        // DATABASE_URL if set, else the local asset-postgres container.
        #[cfg(feature = "server")]
        init_test_postgres().await;

        let config = crate::config::get();
        let cli = config.common.dynamodb();

        let session_layer = crate::common::middlewares::session_layer::get_session_layer(
            config.common.env.to_string(),
        );

        let mcp_router = crate::common::mcp::mcp_router();
        let arcade_router = crate::features::arcade::server::router();
        let dioxus_router = dioxus::server::router(App)
            .merge(mcp_router)
            .merge(arcade_router)
            .merge(crate::features::launchpad_partner::server::router());
        let app = dioxus_router.layer(session_layer);
        crate::common::mcp::set_app_router(app.clone());

        // Match the production startup sequence: register arcade realtime
        // channels with the per-process global hub so the SSE endpoint can
        // resolve handlers in tests too. Register exactly ONCE per process:
        // the hub is a global singleton, and re-registering on every
        // `setup()` churns the hub's async RwLock. Under the shared test
        // runtime (which never drops), a prior test's lingering SSE
        // subscriber can hold a read guard, so a later `register()` write
        // acquire would block forever and stall the whole suite. Once-only
        // registration matches production (called once at startup) and avoids
        // the contention entirely.
        {
            use std::sync::atomic::{AtomicBool, Ordering};
            static CHANNELS_REGISTERED: AtomicBool = AtomicBool::new(false);
            if !CHANNELS_REGISTERED.swap(true, Ordering::SeqCst) {
                crate::features::arcade::games::fact_or_fold::realtime::register_channels().await;
            }
        }

        let ddb = cli.clone();
        let test_user = create_user_session(app.clone(), &ddb).await;

        TestContext {
            app,
            ddb,
            test_user,
        }
    }

    pub async fn create_another_user(&self) -> (User, axum::http::HeaderMap) {
        create_user_session(self.app.clone(), &self.ddb).await
    }

    pub async fn create_admin_user(&self) -> (User, axum::http::HeaderMap) {
        create_admin_user_session(self.app.clone(), &self.ddb).await
    }
}

/// One-time Postgres init for the test process: connect the pool, install it
/// as the global pool the migrated models resolve through, and apply the
/// inventory schema (creates every migrated table). Idempotent across the many
/// `setup()` calls in a run (tests run `--test-threads=1`).
#[cfg(feature = "server")]
async fn init_test_postgres() {
    use std::sync::atomic::{AtomicBool, Ordering};
    static DONE: AtomicBool = AtomicBool::new(false);
    // Only skip if a PREVIOUS call fully succeeded. Setting the flag up-front
    // (swap-true) was a bug: if the first test's connect/schema-create failed
    // (e.g. Postgres still accepting connections at first-test time in CI), the
    // flag latched true with the global pool never set, and every subsequent
    // test then panicked "global pool not set". `init` runs under the serialized
    // DB_TEST_LOCK, so a plain load-then-store-at-end has no race and lets a
    // transient first-attempt failure be retried by the next test.
    if DONE.load(Ordering::SeqCst) {
        return;
    }
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://asset:asset@127.0.0.1:5433/ratel_test".to_string());
    // A single controller request can check out several connections at once
    // (an outer `Tx` plus nested repository reads), so the sqlx default of 10
    // exhausts the pool and callers hit `PoolTimedOut`. The test DB allows 100
    // connections; give the shared test pool generous headroom.
    //
    // Connection hygiene for the shared, never-dropped process-global test pool.
    // A controller future cancelled mid-query (e.g. a `try_join!` aborting a
    // sibling, or any dropped request future) leaves its sqlx connection in an
    // inconsistent protocol state. Two independent guards keep one such wedged
    // connection from hanging the whole suite:
    //
    // * `test_before_acquire(false)` — sqlx's DEFAULT behaviour is to health-ping
    //   every connection *before* handing it out, and that ping has NO timeout.
    //   A ping issued against a protocol-wedged connection blocks forever,
    //   permanently leaking that connection's pool permit; a few of these across
    //   498 tests exhaust the pool and every later test hangs (the CI-only
    //   "runs fine locally, hangs for hours in CI" symptom). Disabling the
    //   pre-acquire ping removes that unbounded wait entirely — a wedged
    //   connection is handed out and *fails its next query fast* (a surfaced
    //   error) instead of hanging on the ping.
    // * `after_release(false)` — every connection is CLOSED (not reused) when
    //   returned to the pool, so a possibly-wedged connection is dropped rather
    //   than lingering for a later acquire. The next acquire opens a fresh one;
    //   the per-acquire connect cost is negligible against a local PG.
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .max_connections(50)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .test_before_acquire(false)
        .after_release(|_conn, _meta| Box::pin(async move { Ok(false) }))
        .connect(&url)
        .await
        .expect("test postgres: connect (is the postgres container up?)");
    postgres::set_global_pool(pool.clone());
    // Reset to a clean slate at the start of each test process: DROP every
    // inventory table, then CREATE them fresh. The `ratel_test` DB persists
    // between `cargo test` runs, and many tests seed rows under fixed natural
    // keys (e.g. usernames `chld0..chld50`, singleton settings rows). Without a
    // reset those collide with a previous run's leftovers on the second run
    // (unique-constraint violations, count assertions off), making the suite
    // pass once then fail on every re-run. Drop+create makes every run
    // reproducible. (Mirrors asset's `with_pg` schema rebuild.)
    let schema = postgres::Schema::from_inventory();
    schema.drop(&pool).await.ok(); // ignore "table doesn't exist" on first run
    schema
        .create(&pool)
        .await
        .expect("test postgres: schema create");
    // Mark done only after the pool is set AND the schema is built, so a
    // transient earlier failure is retried rather than latched.
    DONE.store(true, Ordering::SeqCst);
}

pub fn create_user_name() -> String {
    format!("user{}", uuid::Uuid::new_v4())
}

pub fn create_nick_name() -> String {
    let short_uuid = &uuid::Uuid::new_v4().simple().to_string()[..6];
    format!("nickname{}", short_uuid)
}

pub async fn create_test_user(_cli: &aws_sdk_dynamodb::Client) -> User {
    let profile = "https://ratel.foundation/images/default-profile.png".to_string();
    let username = create_user_name();
    let nickname = create_nick_name();
    let email = format!("a+{}@example.com", nickname);

    let user = User::new(
        nickname,
        email,
        profile,
        true,
        true,
        UserType::Individual,
        username,
        Some("password".to_string()),
    );
    user.create().await.unwrap();

    user
}

pub async fn create_user_session(
    app: Router,
    cli: &aws_sdk_dynamodb::Client,
) -> (User, axum::http::HeaderMap) {
    create_session_with_user_type(app, cli, UserType::Individual).await
}

pub async fn create_admin_user_session(
    app: Router,
    cli: &aws_sdk_dynamodb::Client,
) -> (User, axum::http::HeaderMap) {
    create_session_with_user_type(app, cli, UserType::SystemAdmin).await
}

async fn create_session_with_user_type(
    app: Router,
    _cli: &aws_sdk_dynamodb::Client,
    user_type: UserType,
) -> (User, axum::http::HeaderMap) {
    let uid = uuid::Uuid::new_v4().to_string();
    let email = format!("{}@example.com", uid);
    let password = hash_password(&uid);
    let user = User::new(
        format!("displayName{}", uid),
        email.clone(),
        "https://metadata.ratel.foundation/ratel/default-profile.png".to_string(),
        true,
        true,
        user_type,
        uid.clone(),
        Some(password),
    );

    user.create().await.expect("Failed to create user");

    // Email-code login (passwordless). Sending only {email, code} matches the
    // `Email` variant; including a `password` would now match the restored
    // backward-compat `EmailPassword` variant and fail (the setup user's
    // stored password isn't hashed to match login_with_email_password).
    let (_, header, _) = crate::test_post! {
        app: app,
        path: "/api/auth/login",
        body: {
            "req": {
                "email": email,
                "code": "000000"
            }
        }
    };
    let session_cookie = header
        .get("set-cookie")
        .expect("No set-cookie header found")
        .to_str()
        .expect("Failed to convert set-cookie header to str")
        .to_string();
    let mut headers = axum::http::HeaderMap::new();
    headers.insert("cookie", session_cookie.parse().unwrap());
    (user, headers)
}
