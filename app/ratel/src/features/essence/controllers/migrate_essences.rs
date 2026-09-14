use crate::common::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::common::models::auth::AdminUser;
#[cfg(feature = "server")]
use crate::features::essence::models::{Essence, UserEssenceStats};
use crate::features::essence::types::*;
#[cfg(feature = "server")]
use crate::features::essence::services as essence_services;
use serde::{Deserialize, Serialize};
#[cfg(feature = "server")]
use std::collections::HashMap;

/// Response shape for the admin migration endpoint. Counts per source kind
/// so the operator can spot obvious undercounts.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct MigrateEssencesResponse {
    pub posts_scanned: u32,
    pub spaces_scanned: u32,
    pub discussions_scanned: u32,
    pub posts_migrated: u32,
    pub post_comments_migrated: u32,
    pub discussion_comments_migrated: u32,
    pub polls_migrated: u32,
    pub quizzes_migrated: u32,
    /// Number of `UserEssenceStats` rows rebuilt from scratch. Counter drift
    /// from earlier writes (bumps that silently failed) is reconciled here,
    /// and the new per-kind counters are populated for users created before
    /// they existed on the model.
    pub stats_rebuilt: u32,
    /// Non-fatal errors during the run — logged server-side, returned here
    /// as a count so the operator can spot trouble without tailing logs.
    pub errors: u32,
}

/// Admin-only backfill. Scans every source entity type directly (a full
/// table scan per entity, since this endpoint runs rarely and off the hot
/// path), and idempotently upserts an Essence row per source. Attribution
/// (`user_pk` on the Essence row) is copied from each source row's own
/// author field, so team-authored content stays attributed to the team and
/// user-authored content to the user.
#[post("/api/admin/essences/migrate", _user: AdminUser)]
pub async fn migrate_essences_handler() -> Result<MigrateEssencesResponse> {
    let mut out = MigrateEssencesResponse::default();

    migrate_posts_and_comments(&mut out).await;
    migrate_spaces_content(&mut out).await;
    rebuild_user_essence_stats(&mut out).await;

    Ok(out)
}

/// Walk every `Essence` row, group by `user_pk`, and overwrite each user's
/// `UserEssenceStats` with the recomputed totals. This reconciles any
/// drift from prior `bump_stats` calls that failed silently (the bump path
/// intentionally logs-and-continues so a stats hiccup never fails a user
/// write). It also populates the new `total_{kind}` fields for users who
/// predate them.
#[cfg(feature = "server")]
async fn rebuild_user_essence_stats(out: &mut MigrateEssencesResponse) {
    let essences = match Essence::find_all_rows().await {
        Ok(v) => v,
        Err(e) => {
            crate::error!("migrate: scan essences for stats rebuild failed: {e}");
            out.errors += 1;
            return;
        }
    };

    let mut totals_by_user: HashMap<String, UserEssenceStats> = HashMap::new();
    for row in essences {
        let key = row.owner_pk.clone();
        let entry = totals_by_user
            .entry(key)
            .or_insert_with(UserEssenceStats::default);
        entry.total_sources += 1;
        entry.total_words += row.word_count;
        match row.source_kind {
            EssenceSourceKind::Notion => entry.total_notion += 1,
            EssenceSourceKind::Post => entry.total_post += 1,
            EssenceSourceKind::PostComment | EssenceSourceKind::DiscussionComment => {
                entry.total_comment += 1
            }
            EssenceSourceKind::Poll => entry.total_poll += 1,
            EssenceSourceKind::Quiz => entry.total_quiz += 1,
            EssenceSourceKind::FactFoldRationale => entry.total_fact_fold_rationale += 1,
        }
    }

    for (user_pk_str, totals) in totals_by_user {
        if let Err(e) = Essence::replace_stats(&user_pk_str, totals).await {
            crate::error!("migrate: replace stats failed for {user_pk_str}: {e}");
            out.errors += 1;
            continue;
        }
        out.stats_rebuilt += 1;
    }
}

