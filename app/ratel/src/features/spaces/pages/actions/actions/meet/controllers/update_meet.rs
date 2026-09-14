use crate::features::spaces::pages::actions::actions::meet::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum UpdateMeetRequest {
    Mode { mode: MeetMode },
    StartTime { start_time: i64 },
    DurationMin { duration_min: i32 },
}

#[mcp_tool(
    name = "update_meet",
    description = "Update meet-specific fields (mode, start_time, duration_min). Requires creator role."
)]
#[post("/api/spaces/{space_pk}/meets/{meet_sk}", role: SpaceUserRole)]
pub async fn update_meet(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Meet sort key (e.g. 'SpaceMeet#<uuid>')")] meet_sk: SpaceMeetEntityType,
    #[mcp(description = "Meet update data as JSON. Supported variants: {\"Mode\": {\"mode\": \"Instant\"}}, {\"StartTime\": {\"start_time\": 123}}, {\"DurationMin\": {\"duration_min\": 60}}")]
    req: UpdateMeetRequest,
) -> Result<String> {
    SpaceMeet::can_edit(&role)?;

    let mut meet = SpaceMeet::get_one(&space_pk, &meet_sk)
        .await?
        .ok_or(MeetActionError::NotFound)?;

    let now = crate::common::utils::time::get_now_timestamp_millis();
    meet.updated_at = now;

    match req {
        UpdateMeetRequest::Mode { mode } => {
            meet.mode = mode;
        }
        UpdateMeetRequest::StartTime { start_time } => {
            meet.start_time = start_time;
        }
        UpdateMeetRequest::DurationMin { duration_min } => {
            if !(15..=1440).contains(&duration_min) {
                return Err(MeetActionError::InvalidDuration(duration_min).into());
            }
            meet.duration_min = duration_min;
        }
    }

    SpaceMeet::repository().upsert(&meet).await.map_err(|e| {
        crate::error!("update meet failed: {e}");
        MeetActionError::UpdateFailed
    })?;

    Ok("success".to_string())
}
