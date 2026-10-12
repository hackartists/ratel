// TODO(hot-spaces-ranking): `count_actions` below is an N+1 query.
// The denormalized-count follow-up (SpaceActionCount entity) in
// docs/superpowers/plans/2026-04-21-hot-spaces-ranking.md removes it.

use super::list_hot_spaces::HotSpaceResponse;
use crate::features::spaces::space_common::models::HotSpaceHeat;
use crate::common::*;
#[cfg(feature = "server")]
use crate::common::models::space::{
    PARTICIPANT_KIND, SpaceCommon, SpaceParticipant, SpaceParticipantColumn,
};
use crate::features::auth::User;
#[cfg(feature = "server")]
use crate::features::posts::models::Post;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::types::SpaceActionType;
#[cfg(feature = "server")]
use std::collections::HashMap;

#[get("/api/home/my-spaces?bookmark", user: User)]
pub async fn list_my_home_spaces_handler(
    bookmark: Option<String>,
) -> Result<ListResponse<HotSpaceResponse>> {
    use postgres::PostgresEntity;
    use postgres::ops::StringOp;

    let user_pk = user.pk();

    // `bookmark` carries the 1-based page number (opaque to the client).
    let page = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let page_size = 10i64;

    let result = SpaceParticipant::repository()
        .find(
            SpaceParticipant::query()
                .user_pk(StringOp::Eq(user_pk.to_string()))
                .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()))
                .order_by(SpaceParticipantColumn::CreatedAt, postgres::Order::Desc)
                .page(page)
                .page_size(page_size),
        )
        .await
        .map_err(crate::common::Error::from)?;
    let next_bookmark = if result.page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };
    let participants = result.items;

    let activity_map: HashMap<String, i64> = participants
        .iter()
        .map(|sp| (sp.space_pk.clone(), sp.last_activity_at.unwrap_or(sp.created_at)))
        .collect();

    let space_pks: Vec<Partition> = participants
        .iter()
        .filter_map(|sp| sp.space_pk.parse::<Partition>().ok())
        .collect();

    let fetched: Vec<SpaceCommon> = fetch_spaces(&space_pks).await;

    // Active (Ongoing/Open) spaces come first so the carousel leads with
    // what the user can still engage with; Finished/Designing/Draft still
    // surface below for history access (result review, archive revisit,
    // notification deep-links) AND so creators see their own in-progress
    // designs — `create_space_handler` writes a participant row for the
    // author at creation time, but the space starts in `publish_state =
    // Draft`, so filtering on `is_published()` would hide the creator's
    // own brand-new space from this list. Within each bucket, sort by
    // last participant activity.
    let mut spaces: Vec<SpaceCommon> = fetched;
    spaces.sort_by(|a, b| {
        b.is_active().cmp(&a.is_active()).then_with(|| {
            let a_act = activity_map.get(&a.space_pk).copied().unwrap_or(0);
            let b_act = activity_map.get(&b.space_pk).copied().unwrap_or(0);
            b_act.cmp(&a_act)
        })
    });

    let mut items: Vec<HotSpaceResponse> = Vec::with_capacity(spaces.len());
    for (idx, space) in spaces.into_iter().enumerate() {
        items.push(build_hot_space_card(space, idx as i64 + 1).await);
    }

    Ok((items, next_bookmark).into())
}

/// Spaces the user has been **invited** to but not yet joined — the persistent,
/// discoverable surface for invitations (the notification bell is transient).
/// Powers the home "INVITED" tab. Only `Invited` status is returned: it means
/// the space is published and the user can enter (`Pending` = space not live
/// yet, so joining is blocked — see `participate_space`).
#[get("/api/home/invited-spaces?bookmark", user: User)]
pub async fn list_my_invited_spaces_handler(
    bookmark: Option<String>,
) -> Result<ListResponse<HotSpaceResponse>> {
    use crate::features::spaces::space_common::models::{
        InvitationStatus, SpaceInvitationMember, SpaceInvitationMemberColumn,
    };
    use postgres::PostgresEntity;
    use postgres::ops::{EnumOp, StringOp};

    let user_pk = user.pk();

    // `bookmark` carries the 1-based page number (opaque string to the client).
    let page = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let page_size = 10i64;

    // Invited-only, newest first — replaces the DynamoDB
    // `find_user_invitations_by_status_latest` GSI scan.
    let invitations = SpaceInvitationMember::repository()
        .find(
            SpaceInvitationMember::query()
                .user_pk(StringOp::Eq(user_pk.to_string()))
                .status(EnumOp::Eq(InvitationStatus::Invited))
                .order_by(
                    SpaceInvitationMemberColumn::CreatedAt,
                    postgres::Order::Desc,
                )
                .page(page)
                .page_size(page_size),
        )
        .await
        .map_err(crate::common::Error::from)?;

    let has_next = invitations.page < invitations.total_pages;
    let next_bookmark = if has_next {
        Some((page + 1).to_string())
    } else {
        None
    };

    // Each invitation row's `space_pk` (full `Partition` string) IS the space key.
    let space_pks: Vec<Partition> = invitations
        .items
        .iter()
        .filter_map(|inv| inv.space_pk.parse::<Partition>().ok())
        .collect();

    let spaces: Vec<SpaceCommon> = fetch_spaces(&space_pks).await;

    let mut items: Vec<HotSpaceResponse> = Vec::with_capacity(spaces.len());
    for (idx, space) in spaces.into_iter().enumerate() {
        items.push(build_hot_space_card(space, idx as i64 + 1).await);
    }

    Ok((items, next_bookmark).into())
}

