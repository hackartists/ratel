use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[delete("/api/spaces/{space_id}/discussions/{discussion_id}/ai-moderator/materials/{material_id}", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn delete_material(
    space_id: SpacePartition,
    discussion_id: SpaceDiscussionEntityType,
    material_id: String,
) -> Result<()> {
    role.is_creator()?;

    // Membership lives in the (still DynamoDB-backed) membership feature.
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    super::require_premium(cli, &user).await?;

    let material_id = material_id
        .parse::<uuid::Uuid>()
        .map_err(|_| AiModeratorError::MaterialNotFound)?;

    // Scope the delete to (space_id, discussion_id) so a creator can only
    // delete materials attached to the discussion they are moderating —
    // preserving the DynamoDB composite-key scoping. Idempotent: deleting a
    // non-existent / out-of-scope material is a no-op (matches the old
    // `delete` behavior of keying on the full composite pk + sk).
    let existing = AiModeratorMaterial::repository()
        .get(material_id)
        .await
        .map_err(crate::common::Error::from)?;

    let in_scope = existing.as_ref().is_some_and(|m| {
        m.space_id == space_id.to_string() && m.discussion_id == discussion_id.to_string()
    });

    if in_scope {
        AiModeratorMaterial::repository()
            .delete(material_id)
            .await
            .map_err(crate::common::Error::from)?;
    }

    Ok(())
}
