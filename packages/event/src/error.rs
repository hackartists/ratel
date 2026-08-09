#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("serde: {0}")]
    Serde(String),
    #[error("produce: {0}")]
    Produce(String),
    #[error("consumer: {0}")]
    Consumer(String),
    #[error("handler: {0}")]
    Handler(String),
}

impl From<serde_json::Error> for Error {
    fn from(e: serde_json::Error) -> Self {
        Error::Serde(e.to_string())
    }
}
