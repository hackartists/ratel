use crate::common::*;

/// Default report threshold when no admin has configured one.
pub const DEFAULT_REPORT_THRESHOLD: u64 = 3;

/// Singleton (`pk = ModerationSetting`, `sk = ModerationSettingItem`) holding the
/// admin-configurable report threshold that triggers auto-hide + admin review.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(DynamoEntity))]
pub struct ModerationSetting {
    pub pk: Partition,
    pub sk: EntityType,

    #[serde(default = "default_threshold")]
    pub report_threshold: u64,
    #[serde(default)]
    pub updated_at: i64,
}

fn default_threshold() -> u64 {
    DEFAULT_REPORT_THRESHOLD
}

impl Default for ModerationSetting {
    fn default() -> Self {
        Self {
            pk: Partition::ModerationSetting,
            sk: EntityType::ModerationSettingItem,
            report_threshold: DEFAULT_REPORT_THRESHOLD,
            updated_at: 0,
        }
    }
}

#[cfg(feature = "server")]
impl ModerationSetting {
    pub fn keys() -> (Partition, EntityType) {
        (Partition::ModerationSetting, EntityType::ModerationSettingItem)
    }
}
