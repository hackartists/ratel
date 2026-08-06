use std::collections::HashSet;

use crate::features::posts::models::Post;
use crate::features::timeline::models::TimelineReason;
use crate::features::timeline::*;

use super::common::{collect_followers_with_reason, write_timeline_entries};

/// Fan out a published post to all relevant timelines.
///
/// Strategies applied:
/// 1. **Follower fan-out** -- delivers to all followers of the author + the author themselves
/// 2. **Team member fan-out** -- if the author is a Team, delivers to all team members
/// 3. Deduplicates across strategies so each user gets at most one entry
pub async fn fan_out_timeline_entries(post: Post) -> Result<()> {
    if !post.is_published() {
        return Ok(());
    }
    let post_pk = Partition::Feed(post.feed_id());
    let author_pk = post.author_partition();
    tracing::info!(
        "Timeline update: post_pk={}, author_pk={}, created_at={}",
        post_pk,
        author_pk,
        post.created_at
    );

    let created_at = post.created_at;
    let mut seen = HashSet::new();
    let mut entries: Vec<(Partition, TimelineReason)> = Vec::new();

    // 1. Author themselves
    seen.insert(author_pk.to_string());
    entries.push((author_pk.clone(), TimelineReason::Following));

    // 2. All followers of the author
    if post.is_public() {
        collect_followers(&author_pk, &mut seen, &mut entries).await?;
    }

    // 3. If the author is a Team, all team members
    if matches!(author_pk, Partition::Team(_)) {
        collect_team_members(&author_pk, &mut seen, &mut entries).await?;
    }

    tracing::info!(
        "fan_out_timeline_entries: writing {} timeline entries for post {}",
        entries.len(),
        post_pk
    );

    write_timeline_entries(&post_pk, &author_pk, created_at, &entries).await
}

/// Collect all follower user_pks of `target_pk`, adding them to `entries` with reason Following.
async fn collect_followers(
    target_pk: &Partition,
    seen: &mut HashSet<String>,
    entries: &mut Vec<(Partition, TimelineReason)>,
) -> Result<()> {
    collect_followers_with_reason(target_pk, seen, entries, TimelineReason::Following).await
}

/// Collect all team member user_pks via the `UserTeamGroup.team_pk` index.
async fn collect_team_members(
    team_pk: &Partition,
    seen: &mut HashSet<String>,
    entries: &mut Vec<(Partition, TimelineReason)>,
) -> Result<()> {
    let members = crate::features::auth::UserTeamGroup::find_by_team_pk(team_pk).await?;

    for member in members {
        let key = member.user_pk.clone();
        if seen.insert(key) {
            let member_pk: Partition = match member.user_pk.parse() {
                Ok(pk) => pk,
                Err(_) => continue,
            };
            entries.push((member_pk, TimelineReason::TeamMember));
        }
    }
    Ok(())
}
