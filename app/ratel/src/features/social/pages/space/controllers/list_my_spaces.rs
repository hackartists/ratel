use std::collections::HashMap;

use super::super::*;
use crate::common::models::space::{SpaceCommon, SpaceParticipant};
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct MySpaceResponse {
    pub space_pk: Partition,
    pub post_pk: Partition,
    pub title: String,
    pub description: String,
    pub author_display_name: String,
    pub author_profile_url: String,
    pub created_at: i64,
    pub visibility: SpaceVisibility,
    pub status: Option<SpaceStatus>,
    pub logo: String,
    pub participants: i64,
}

#[get("/api/me/spaces?bookmark&active_only", user: crate::features::auth::User)]
pub async fn list_my_spaces_handler(
    bookmark: Option<String>,
    active_only: Option<bool>,
) -> Result<ListResponse<MySpaceResponse>> {
    let filter_active = active_only.unwrap_or(false);
    let page_limit: i64 = 10;

    // When active_only is true, keep fetching participant pages server-side
    // until we collect up to `page_limit` active spaces or exhaust all pages.
    // A hard cap on pages scanned prevents unbounded reads for users
    // with many inactive participations.
    let max_pages: i32 = 5;
    let mut pages_scanned: i32 = 0;
    let mut collected_spaces: Vec<SpaceCommon> = Vec::new();
    // `bookmark` carries an opaque 1-based page number as a string (same
    // convention as the DynamoDB `opt_with_bookmark` this replaces).
    let mut current_page: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let final_bookmark;

    let user_pk = user.pk();

    loop {
        pages_scanned += 1;

        let page_result = {
            use postgres::ops::StringOp;
            SpaceParticipant::repository()
                .find(
                    SpaceParticipant::query()
                        .user_pk(StringOp::Eq(user_pk.to_string()))
                        .kind(StringOp::Eq(
                            crate::common::models::space::PARTICIPANT_KIND.to_string(),
                        ))
                        .order_by(
                            crate::common::models::space::SpaceParticipantColumn::CreatedAt,
                            postgres::Order::Desc,
                        )
                        .page(current_page)
                        .page_size(page_limit),
                )
                .await
                .map_err(crate::common::Error::from)?
        };
        let next_bookmark = if current_page < page_result.total_pages {
            Some((current_page + 1).to_string())
        } else {
            None
        };
        let participants = page_result.items;

        let space_pk_strings: Vec<String> =
            participants.iter().map(|sp| sp.space_pk.clone()).collect();

        let spaces: Vec<SpaceCommon> = if space_pk_strings.is_empty() {
            vec![]
        } else {
            use postgres::ops::StringOp;
            SpaceCommon::repository()
                .find(SpaceCommon::query().space_pk(StringOp::In(space_pk_strings)))
                .await
                .map_err(crate::common::Error::from)?
                .items
        };

        if filter_active {
            // In active_only mode, include all active spaces from the current page.
            // This may cause the number of returned items to exceed page_limit,
            // but it avoids skipping active spaces that appear later in the page
            // (pagination data loss when final_bookmark advances past them).
            collected_spaces.extend(spaces.into_iter().filter(|s| s.is_active()));
        } else {
            collected_spaces.extend(spaces);
        }

        // Stop if we have enough items or there are no more pages
        if collected_spaces.len() >= page_limit as usize || next_bookmark.is_none() {
            final_bookmark = next_bookmark;
            break;
        }

        // If not filtering, one page is sufficient
        if !filter_active {
            final_bookmark = next_bookmark;
            break;
        }

        // Hard cap: stop scanning after max_pages to bound reads. Return the
        // real next_bookmark so callers can continue scanning if they
        // choose, instead of permanently hiding the section when there are
        // more active spaces beyond the scan cap.
        if pages_scanned >= max_pages {
            final_bookmark = next_bookmark;
            break;
        }

        current_page += 1;
    }

    let post_ids: Vec<uuid::Uuid> = collected_spaces
        .iter()
        .filter_map(|s| match s.post_pk.parse::<Partition>().ok()? {
            Partition::Feed(id) => uuid::Uuid::parse_str(&id).ok(),
            _ => None,
        })
        .collect();

    let posts: Vec<crate::features::posts::models::Post> = if post_ids.is_empty() {
        vec![]
    } else {
        crate::features::posts::models::Post::get_many(post_ids).await?
    };

    // Build a HashMap for O(1) title lookups instead of O(spaces * posts) linear scans
    let title_map: HashMap<String, String> = posts
        .iter()
        .map(|p| (p.id.to_string(), p.title.clone()))
        .collect();
    let description_map: HashMap<String, String> = posts
        .into_iter()
        .map(|p| (p.id.to_string(), extract_description(&p.body.0.to_html())))
        .collect();

    let items: Vec<MySpaceResponse> = collected_spaces
        .into_iter()
        .map(|space| {
            let post_pk: Option<Partition> = space.post_pk.parse::<Partition>().ok();
            let post_id_str = match &post_pk {
                Some(Partition::Feed(id)) => id.clone(),
                _ => String::new(),
            };
            let title = title_map.get(&post_id_str).cloned().unwrap_or_default();
            let description = if !space.content.is_empty() {
                extract_description(&space.content)
            } else {
                description_map.get(&post_id_str).cloned().unwrap_or_default()
            };

            MySpaceResponse {
                space_pk: space.partition(),
                post_pk: post_pk.unwrap_or_default(),
                title,
                description,
                author_display_name: space.author_display_name,
                author_profile_url: space.author_profile_url,
                created_at: space.created_at,
                visibility: space.visibility,
                status: space.status,
                logo: space.logo,
                participants: space.participants,
            }
        })
        .collect();

    Ok(ListResponse {
        items,
        bookmark: final_bookmark,
    })
}

fn extract_description(html: &str) -> String {
    let re_img = regex::Regex::new(r"<img[^>]*>").unwrap();
    let without_images = re_img.replace_all(html, "");

    let re_tags = regex::Regex::new(r"<[^>]+>").unwrap();
    let without_tags = re_tags.replace_all(&without_images, "");

    let re_urls = regex::Regex::new(r"https?://[^\s]+").unwrap();
    let without_urls = re_urls.replace_all(&without_tags, "");

    let re_whitespace = regex::Regex::new(r"\s+").unwrap();
    re_whitespace.replace_all(&without_urls, " ").trim().to_string()
}
