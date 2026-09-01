#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("database error: {0}")]
    Sqlx(#[from] sqlx::Error),
    #[error("entity not found")]
    NotFound,
    #[error("invalid schema: {0}")]
    Schema(String),
    #[error("invalid key: {0}")]
    InvalidKey(String),
    #[error("transaction already closed")]
    TxClosed,
}

pub type Result<T> = std::result::Result<T, Error>;
