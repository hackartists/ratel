use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct InboxNotificationResponse {
    pub id: UserInboxNotificationEntityType,
    pub kind: InboxKind,
    pub payload: InboxPayload,
    pub is_read: bool,
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl From<crate::common::models::notification::UserInboxNotification>
    for InboxNotificationResponse
{
    fn from(n: crate::common::models::notification::UserInboxNotification) -> Self {
        Self {
            id: UserInboxNotificationEntityType(n.id.to_string()),
            kind: n.kind,
            payload: n.payload,
            is_read: n.is_read,
            created_at: n.created_at,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UnreadCountResponse {
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct MarkAllReadResponse {
    pub affected: i64,
    pub has_more: bool,
}
