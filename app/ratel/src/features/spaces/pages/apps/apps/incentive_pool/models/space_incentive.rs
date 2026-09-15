use crate::features::spaces::pages::apps::apps::incentive_pool::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// One incentive-pool row per space. Postgres migration: surrogate `id`
/// PK; the DynamoDB `(Space(space_id), SpaceIncentive)` singleton identity
/// becomes the `unique(space_pk)` natural key. `space_pk` is the full
/// `Partition` string (cross-feature reference to the space); no FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
// Serialize through `SpaceIncentiveWire` so the shipped mobile build still finds
// the legacy `pk`/`sk` keys. See `SpaceIncentiveWire`.
#[serde(into = "SpaceIncentiveWire")]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "space_incentives"))]
pub struct SpaceIncentive {
    pub id: Uuid,

    #[cfg_attr(feature = "server", postgres(unique))]
    pub space_pk: String,

    pub created_at: i64,
    pub updated_at: i64,

    #[serde(default)]
    pub contract_address: String,
    #[serde(default)]
    pub deploy_block: i64,
    #[serde(default)]
    pub last_block: i64,
    #[serde(default)]
    pub remaining_count: i64,
    #[serde(default)]
    pub total_count: i64,
}

#[cfg(feature = "server")]
impl SpaceIncentive {
    pub fn new(space_pk: SpacePartition, contract_address: String, deploy_block: i64) -> Self {
        use crate::common::utils::time::get_now_timestamp_millis;

        let now = get_now_timestamp_millis();
        let space_pk: Partition = space_pk.into();

        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            created_at: now,
            updated_at: now,
            contract_address,
            deploy_block,
            last_block: 0,
            remaining_count: 0,
            total_count: 0,
        }
    }

    /// The single incentive row for a space, if any.
    pub async fn get_by_space(space_pk: &Partition) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find_one(Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await?)
    }

    /// Natural-key upsert on `space_pk` (preserves the surrogate `id`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Ok(Self::repository().upsert_on(&["space_pk"], self).await?)
    }

    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        if role != SpaceUserRole::Creator {
            return Err(Error::NoPermission);
        }
        Ok(())
    }
}

/// Wire form of [`SpaceIncentive`] — identical plus the legacy `pk`/`sk` keys.
///
/// Same reason as `UserWire`. The DynamoDB identity was the
/// `(Space(space_id), SpaceIncentive)` singleton.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SpaceIncentive"))]
pub struct SpaceIncentiveWire {
    /// The space's partition, parsed back from `space_pk` (`SPACE#…`).
    pub pk: Partition,
    /// Always `EntityType::SpaceIncentive` (one row per space).
    pub sk: EntityType,

    pub id: Uuid,
    pub space_pk: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub contract_address: String,
    pub deploy_block: i64,
    pub last_block: i64,
    pub remaining_count: i64,
    pub total_count: i64,
}

impl From<SpaceIncentive> for SpaceIncentiveWire {
    fn from(v: SpaceIncentive) -> Self {
        Self {
            pk: v.space_pk.parse().unwrap_or_default(),
            sk: EntityType::SpaceIncentive,

            id: v.id,
            space_pk: v.space_pk,
            created_at: v.created_at,
            updated_at: v.updated_at,
            contract_address: v.contract_address,
            deploy_block: v.deploy_block,
            last_block: v.last_block,
            remaining_count: v.remaining_count,
            total_count: v.total_count,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `SpaceIncentive`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = SpaceIncentive { space_pk: "SPACE#s1".into(), ..Default::default() };
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE#s1"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpaceIncentive { space_pk: "SPACE#s1".into(), ..Default::default() }).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `SpaceIncentive` serializes through
// `SpaceIncentiveWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for SpaceIncentive {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <SpaceIncentiveWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceIncentiveWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceIncentiveWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <SpaceIncentiveWire as ts_rs::TS>::output_path()
    }
}
