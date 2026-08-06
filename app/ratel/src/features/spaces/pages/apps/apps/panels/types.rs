use super::*;
use serde_with::{DeserializeFromStr, SerializeDisplay};
use std::str::FromStr;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, SerializeDisplay, DeserializeFromStr, Default, PartialEq, Eq, Hash)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct SpacePanelAttributeEntityType(pub String);

impl std::fmt::Display for SpacePanelAttributeEntityType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl FromStr for SpacePanelAttributeEntityType {
    type Err = crate::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        let s = if s.starts_with("SPACE_PANEL_ATTRIBUTE#") {
            s.replacen("SPACE_PANEL_ATTRIBUTE#", "", 1)
        } else {
            s.to_string()
        };
        Ok(Self(s))
    }
}

impl From<EntityType> for SpacePanelAttributeEntityType {
    fn from(value: EntityType) -> Self {
        match value {
            EntityType::SpacePanelAttribute(label, value) if value.is_empty() => Self(label),
            EntityType::SpacePanelAttribute(label, value) => Self(format!("{label}#{value}")),
            _ => Self::default(),
        }
    }
}

impl From<SpacePanelAttributeEntityType> for EntityType {
    fn from(value: SpacePanelAttributeEntityType) -> Self {
        let mut parts = value.0.splitn(2, '#');
        let label = parts.next().unwrap_or_default().to_string();
        let value = parts.next().unwrap_or_default().to_string();
        EntityType::SpacePanelAttribute(label, value)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SpacePanelQuotaResponse {
    pub panel_id: SpacePanelAttributeEntityType,
    pub quotas: i64,
    pub remains: i64,
    #[serde(default)]
    pub attributes_vec: Vec<PanelAttribute>,
    pub attributes: PanelAttribute,
}

impl From<SpacePanelQuota> for SpacePanelQuotaResponse {
    fn from(panel: SpacePanelQuota) -> Self {
        let attributes_vec = if panel.attributes_vec.0.is_empty()
            && !matches!(panel.attributes, PanelAttribute::None)
        {
            vec![panel.attributes]
        } else {
            // `PanelAttributes` is a jsonb newtype wrapper — unwrap to the
            // plain `Vec<PanelAttribute>` the response DTO carries.
            panel.attributes_vec.0
        };

        // Reconstruct the former `sk` string (`SpacePanelAttribute(label, value)`)
        // from the natural-key columns: bare label when there's no value,
        // `label#value` otherwise — matches `From<EntityType>` above.
        let panel_id = if panel.attribute_value.is_empty() {
            SpacePanelAttributeEntityType(panel.attribute_label.clone())
        } else {
            SpacePanelAttributeEntityType(format!(
                "{}#{}",
                panel.attribute_label, panel.attribute_value
            ))
        };

        Self {
            panel_id,
            quotas: panel.quotas,
            remains: panel.remains,
            attributes_vec,
            attributes: panel.attributes,
        }
    }
}
