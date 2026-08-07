use crate::features::auth::User;
use crate::features::posts::models::*;
use crate::features::posts::types::*;
use crate::features::posts::*;
use std::collections::HashMap;

use crate::features::cross_posting::models::{
    EnabledPlatforms, PlatformOverrides, PostSyndicationDirective,
};
use crate::features::cross_posting::types::SocialPlatform;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use crate::features::posts::utils::validator::{validate_content, validate_title};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(untagged)]
pub enum UpdatePostRequest {
    Publish {
        title: String,
        content: ContentBody,
        image_urls: Option<Vec<String>>,
        publish: bool,
        visibility: Option<Visibility>,
        categories: Option<Vec<String>>,
        /// Per-post platform selection (cross-posting). Phase 1: defaults
        /// to all connected + auto_post_enabled when omitted; an explicit
        /// empty Vec means "Ratel-only" (FR-4 #27). Stage 1 factory only
        /// runs when this resolves to non-empty AND visibility = Public.
        #[serde(default)]
        enabled_platforms: Option<Vec<SocialPlatform>>,
        /// Per-platform body overrides (cross-posting v1.5 readiness). Phase
        /// 1: always empty — UI does not expose. The field is accepted now
        /// so v1.5 client/server are wire-compatible without a DTO change.
        #[serde(default)]
        platform_overrides: Option<HashMap<SocialPlatform, String>>,
    },
    PostType {
        r#type: PostType,
    },
    Writing {
        title: String,
        content: ContentBody,
        categories: Option<Vec<String>>,
    },
    Image {
        images: Vec<String>,
    },
    Info {
        visibility: Visibility,
    },
    ArtworkMetadata {
        metadata: Vec<PostArtworkMetadata>,
    },
    Author {
        team_id: Option<TeamPartition>,
    },
}

