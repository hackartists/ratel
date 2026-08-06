extern crate self as event;

mod config;
mod error;
mod produce;

#[cfg(feature = "server")]
mod consumer;
#[cfg(feature = "server")]
pub mod shutdown;

pub use error::Error;
pub use event_macros::event;
pub use produce::{produce, produce_keyed};

#[cfg(feature = "server")]
pub use consumer::{EventConsumer, run};

pub use futures::future::BoxFuture;
pub use inventory;

/// Deployment stage for topic names — the `ENV` **runtime** env var
/// (fallback `"dev"`), read once per process and cached. Called lazily by the
/// generated topic fns, so it resolves after the process env is initialized
/// (dotenvy / container env). Builds carry no `ENV`; producer and consumer
/// agree on topic strings by running with the same `ENV`.
pub fn runtime_env() -> &'static str {
    static ENV: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    ENV.get_or_init(|| std::env::var("ENV").unwrap_or_else(|_| "dev".to_string()))
}

/// Box a future for the generated dispatch fns.
pub fn boxed<F>(f: F) -> BoxFuture<'static, F::Output>
where
    F: core::future::Future + Send + 'static,
{
    Box::pin(f)
}

/// Deserialize a JSON event body for the generated dispatch fns.
pub fn from_slice<T: serde::de::DeserializeOwned>(bytes: &[u8]) -> Result<T, Error> {
    Ok(serde_json::from_slice(bytes)?)
}

#[cfg(test)]
mod tests;
