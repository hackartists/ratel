use crate::features::spaces::pages::apps::apps::analyzes::*;
use uuid::Uuid;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// Singleton row controlling the analyze-report creation quota for
/// non-enterprise tiers. Postgres migration: surrogate `id` PK plus a
/// fixed `config_key` ("global") natural key so the single deployment-wide
/// row is upsert-addressable.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
// Serialize through `AnalyzeQuotaConfigWire` so the shipped mobile build still finds
// the legacy `pk`/`sk` keys. See `AnalyzeQuotaConfigWire`.
#[serde(into = "AnalyzeQuotaConfigWire")]
#[cfg_attr(
    feature = "server",
    derive(PostgresEntity)
)]
#[cfg_attr(feature = "server", postgres(table = "analyze_quota_configs"))]
pub struct AnalyzeQuotaConfig {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(unique))]
    #[serde(default)]
    pub config_key: String,

    pub created_at: i64,
    pub updated_at: i64,

    /// Maximum analyze reports a non-enterprise user may have in a
    /// single space. Enterprise membership is unlimited.
    #[serde(default)]
    pub non_enterprise_limit: i64,
}

#[cfg(feature = "server")]
impl AnalyzeQuotaConfig {
    /// Hardcoded fallback used when the row hasn't been initialised yet.
    pub const DEFAULT_LIMIT: i64 = 2;

    /// The deployment-wide singleton key.
    pub const GLOBAL_KEY: &'static str = "global";

    /// Loads the configured limit, falling back to `DEFAULT_LIMIT` when no
    /// row exists yet. Errors propagate so callers can decide whether to
    /// fail closed or open.
    pub async fn get_limit() -> crate::common::Result<i64> {
        use postgres::ops::StringOp;
        let row = Self::repository()
            .find_one(Self::query().config_key(StringOp::Eq(Self::GLOBAL_KEY.to_string())))
            .await?;
        Ok(row
            .map(|r| r.non_enterprise_limit)
            .unwrap_or(Self::DEFAULT_LIMIT))
    }
}

/// Wire form of [`AnalyzeQuotaConfig`] — identical plus the legacy `pk`/`sk`.
///
/// Same reason as `UserWire`. Both keys were constants on this singleton row.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "AnalyzeQuotaConfig"))]
pub struct AnalyzeQuotaConfigWire {
    /// Always `Partition::AnalyzeQuotaConfig` (a singleton row).
    pub pk: Partition,
    /// Always `EntityType::AnalyzeQuotaConfig`.
    pub sk: EntityType,

    pub id: Uuid,
    pub config_key: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub non_enterprise_limit: i64,
}

impl From<AnalyzeQuotaConfig> for AnalyzeQuotaConfigWire {
    fn from(v: AnalyzeQuotaConfig) -> Self {
        Self {
            pk: Partition::AnalyzeQuotaConfig,
            sk: EntityType::AnalyzeQuotaConfig,

            id: v.id,
            config_key: v.config_key,
            created_at: v.created_at,
            updated_at: v.updated_at,
            non_enterprise_limit: v.non_enterprise_limit,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `AnalyzeQuotaConfig`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = AnalyzeQuotaConfig::default();
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["sk"], serde_json::json!("ANALYZE_QUOTA_CONFIG"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(AnalyzeQuotaConfig::default()).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `AnalyzeQuotaConfig` serializes through
// `AnalyzeQuotaConfigWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for AnalyzeQuotaConfig {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <AnalyzeQuotaConfigWire as ts_rs::TS>::output_path()
    }
}
