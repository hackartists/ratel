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

    let fetched: Vec<SpaceCommon> = fetch_spaces(&space_pks).await?;

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

    let items = build_hot_space_cards(spaces).await?;

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

    let spaces: Vec<SpaceCommon> = fetch_spaces(&space_pks).await?;

    let items = build_hot_space_cards(spaces).await?;

    Ok((items, next_bookmark).into())
}

/// Fetch the `SpaceCommon` rows for the given partitions with one `IN` query,
/// returned in `space_pks` order. Missing rows are silently skipped — same
/// semantics as the old DynamoDB `batch_get`, which also just omitted keys that
/// didn't resolve to an item.
#[cfg(feature = "server")]
async fn fetch_spaces(space_pks: &[Partition]) -> Result<Vec<SpaceCommon>> {
    let by_pk = SpaceCommon::get_many_by_partitions(space_pks).await?;
    Ok(space_pks
        .iter()
        .filter_map(|pk| by_pk.get(&pk.to_string()).cloned())
        .collect())
}

/// Build the home carousel cards (`HotSpaceResponse`) for `spaces`, shared by
/// the "my spaces" and "invited" home lists. `rank` is the 1-based position in
/// `spaces`. Backing posts and per-type action counts are loaded for the whole
/// page at once (one query each) instead of per space.
#[cfg(feature = "server")]
async fn build_hot_space_cards(spaces: Vec<SpaceCommon>) -> Result<Vec<HotSpaceResponse>> {
    let post_ids: Vec<uuid::Uuid> = spaces
        .iter()
        .filter_map(|space| post_uuid_of(&space.partition()))
        .collect();
    let space_ids: Vec<String> = spaces
        .iter()
        .map(|space| SpacePartition::from(space.partition()).0)
        .collect();

    let (posts, action_counts) = tokio::try_join!(
        Post::get_many(post_ids),
        SpaceAction::count_by_type_for_spaces(&space_ids),
    )?;
    let posts: HashMap<uuid::Uuid, Post> = posts.into_iter().map(|p| (p.id, p)).collect();

    Ok(spaces
        .into_iter()
        .enumerate()
        .map(|(idx, space)| {
            let space_pk = space.partition();
            let post = post_uuid_of(&space_pk).and_then(|id| posts.get(&id));
            let space_id = SpacePartition::from(space_pk.clone()).0;
            let counts = action_counts.get(&space_id).map(Vec::as_slice).unwrap_or(&[]);
            build_hot_space_card(space, post, counts, idx as i64 + 1)
        })
        .collect())
}

#[cfg(feature = "server")]
fn post_uuid_of(space_pk: &Partition) -> Option<uuid::Uuid> {
    match space_pk.clone().to_post_key().ok()? {
        Partition::Feed(id) => uuid::Uuid::parse_str(&id).ok(),
        _ => None,
    }
}

/// Build one home carousel card from a `SpaceCommon`, its backing Feed post
/// (title/description live there, not on `SpaceCommon`) and its action counts.
#[cfg(feature = "server")]
fn build_hot_space_card(
    space: SpaceCommon,
    post: Option<&Post>,
    action_counts: &[(SpaceActionType, i64)],
    rank: i64,
) -> HotSpaceResponse {
    let space_pk = space.partition();
    let post_pk = space_pk.clone().to_post_key().ok();

    let title = post.map(|p| p.title.clone()).unwrap_or_default();
    let description = if !space.content.is_empty() {
        extract_description(&space.content)
    } else {
        post.map(|p| extract_description(&p.body.0.to_html()))
            .unwrap_or_default()
    };

    let (poll_count, discussion_count, quiz_count, follow_count) = tally_actions(action_counts);
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
fn tally_actions(counts: &[(SpaceActionType, i64)]) -> (i64, i64, i64, i64) {
    let mut polls = 0i64;
    let mut discussions = 0i64;
    let mut quizzes = 0i64;
    let mut follows = 0i64;
    for (kind, n) in counts {
        match kind {
            SpaceActionType::Poll => polls += n,
            SpaceActionType::TopicDiscussion => discussions += n,
            SpaceActionType::Quiz => quizzes += n,
            SpaceActionType::Follow => follows += n,
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