#[mcp_tool(
    name = "update_post",
    description = "Update a post (publish, edit content, change visibility)."
)]
#[put("/api/posts/:post_id", user: User)]
pub async fn update_post_handler(post_id: FeedPartition, req: UpdatePostRequest) -> Result<Post> {
    let conf = crate::features::posts::config::get();
    let cli = conf.dynamodb();

    let post_uuid = uuid::Uuid::parse_str(&post_id.0)
        .map_err(|_| Error::NotFound("Post not found".into()))?;

    tracing::debug!(
        "update_post_handler: user = {:?}, post_id = {:?}, req = {:?}",
        user,
        post_uuid,
        req
    );
    let (mut post, has_permission) =
        Post::has_permission(cli, post_uuid, Some(&user.pk()), TeamGroupPermission::PostEdit).await?;
    if !has_permission {
        return Err(PostError::NotAccessible.into());
    }

    let now = chrono::Utc::now().timestamp_millis();
    post.updated_at = now;

    // Cross-posting Stage 1 directive is staged here and written after the
    // Post row is saved (Postgres has no cross-table transact needed here).
    let mut pending_directive: Option<PostSyndicationDirective> = None;

    // Phase 5: capture the pre-edit post so the outbox MODIFY event carries the
    // real old→new images (see the emit after `post.save()` below).
    let old_post = post.clone();

    match req {
        UpdatePostRequest::Writing {
            title,
            content,
            categories,
        } => {
            post.title = title;
            post.body = BodyJson(content);
            if let Some(cats) = categories {
                post.categories = StringVec(cats);
            }
        }
        UpdatePostRequest::Image { images } => {
            post.urls = StringVec(images);
        }
        UpdatePostRequest::Info { visibility } => {
            post.visibility = Some(visibility);
        }
        UpdatePostRequest::Publish {
            publish,
            content,
            title,
            visibility,
            image_urls,
            categories,
            enabled_platforms,
            platform_overrides,
        } => {
            validate_title(&title)?;
            validate_content(&content)?;

            tracing::debug!(
                "Publish request: publish = {}, title = {}, content = [REDACTED]",
                publish,
                title
            );
            let visibility = visibility.unwrap_or_default();
            let is_public_publish = publish && matches!(visibility, Visibility::Public);

            post.visibility = Some(visibility);

            let status = if publish {
                PostStatus::Published
            } else {
                PostStatus::Draft
            };
            post.status = status;
            post.title = title;
            post.body = BodyJson(content);
            if let Some(cats) = categories {
                post.categories = StringVec(cats);
            }
            if let Some(image_urls) = image_urls {
                post.urls = StringVec(image_urls);
            }

            // Cross-posting Stage 1 factory hook. In DynamoDB this rode the
            // same transact as the Post publish; on Postgres the directive is
            // upserted right after `post.save()` below (Stage 1 dispatch reads
            // it; absence of the directive is the kill switch).
            if is_public_publish && enabled_platforms.as_ref().is_some_and(|v| !v.is_empty()) {
                let post_id = post.id.to_string();
                let author_user_id = match &user.pk() {
                    Partition::User(id) => id.clone(),
                    other => other.to_string(),
                };
                pending_directive = Some(PostSyndicationDirective {
                    id: uuid::Uuid::now_v7(),
                    post_id,
                    enabled_platforms: EnabledPlatforms(enabled_platforms.unwrap_or_default()),
                    platform_overrides: PlatformOverrides(platform_overrides.unwrap_or_default()),
                    author_user_id,
                    created_at: now,
                });
            }
        }
        UpdatePostRequest::PostType { r#type } => {
            post.post_type = r#type;
        }
        UpdatePostRequest::Author { team_id } => {
            let author: Author = if let Some(team_id) = team_id {
                let team_pk: Partition = team_id.into();
                Team::get_permitted_team(
                    cli,
                    team_pk,
                    user.pk(),
                    TeamGroupPermission::PostWrite,
                )
                .await?
                .into()
            } else {
                let user_pk = user.pk();
                let full_user = crate::features::auth::User::find_by_pk(&user_pk)
                    .await?
                    .ok_or::<Error>(PostError::NotAccessible.into())?;
                full_user.into()
            };

            post.user_pk = author.pk.to_string();
            post.author_display_name = author.display_name;
            post.author_profile_url = author.profile_url;
            post.author_username = author.username;
            post.author_type = AuthorTypeJson(author.user_type);
        }
        UpdatePostRequest::ArtworkMetadata {
            metadata: next_metadata,
        } => {
            let existing = PostArtwork::find_by_post(post_uuid).await?;
            tracing::debug!("Existing artwork metadata: {:?}", existing);
            let mut artwork = existing.unwrap_or_else(|| PostArtwork::new(post_uuid, vec![]));
            artwork.metadata = ArtworkMetadataVec(next_metadata);
            artwork.save().await?;
        }
    }

    let post = post.save().await?;

    // Phase 5: emit as MODIFY (real old→new images) so the is_modify POST rules
    // fire (TimelineUpdate, PopularPostUpdate, PostPublishedForSyndication —
    // gated on `is_modify && status==PUBLISHED`) alongside the is_upsert
    // essence/vector rules.
    crate::common::events::outbox::EventOutbox::emit_modify(
        crate::common::events::outbox::topic::POST,
        &old_post,
        &post,
    )
    .await
    .ok();

    // Write the cross-posting directive to Postgres now that the Post publish
    // has been saved. Natural-key (`post_id`) upsert keeps re-publish idempotent.
    // A directive failure must not fail the publish, so it is logged, not
    // propagated (Stage 1 simply won't syndicate this post).
    if let Some(directive) = pending_directive {
        if let Err(e) = PostSyndicationDirective::repository()
            .upsert_on(&["post_id"], &directive)
            .await
        {
            crate::error!("update_post: failed to persist syndication directive: {e}");
        }
    }

    // Essence re-indexing happens via the DynamoDB Stream pipeline.

    Ok(post)
}
