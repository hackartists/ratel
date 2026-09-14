use crate::features::ai_moderator::*;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct MaterialResponse {
    pub material_id: String,
    pub file_name: String,
    pub file_url: String,
    pub created_at: i64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct MaterialListResponse {
    pub items: Vec<MaterialResponse>,
}

#[get("/api/spaces/{space_id}/discussions/{discussion_id}/ai-moderator/materials", role: SpaceUserRole)]
pub async fn list_materials(
    space_id: SpacePartition,
    discussion_id: SpaceDiscussionEntityType,
) -> Result<MaterialListResponse> {
    use postgres::Order;
    use postgres::ops::StringOp;

    role.is_creator()?;

    let materials = AiModeratorMaterial::repository()
        .find(
            AiModeratorMaterial::query()
                .space_id(StringOp::Eq(space_id.to_string()))
                .discussion_id(StringOp::Eq(discussion_id.to_string()))
                .order_by(AiModeratorMaterialColumn::CreatedAt, Order::Asc),
        )
        .await
        .map_err(crate::common::Error::from)?
        .items;

    let items = materials
        .into_iter()
        .map(|m| MaterialResponse {
            material_id: m.id.to_string(),
            file_name: m.file_name,
            file_url: m.file_url,
            created_at: m.created_at,
        })
        .collect();

    Ok(MaterialListResponse { items })
}
