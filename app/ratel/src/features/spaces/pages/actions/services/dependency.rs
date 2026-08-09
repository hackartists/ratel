#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[cfg(feature = "server")]
pub async fn dependencies_met(
    space: &crate::common::models::space::SpaceCommon,
    action: &crate::features::spaces::pages::actions::models::SpaceAction,
    user_pk: &Partition,
) -> crate::common::Result<bool> {
    use futures::future::try_join_all;

    if action.depends_on.is_empty() {
        return Ok(true);
    }

    let space_id: SpacePartition = match space.partition() {
        Partition::Space(id) => SpacePartition(id),
        _ => return Ok(false),
    };

    let dep_ids: Vec<String> = action.depends_on.0.clone();
    let expected = dep_ids.len();

    use postgres::ops::StringOp;
    let deps = crate::features::spaces::pages::actions::models::SpaceAction::repository()
        .find(
            crate::features::spaces::pages::actions::models::SpaceAction::query()
                .space_id(StringOp::Eq(space_id.0.clone()))
                .action_id(StringOp::In(dep_ids)),
        )
        .await
        .map(|p| p.items)
        .map_err(|e| {
            crate::error!("failed to load dependency actions: {e:?}");
            SpaceActionError::ActionLoadFailed
        })?;

    if deps.len() != expected {
        return Ok(false);
    }

    let checks = deps
        .iter()
        .map(|dep| crate::common::has_completed_prerequisite_action(space, dep, user_pk));

    let results = try_join_all(checks).await?;
    Ok(results.into_iter().all(|completed| completed))
}
