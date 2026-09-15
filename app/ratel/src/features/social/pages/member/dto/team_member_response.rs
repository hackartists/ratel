use super::super::*;
use super::TeamRole;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct TeamMemberResponse {
    pub user_id: String,
    pub username: String,
    pub display_name: String,
    pub profile_url: String,
    pub role: TeamRole,
    pub is_owner: bool,
}
