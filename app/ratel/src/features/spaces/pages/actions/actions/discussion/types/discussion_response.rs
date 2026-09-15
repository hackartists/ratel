use crate::features::spaces::pages::actions::actions::discussion::*;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct DiscussionResponse {
    pub post: SpacePost,
    pub space_action: crate::features::spaces::pages::actions::models::SpaceAction,
    /// Whether the current viewer subscribes to this discussion. `false` for
    /// anonymous viewers.
    #[serde(default)]
    pub subscribed: bool,
}
