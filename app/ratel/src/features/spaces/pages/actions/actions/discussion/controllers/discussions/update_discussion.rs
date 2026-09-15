use crate::features::spaces::pages::actions::actions::discussion::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateDiscussionRequest {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub html_contents: Option<String>,
    #[serde(default)]
    pub category_name: Option<String>,
    #[serde(default)]
    pub files: Option<Vec<File>>,
}

#[mcp_tool(name = "update_discussion", description = "Update a discussion (title, html_contents, category_name). Requires creator role.")]
#[patch("/api/spaces/{space_id}/discussions/{discussion_sk}", role: SpaceUserRole)]
pub async fn update_discussion(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Discussion sort key (e.g. 'SpacePost#<uuid>')")]
    discussion_sk: SpacePostEntityType,
    #[mcp(description = "Discussion update data as JSON. Fields: title, html_contents, category_name (all optional)")]
    req: UpdateDiscussionRequest,
) -> Result<SpacePost> {
    SpacePost::can_edit(&role)?;
    let now = crate::common::utils::time::get_now_timestamp_millis();

    let mut post = SpacePost::get_one(&space_id, &SpacePostPartition(discussion_sk.0.clone()))
        .await?
        .ok_or(SpaceActionDiscussionError::NotFound)?;
    post.updated_at = now;

    let mut action_title: Option<String> = None;
    let mut action_description: Option<String> = None;

    if let Some(title) = req.title {
        post.title = title.clone();
        action_title = Some(title);
    }
    if let Some(html_contents) = req.html_contents {
        post.html_contents = html_contents.clone();
        action_description = Some(html_contents);
    }
    if let Some(category_name) = &req.category_name {
        post.category_name = category_name.clone();
    }
    if let Some(mut files) = req.files {
        for file in &mut files {
            if file.id.is_empty() {
                file.id = crate::common::uuid::Uuid::now_v7().to_string();
            }
        }
        post.files = PostFiles(files);
    }

    SpacePost::repository()
        .upsert(&post)
        .await
        .map_err(crate::common::Error::from)?;

    if action_title.is_some() || action_description.is_some() {
        if let Some(mut action) = SpaceAction::get_one(&space_id, &discussion_sk.0).await? {
            if let Some(title) = action_title {
                action.title = title;
            }
            if let Some(description) = action_description {
                action.description = description;
            }
            action.updated_at = now;
            action.save().await?;
        }
    }

    if let Some(category_name) = req.category_name {
        if !category_name.is_empty() {
            let cat = SpaceCategory::new(space_id, category_name.clone());
            let _ = cat.save().await;
        }
    }

    Ok(post)
}
