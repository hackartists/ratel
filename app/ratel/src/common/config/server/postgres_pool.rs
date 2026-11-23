use dioxus::fullstack::Lazy;
use postgres::sqlx::PgPool;
use postgres::sqlx::postgres::PgPoolOptions;

pub type PgClient = PgPool;

/// Process-global Postgres connection pool configured by [`PostgresConfig`].
pub static POOL: Lazy<PgPool> = Lazy::new(|| async move {
    let config = PostgresConfig::default();

    let pool = PgPoolOptions::new()
        .max_connections(config.max_connections)
        .min_connections(config.min_connections.min(config.max_connections))
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect(&config.database_url)
        .await?;

    dioxus::Ok(pool)
});

pub struct PostgresConfig {
    pub database_url: String,
    pub max_connections: u32,
    /// Connections kept open while idle (`POSTGRES_MIN_CONNECTIONS`, default 2).
    pub min_connections: u32,
}

impl Default for PostgresConfig {
    fn default() -> Self {
        let database_url = std::env::var("DATABASE_URL")
            .ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "postgres://ratel:ratel@127.0.0.1:5432/ratel".to_string());

        let max_connections = std::env::var("POSTGRES_MAX_CONNECTIONS")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(20);

        let min_connections = std::env::var("POSTGRES_MIN_CONNECTIONS")
            .ok()
            .and_then(|v| v.trim().parse().ok())
            .unwrap_or(2);

        PostgresConfig {
            database_url,
            max_connections,
            min_connections,
        }
    }
}
