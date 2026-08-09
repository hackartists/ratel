use crate::features::spaces::pages::actions::actions::meet::*;
use crate::features::spaces::pages::actions::models::SpaceAction;

#[mcp_tool(
    name = "get_meet",
    description = "Fetch a meet action with its companion SpaceAction row."
)]
#[get("/api/spaces/{space_pk}/meets/{meet_sk}", role: SpaceUserRole)]
pub async fn get_meet(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Meet sort key (e.g. 'SpaceMeet#<uuid>')")] meet_sk: SpaceMeetEntityType,
) -> Result<MeetResponse> {
    let space_id = space_pk;
    let meet_id = meet_sk;

    let meet = SpaceMeet::get_one(&space_id, &meet_id)
        .await?
        .ok_or(MeetActionError::NotFound)?;

    let mut response: MeetResponse = meet.into();

    let space_action = SpaceAction::get_one(&space_id, &meet_id.0)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;

    response.space_action = space_action;

    Ok(response)
}
