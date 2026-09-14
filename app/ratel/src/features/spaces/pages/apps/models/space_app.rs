use crate::common::utils::time::get_now_timestamp_millis;
use crate::features::spaces::pages::apps::*;
use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

/// One installed app row per (space, app_type).
///
/// Postgres migration: surrogate `id` PK; the DynamoDB
/// `(Space(space_id), SpaceApp(app_type))` identity becomes the
/// `unique(space_pk, app_type)` natural key. `space_pk` is a
/// cross-feature reference to the space partition — stored as the full
/// `Partition` string (`"SPACE#<id>"`), **no** FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
// Serialize through `SpaceAppWire` so the shipped mobile build still finds
// the legacy `pk`/`sk` keys. See `SpaceAppWire`.
#[serde(into = "SpaceAppWire")]
#[cfg_attr(feature = "server", derive(PostgresEntity))]
#[cfg_attr(
    feature = "server",
    postgres(table = "space_apps", unique(space_pk, app_type))
)]
pub struct SpaceApp {
    pub id: Uuid,

    /// Cross-feature reference to the space (full `Partition` string).
    #[cfg_attr(feature = "server", postgres(index))]
    pub space_pk: String,

    pub app_type: SpaceAppType,

    #[cfg_attr(feature = "server", postgres(order))]
    pub created_at: i64,
    pub updated_at: i64,
}

#[cfg(feature = "server")]
impl SpaceApp {
    pub fn new(space_pk: Partition, app_type: SpaceAppType) -> Self {
        let now = get_now_timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            app_type,
            created_at: now,
            updated_at: now,
        }
    }

    /// Every installed app row for a space, oldest first.
    pub async fn list_by_space(space_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(SpaceAppColumn::CreatedAt, postgres::Order::Asc),
            )
            .await?
            .items)
    }

    /// The single installed row for `(space_pk, app_type)`, if any.
    pub async fn find_by_space_and_type(
        space_pk: &Partition,
        app_type: SpaceAppType,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::{EnumOp, StringOp};
        Ok(Self::repository()
            .find_one(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .app_type(EnumOp::Eq(app_type)),
            )
            .await?)
    }
}

impl SpaceApp {
    pub fn can_view(_role: SpaceUserRole) -> Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }

    pub fn can_delete(role: SpaceUserRole) -> Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }
}

/// Wire form of [`SpaceApp`] — identical plus the legacy `pk`/`sk` keys.
///
/// This is the one that breaks a space for its **admins only**: the space index
/// renders `SettingsPanel` behind `is_admin`, whose apps section calls
/// `get_space_apps` and gets `Vec<SpaceApp>` raw. A participant never issues
/// that request, which is why the same space opens fine for them and dies for
/// whoever owns it.
///
/// The DynamoDB identity was `(Space(space_id), SpaceApp(app_type))`; `space_pk`
/// still holds the `"SPACE#…"` string, so `pk` is parsed back from it.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "SpaceApp"))]
pub struct SpaceAppWire {
    /// The space's partition, parsed back from `space_pk` (`SPACE#…`).
    pub pk: Partition,
    /// `EntityType::SpaceApp(app_type)`.
    pub sk: EntityType,

    pub id: Uuid,
    pub space_pk: String,
    pub app_type: SpaceAppType,
    pub created_at: i64,
    pub updated_at: i64,
}

impl From<SpaceApp> for SpaceAppWire {
    fn from(v: SpaceApp) -> Self {
        Self {
            pk: v.space_pk.parse().unwrap_or_default(),
            sk: EntityType::SpaceApp(v.app_type.to_string()),

            id: v.id,
            space_pk: v.space_pk,
            app_type: v.app_type,
            created_at: v.created_at,
            updated_at: v.updated_at,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `SpaceApp`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = SpaceApp { space_pk: "SPACE#s1".into(), ..Default::default() };
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("SPACE#s1"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(SpaceApp { space_pk: "SPACE#s1".into(), ..Default::default() }).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `SpaceApp` serializes through
// `SpaceAppWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for SpaceApp {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <SpaceAppWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <SpaceAppWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <SpaceAppWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <SpaceAppWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <SpaceAppWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <SpaceAppWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceAppWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <SpaceAppWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <SpaceAppWire as ts_rs::TS>::output_path()
    }
}
