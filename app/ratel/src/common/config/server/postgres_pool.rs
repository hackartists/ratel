use dioxus::fullstack::Lazy;
use postgres::sqlx::PgPool;
use postgres::sqlx::postgres::PgPoolOptions;

pub type PgClient = PgPool;

/// Process-global Postgres connection pool. Built lazily on first access from
/// [`PostgresConfig`] (which reads `DATABASE_URL`). Mirrors the DynamoDB `DB`
/// lazy in the sibling `dynamodb.rs`.
pub static POOL: Lazy<PgPool> = Lazy::new(|| async move {
    let config = PostgresConfig::default();

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        // Explicit acquire timeout (sqlx default is 30s) — kept modest so a
        // genuinely exhausted pool surfaces fast instead of hanging requests.
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect(&config.database_url)
        .await?;

    dioxus::Ok(pool)
});

pub struct PostgresConfig {
    pub database_url: String,
    pub max_connections: u32,
}

impl Default for PostgresConfig {
    fn default() -> Self {
        // `DATABASE_URL` wins; fall back to the conventional local dev DSN so
        // the pool can still boot in local/CI environments without extra env.
        let database_url = std::env::var("DATABASE_URL")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "postgres://ratel:ratel@127.0.0.1:5432/ratel".to_string());

        let max_connections = std::env::var("POSTGRES_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(20);

        PostgresConfig {
            database_url,
            max_connections,
        }
    }
}
