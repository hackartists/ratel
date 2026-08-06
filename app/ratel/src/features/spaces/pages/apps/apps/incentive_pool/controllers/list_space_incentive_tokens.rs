use crate::features::spaces::pages::apps::apps::incentive_pool::*;

use crate::features::spaces::pages::apps::apps::incentive_pool::models::SpaceIncentiveToken;

#[get(
    "/api/spaces/{space_pk}/incentives/tokens?bookmark&limit",
    role: SpaceUserRole
)]
pub async fn list_space_incentive_tokens(
    space_pk: SpacePartition,
    bookmark: Option<String>,
    limit: Option<i32>,
) -> Result<ListResponse<SpaceIncentiveToken>> {
    use crate::features::spaces::pages::apps::apps::incentive_pool::models::SpaceIncentive;
    SpaceIncentive::can_view(role)?;

    let space_pk: Partition = space_pk.into();
    let incentive = SpaceIncentive::get_by_space(&space_pk)
        .await?
        .ok_or(Error::NotFound("Space incentive not found".to_string()))?;

    let page_size = limit.map(|l| l.max(1) as i64).unwrap_or(100);

    let (items, bookmark) =
        SpaceIncentiveToken::find_page(&incentive.contract_address, bookmark, page_size).await?;

    Ok((items, bookmark).into())
}