#[cfg(feature = "server")]
async fn migrate_posts_and_comments(out: &mut MigrateEssencesResponse) {
    use crate::features::posts::models::{Post, PostComment};
    use postgres::PostgresEntity;
    use postgres::ops::UuidOp;

    let posts = match Post::repository().find(Post::query()).await {
        Ok(page) => page.items,
        Err(e) => {
            crate::error!("migrate: list posts failed: {e}");
            out.errors += 1;
            return;
        }
    };
    out.posts_scanned = posts.len() as u32;

    for post in posts {
        if let Err(e) = essence_services::index_post(&post).await {
            crate::error!("migrate: upsert post essence failed: {e}");
            out.errors += 1;
        } else {
            out.posts_migrated += 1;
        }

        // Only top-level comments — mirrors the original DynamoDB scan, which
        // walked the post's `Feed` partition (top-level comments) and never
        // reached replies (stored under the separate `PostReply` partition).
        let comments = match PostComment::repository()
            .find(
                PostComment::query()
                    .post_id(UuidOp::Eq(post.id))
                    .filter(|c| c.parent_comment_id.is_null()),
            )
            .await
        {
            Ok(page) => page.items,
            Err(e) => {
                crate::error!("migrate: list post comments failed: {e}");
                out.errors += 1;
                continue;
            }
        };

        for c in comments {
            if let Err(e) = essence_services::index_post_comment(&c).await {
                crate::error!("migrate: upsert post comment essence failed: {e}");
                out.errors += 1;
                continue;
            }
            out.post_comments_migrated += 1;
        }
    }
}

#[cfg(feature = "server")]
async fn migrate_spaces_content(out: &mut MigrateEssencesResponse) {
    use crate::common::models::space::SpaceCommon;
    use crate::features::spaces::pages::actions::actions::discussion::{
        SpacePost, SpacePostComment,
    };
    use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
    use crate::features::spaces::pages::actions::actions::quiz::SpaceQuiz;
    use postgres::PostgresEntity;
    use postgres::ops::StringOp;

    let conf = crate::common::config::ServerConfig::default();
    let cli = conf.dynamodb();

    let spaces = match SpaceCommon::repository().find(SpaceCommon::query()).await {
        Ok(page) => page.items,
        Err(e) => {
            crate::error!("migrate: list spaces failed: {e}");
            out.errors += 1;
            return;
        }
    };
    out.spaces_scanned = spaces.len() as u32;

    for space in spaces {
        let space_id: SpacePartition = space.partition().into();

        match SpacePoll::repository()
            .find(SpacePoll::query().space_id(StringOp::Eq(space_id.0.clone())))
            .await
        {
            Ok(page) => {
                for poll in page.items {
                    if let Err(e) = essence_services::index_poll(cli, &poll).await {
                        crate::error!("migrate: upsert poll essence failed: {e}");
                        out.errors += 1;
                        continue;
                    }
                    out.polls_migrated += 1;
                }
            }
            Err(e) => {
                crate::error!("migrate: list polls for space failed: {e}");
                out.errors += 1;
            }
        }

        match SpaceQuiz::repository()
            .find(SpaceQuiz::query().space_id(StringOp::Eq(space_id.0.clone())))
            .await
        {
            Ok(page) => {
                for quiz in page.items {
                    if let Err(e) = essence_services::index_quiz(cli, &quiz).await {
                        crate::error!("migrate: upsert quiz essence failed: {e}");
                        out.errors += 1;
                        continue;
                    }
                    out.quizzes_migrated += 1;
                }
            }
            Err(e) => {
                crate::error!("migrate: list quizzes for space failed: {e}");
                out.errors += 1;
            }
        }

        let discussions = match SpacePost::repository()
            .find(SpacePost::query().space_id(StringOp::Eq(space_id.0.clone())))
            .await
        {
            Ok(page) => page.items,
            Err(e) => {
                crate::error!("migrate: list discussions for space failed: {e}");
                out.errors += 1;
                continue;
            }
        };
        out.discussions_scanned += discussions.len() as u32;

        for discussion in discussions {
            match SpacePostComment::repository()
                .find(SpacePostComment::query().post_id(StringOp::Eq(discussion.post_id.clone())))
                .await
            {
                Ok(page) => {
                    for mut c in page.items {
                        // Backfill space_id if missing on legacy rows so the
                        // essence row gets the right "open in space" link.
                        if c.space_id.is_none() {
                            c.space_id = Some(space_id.0.clone());
                        }
                        if let Err(e) = essence_services::index_discussion_comment(&c).await {
                            crate::error!(
                                "migrate: upsert discussion comment essence failed: {e}"
                            );
                            out.errors += 1;
                            continue;
                        }
                        out.discussion_comments_migrated += 1;
                    }
                }
                Err(e) => {
                    crate::error!("migrate: list discussion comments failed: {e}");
                    out.errors += 1;
                }
            }
        }
    }
}
