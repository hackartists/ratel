use crate::common::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Default report threshold when no admin has configured one.
pub const DEFAULT_REPORT_THRESHOLD: i64 = 3;

/// Admin-configurable report threshold that triggers auto-hide + admin review.
///
/// Postgres migration: the DynamoDB identity was the singleton
/// `pk = ModerationSetting` + `sk = ModerationSettingItem`. It becomes a
/// surrogate `id` PK plus a `singleton` natural key pinned to `GLOBAL`, so the
/// row is still addressable without keys and a second row cannot be inserted.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "moderation_settings", unique(singleton)))]
pub struct ModerationSetting {
    #[serde(default)]
    pub id: uuid::Uuid,

    /// Always `GLOBAL` — the UNIQUE makes this table a singleton.
    #[serde(default = "global_key")]
    pub singleton: String,

    #[serde(default = "default_threshold")]
    pub report_threshold: i64,
    #[serde(default)]
    pub updated_at: i64,
}

fn default_threshold() -> i64 {
    DEFAULT_REPORT_THRESHOLD
}

fn global_key() -> String {
    "GLOBAL".to_string()
}

impl Default for ModerationSetting {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::nil(),
            singleton: global_key(),
            report_threshold: DEFAULT_REPORT_THRESHOLD,
            updated_at: 0,
        }
    }
}

#[cfg(feature = "server")]
impl ModerationSetting {
    /// The configured threshold, or the default when no row exists yet.
    /// Never returns 0 — a 0 threshold would auto-hide on the first report.
    pub async fn threshold() -> i64 {
        Self::load()
            .await
            .map(|s| s.report_threshold)
            .unwrap_or(DEFAULT_REPORT_THRESHOLD)
            .max(1)
    }

    /// The singleton row, if an admin has ever written one.
    pub async fn load() -> Option<Self> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().singleton(StringOp::Eq(global_key())))
            .await
            .unwrap_or(None)
    }
}
