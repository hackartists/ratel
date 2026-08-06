use crate::common::*;
use crate::features::arcade::types::ArcadeSettingsResponse;

#[allow(unused_imports)]
use rmcp::schemars;

use postgres::PostgresEntity;
use postgres::ops::StringOp;
use uuid::Uuid;

/// Singleton settings row for the whole arcade.
///
/// Postgres migration: the DynamoDB singleton `(ArcadeSettings,
/// ArcadeSettings)` pair becomes a surrogate `id` PK plus a fixed
/// `singleton` natural key (UNIQUE) so `save`/`get_or_default` always
/// hit the one row.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "arcade_settings")]
pub struct ArcadeSettings {
    pub id: Uuid,

    /// Fixed natural key — one row for the whole arcade.
    #[postgres(unique)]
    pub singleton: String,

    pub created_at: i64,
    pub updated_at: i64,

    pub rp_to_chip_ratio_bps: i32,
    pub default_buy_in_chips: i64,
    pub min_convert_rp: i64,
    pub redeem_enabled: bool,
}

/// The fixed value of the `singleton` natural key column.
pub const ARCADE_SETTINGS_SINGLETON: &str = "arcade_settings";

impl ArcadeSettings {
    /// Load the singleton row, or `ArcadeSettingsResponse::default()`
    /// when it has not been initialised yet.
    pub async fn get_or_default() -> crate::common::Result<ArcadeSettingsResponse> {
        let row = Self::repository()
            .find_one(Self::query().singleton(StringOp::Eq(ARCADE_SETTINGS_SINGLETON.to_string())))
            .await
            .map_err(crate::common::Error::from)?;
        Ok(row.map(ArcadeSettingsResponse::from).unwrap_or_default())
    }

    /// Natural-key upsert on the fixed singleton key.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["singleton"], self)
            .await
            .map_err(crate::common::Error::from)
    }
}

impl From<ArcadeSettings> for ArcadeSettingsResponse {
    fn from(v: ArcadeSettings) -> Self {
        Self {
            rp_to_chip_ratio_bps: v.rp_to_chip_ratio_bps,
            default_buy_in_chips: v.default_buy_in_chips,
            min_convert_rp: v.min_convert_rp,
            redeem_enabled: v.redeem_enabled,
        }
    }
}
