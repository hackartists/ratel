use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

use super::list_materials::MaterialResponse;

const MAX_MATERIALS: i64 = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UploadMaterialRequest {
    pub file_name: String,
    pub file_url: String,
}

#[post("/api/spaces/{space_id}/discussions/{discussion_id}/ai-moderator/materials", role: SpaceUserRole, user: crate::features::auth::User)]
pub async fn upload_material(
    space_id: SpacePartition,
    discussion_id: SpaceDiscussionEntityType,
    req: UploadMaterialRequest,
) -> Result<MaterialResponse> {
    use postgres::ops::StringOp;

    role.is_creator()?;

    super::require_premium(&user).await?;

    let existing_count = AiModeratorMaterial::repository()
        .find(
            AiModeratorMaterial::query()
                .space_id(StringOp::Eq(space_id.to_string()))
                .discussion_id(StringOp::Eq(discussion_id.to_string()))
                .page_size(1),
        )
        .await
        .map_err(crate::common::Error::from)?
        .total_count;

    if existing_count >= MAX_MATERIALS {
        return Err(AiModeratorError::MaterialLimitReached.into());
    }

    let material =
        AiModeratorMaterial::new(space_id, discussion_id.to_string(), req.file_name, req.file_url);
    let material = AiModeratorMaterial::repository()
        .insert(&material)
        .await
        .map_err(crate::common::Error::from)?;

    Ok(MaterialResponse {
        material_id: material.id.to_string(),
        file_name: material.file_name,
        file_url: material.file_url,
        created_at: material.created_at,
    })
}
