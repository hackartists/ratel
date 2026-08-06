use crate::features::spaces::models::PanelAttribute;
use crate::features::spaces::models::PanelAttributeWithQuota;
use crate::features::spaces::*;
use postgres::PostgresEntity;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// jsonb wrapper — bare JSON array of the panel's attribute set.
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, postgres::PostgresJson)]
pub struct PanelAttributes(pub Vec<PanelAttribute>);

/// A single panel quota bucket on a space.
///
/// Postgres migration: the DynamoDB identity was
/// `pk = CompositePartition(Space(space_id), PanelAttribute)` +
/// `sk = SpacePanelAttribute(attribute_label, attribute_value)`. It collapses
/// to the natural key `(space_id, attribute_label, attribute_value)`
/// (composite UNIQUE) on a surrogate `id` PK. The `remains` counter is
/// decremented atomically (`UPDATE … SET remains = remains - $d`), mirroring
/// the original atomic DynamoDB `decrease_remains`.
///
/// `space_id` is a cross-feature reference (spaces) — plain column, **no FK**.
/// The attribute payloads are opaque jsonb (`PanelAttributes` /
/// `PanelAttribute`).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_panel_quotas", unique(space_id, attribute_label, attribute_value))]
pub struct SpacePanelQuota {
    pub id: Uuid,

    /// Cross-feature reference to the space (bare id).
    #[postgres(index)]
    pub space_id: String,
    /// Natural-key part — the attribute label (`"none"` when empty).
    pub attribute_label: String,
    /// Natural-key part — the attribute value(s), `_`-joined.
    pub attribute_value: String,

    pub quotas: i64,
    pub remains: i64,

    #[serde(default)]
    pub attributes_vec: PanelAttributes,
    /**
     * @deprecated
     * attributes_vec field instead.
     */
    #[serde(default)]
    pub attributes: PanelAttribute,
}

impl SpacePanelQuota {
    pub fn can_view(_role: SpaceUserRole) -> crate::common::Result<()> {
        Ok(())
    }

    pub fn can_edit(role: SpaceUserRole) -> crate::common::Result<()> {
        match role {
            SpaceUserRole::Creator => Ok(()),
            _ => Err(Error::NoPermission),
        }
    }

    fn space_id_of(space_pk: &Partition) -> String {
        match space_pk {
            Partition::Space(id) => id.clone(),
            other => other.to_string(),
        }
    }

    pub fn new(
        space_pk: Partition,
        attribute_label: String,
        attribute_value: String,
        quotas: i64,
        attributes: PanelAttribute,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            space_id: Self::space_id_of(&space_pk),
            attribute_label,
            attribute_value,
            quotas,
            remains: quotas,
            attributes_vec: PanelAttributes(vec![attributes]),
            attributes,
        }
    }

    pub fn new_with_attributes_vec(
        space_pk: Partition,
        quotas: i64,
        attributes_vec: Vec<PanelAttribute>,
    ) -> Self {
        let (attribute_label, attribute_value) = Self::attributes_vec_key(&attributes_vec);
        let attributes = attributes_vec.first().copied().unwrap_or_default();

        Self {
            id: Uuid::now_v7(),
            space_id: Self::space_id_of(&space_pk),
            attribute_label,
            attribute_value,
            quotas,
            remains: quotas,
            attributes_vec: PanelAttributes(attributes_vec),
            attributes,
        }
    }

    fn attributes_vec_key(attributes_vec: &[PanelAttribute]) -> (String, String) {
        let mut encoded = attributes_vec
            .iter()
            .map(Self::encode_attribute)
            .collect::<Vec<_>>();

        if encoded.is_empty() {
            return ("none".to_string(), String::new());
        }

        let first = encoded.remove(0);
        let mut parts = first.splitn(2, '#');
        let label = parts.next().unwrap_or_default().to_string();
        let mut values = parts
            .next()
            .filter(|value| !value.is_empty())
            .map(|value| vec![value.to_string()])
            .unwrap_or_default();
        values.extend(encoded);

        (label, values.join("_"))
    }

    fn encode_attribute(attribute: &PanelAttribute) -> String {
        let key = attribute.to_key();
        match attribute.to_value() {
            Some(value) if !value.is_empty() => format!("{key}#{value}"),
            _ => key,
        }
    }

    /// Every quota bucket for a space.
    pub async fn list_by_space(space_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find(Self::query().space_id(StringOp::Eq(Self::space_id_of(space_pk))))
            .await
            .map(|p| p.items)
            .map_err(crate::common::Error::from)
    }

    /// One quota bucket by its natural key.
    pub async fn get_by_attr(
        space_pk: &Partition,
        attribute_label: &str,
        attribute_value: &str,
    ) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(
                Self::query()
                    .space_id(StringOp::Eq(Self::space_id_of(space_pk)))
                    .attribute_label(StringOp::Eq(attribute_label.to_string()))
                    .attribute_value(StringOp::Eq(attribute_value.to_string())),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `(space_id, attribute_label, attribute_value)`.
    pub async fn save(&self) -> crate::common::Result<Self> {
        Self::repository()
            .upsert_on(&["space_id", "attribute_label", "attribute_value"], self)
            .await
            .map_err(crate::common::Error::from)
    }

    /// Delete one quota bucket by its natural key (idempotent).
    pub async fn delete_for(
        space_pk: &Partition,
        attribute_label: &str,
        attribute_value: &str,
    ) -> crate::common::Result<()> {
        if let Some(existing) =
            Self::get_by_attr(space_pk, attribute_label, attribute_value).await?
        {
            match Self::delete_by_id(existing.id).await {
                Ok(_) | Err(postgres::Error::NotFound) => {}
                Err(e) => return Err(crate::common::Error::from(e)),
            }
        }
        Ok(())
    }

    /// Atomic `remains = remains - delta` for one bucket. Mirrors the original
    /// atomic DynamoDB `decrease_remains` (no read-modify-write).
    pub async fn decrease_remains(
        space_pk: &Partition,
        attribute_label: &str,
        attribute_value: &str,
        delta: i64,
    ) -> crate::common::Result<()> {
        use postgres::Value;
        use postgres::sqlx::{Postgres, QueryBuilder};

        let table = Self::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "UPDATE \"{table}\" SET remains = remains - "
        ));
        Value::from(delta).push_bind(&mut qb);
        qb.push(" WHERE space_id = ");
        Value::from(Self::space_id_of(space_pk)).push_bind(&mut qb);
        qb.push(" AND attribute_label = ");
        Value::from(attribute_label.to_string()).push_bind(&mut qb);
        qb.push(" AND attribute_value = ");
        Value::from(attribute_value.to_string()).push_bind(&mut qb);

        Self::repository().db().execute(qb).await.map_err(|e| {
            crate::error!("panel quota decrease_remains failed: {e}");
            crate::common::Error::from(e)
        })?;
        Ok(())
    }
}

impl From<(Partition, PanelAttributeWithQuota)> for SpacePanelQuota {
    fn from((space_pk, attr_with_quota): (Partition, PanelAttributeWithQuota)) -> Self {
        let quota = attr_with_quota.quota();
        let attr: PanelAttribute = attr_with_quota.into();
        let value = attr.to_value().unwrap_or_default();

        Self::new(space_pk, attr.to_key(), value, quota, attr)
    }
}
