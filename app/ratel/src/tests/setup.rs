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

        // Match the production startup sequence: register arcade
        // realtime channels with the per-process global hub so the
        // SSE endpoint can resolve handlers in tests too.
        crate::features::arcade::games::fact_or_fold::realtime::register_channels().await;

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
    if DONE.swap(true, Ordering::SeqCst) {
        return;
    }
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://asset:asset@127.0.0.1:5433/ratel_test".to_string());
    // A single controller request can check out several connections at once
    // (an outer `Tx` plus nested repository reads), so the sqlx default of 10
    // exhausts the pool and callers hit `PoolTimedOut`. The test DB allows 100
    // connections; give the shared test pool generous headroom.
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .max_connections(50)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect(&url)
        .await
        .expect("test postgres: connect (is the postgres container up?)");
    postgres::set_global_pool(pool.clone());
    postgres::Schema::from_inventory()
        .migrate(&pool)
        .await
        .expect("test postgres: schema migrate");
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
