#[cfg(feature = "server")]
use crate::features::posts::models::Category;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct CategoryResponse {
    pub name: String,
}

#[cfg(feature = "server")]
impl From<Category> for CategoryResponse {
    fn from(category: Category) -> Self {
        Self {
            name: category.name,
        }
    }
}