/// Fetch every `SpaceCommon` row for the given partitions. Missing rows are
/// silently skipped — same semantics as the old DynamoDB `batch_get`, which
/// also just omitted keys that didn't resolve to an item.
#[cfg(feature = "server")]
async fn fetch_spaces(space_pks: &[Partition]) -> Vec<SpaceCommon> {
    let mut out = Vec::with_capacity(space_pks.len());
    for pk in space_pks {
        if let Ok(Some(space)) = SpaceCommon::get_by_partition(pk).await {
            out.push(space);
        }
    }
    out
}

/// Build one home carousel card (`HotSpaceResponse`) from a `SpaceCommon`.
/// Shared by the "my spaces" and "invited" home lists. `rank` is the 1-based
/// position within its list.
#[cfg(feature = "server")]
async fn build_hot_space_card(space: SpaceCommon, rank: i64) -> HotSpaceResponse {
    let space_pk = space.partition();
    let post_pk = space_pk.clone().to_post_key().ok();

    // Fetch the backing post per space (same path `list_hot_spaces`'s fan-out
    // uses) — the title/description live on the Feed post, not SpaceCommon.
    let post_uuid = post_pk.as_ref().and_then(|pk| match pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    });
    let post = match post_uuid {
        Some(id) => Post::get_by_feed_id(id).await.ok().flatten(),
        None => None,
    };

    let title = post.as_ref().map(|p| p.title.clone()).unwrap_or_default();
    let description = if !space.content.is_empty() {
        extract_description(&space.content)
    } else {
        post.as_ref()
            .map(|p| extract_description(&p.body.0.to_html()))
            .unwrap_or_default()
    };

    let (poll_count, discussion_count, quiz_count, follow_count) = count_actions(&space_pk).await;
    let total_actions = poll_count + discussion_count + quiz_count + follow_count;
    let heat = derive_heat(space.participants);

    HotSpaceResponse {
        space_id: space_pk.clone().into(),
        post_id: post_pk.unwrap_or_default().into(),
        title,
        description,
        logo: space.logo,
        author_display_name: space.author_display_name,
        participants: space.participants,
        rewards: space.rewards.unwrap_or(0),
        poll_count,
        discussion_count,
        quiz_count,
        follow_count,
        total_actions,
        heat,
        rank,
        created_at: space.created_at,
    }
}

#[cfg(feature = "server")]
async fn count_actions(space_pk: &Partition) -> (i64, i64, i64, i64) {
    let space_id: SpacePartition = space_pk.clone().into();
    let actions = match SpaceAction::list_by_space(&space_id).await {
        Ok(actions) => actions,
        Err(_) => return (0, 0, 0, 0),
    };

    let mut polls = 0i64;
    let mut discussions = 0i64;
    let mut quizzes = 0i64;
    let mut follows = 0i64;
    for a in actions {
        match a.space_action_type {
            SpaceActionType::Poll => polls += 1,
            SpaceActionType::TopicDiscussion => discussions += 1,
            SpaceActionType::Quiz => quizzes += 1,
            SpaceActionType::Follow => follows += 1,
            SpaceActionType::Meet | SpaceActionType::Announcement => {}
        }
    }
    (polls, discussions, quizzes, follows)
}

fn derive_heat(participants: i64) -> HotSpaceHeat {
    if participants >= 5_000 {
        HotSpaceHeat::Blazing
    } else if participants >= 500 {
        HotSpaceHeat::Trending
    } else {
        HotSpaceHeat::Rising
    }
}

#[cfg(feature = "server")]
fn extract_description(html: &str) -> String {
    let re_img = regex::Regex::new(r"<img[^>]*>").unwrap();
    let without_images = re_img.replace_all(html, "");

    let re_tags = regex::Regex::new(r"<[^>]+>").unwrap();
    let without_tags = re_tags.replace_all(&without_images, "");

    let re_urls = regex::Regex::new(r"https?://[^\s]+").unwrap();
    let without_urls = re_urls.replace_all(&without_tags, "");

    let re_whitespace = regex::Regex::new(r"\s+").unwrap();
    re_whitespace
        .replace_all(&without_urls, " ")
        .trim()
        .to_string()
}
