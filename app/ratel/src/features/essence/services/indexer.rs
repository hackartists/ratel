//! Live indexing helpers — invoked by the DynamoDB Stream pipeline (and the
//! migrate endpoint) to mirror every source entity into an `Essence` row so
//! the user's Essence House stays in sync without a manual roundtrip.
//!
//! Every function is intentionally `(&entity)` shaped so the stream
//! dispatcher can call them uniformly after deserializing the new image,
//! without needing extra context from the original write site. Lookups for
//! related entities (creator id, action title, etc.) happen inline.
//!
//! Postgres migration note: `SpaceCommon`/`SpaceAction` reads no longer need
//! the DynamoDB client, but `index_poll` / `detach_poll` / `index_quiz` /
//! `detach_quiz` keep a `cli` parameter (now unused) so the existing
//! dispatcher call sites (`common::events::dispatcher`,
//! `common::types::event_bridge_envelope`) don't need to change shape.

use crate::common::*;
use crate::common::models::space::SpaceCommon;
use crate::features::essence::models::Essence;
use crate::features::essence::types::*;
use crate::features::posts::models::{Post, PostComment};
use crate::features::spaces::pages::actions::actions::discussion::SpacePostComment;
use crate::features::spaces::pages::actions::actions::poll::SpacePoll;
use crate::features::spaces::pages::actions::actions::quiz::SpaceQuiz;

/// Register a FOF rationale into Essence (opt-in flow, PR6 step 4).
/// Caller is the rationale author; the row already exists in the DB
/// (written during the rationale-submit stage). This function only
/// performs the Essence side: upserts an `Essence` row pointing at
/// the rationale's (round, user), so the user's Essence House surfaces it
/// alongside posts/comments/etc.
pub async fn index_fact_fold_rationale(
    rationale: &crate::features::arcade::games::fact_or_fold::models::FactFoldRationale,
) -> Result<()> {
    let source_pk = Partition::FactFold(rationale.round_id.clone());
    let source_sk = EntityType::FactFoldRationale(rationale.user_id.clone());
    let owner_pk = rationale
        .user_pk
        .parse::<Partition>()
        .unwrap_or_else(|_| Partition::User(rationale.user_id.clone()));

    let title = summarize(&rationale.text, 80);
    let source_path = format!(
        "Fact or Fold · {} / {}",
        strip_prefix(&source_pk.to_string()),
        strip_prefix(&source_sk.to_string()),
    );
    let word_count = rationale.text.split_whitespace().count() as i64;
    Essence::upsert_for_source(
        owner_pk,
        source_pk,
        source_sk,
        EssenceSourceKind::FactFoldRationale,
        title,
        source_path,
        word_count,
        None,
    )
    .await
}

pub async fn index_post(post: &Post) -> Result<()> {
    let post_pk = Partition::Feed(post.feed_id());
    let title = if post.title.is_empty() {
        "(Untitled post)".to_string()
    } else {
        post.title.clone()
    };
    let source_path = format!("Ratel post · {}", strip_prefix(&post_pk.to_string()));
    let word_count = (estimate_word_count(&post.body.to_html())
        + post.title.split_whitespace().count() as u32) as i64;

    Essence::upsert_for_source(
        post.author_partition(),
        post_pk,
        EntityType::Post,
        EssenceSourceKind::Post,
        title,
        source_path,
        word_count,
        None,
    )
    .await
}

pub async fn detach_post(post: &Post) -> Result<()> {
    let post_pk = Partition::Feed(post.feed_id());
    Essence::delete_for_source(post.author_partition(), &post_pk, &EntityType::Post).await
}

pub async fn index_post_comment(comment: &PostComment) -> Result<()> {
    let (comment_pk, comment_sk) = post_comment_key(comment);
    let author_pk = comment
        .author_pk
        .parse::<Partition>()
        .unwrap_or_else(|_| Partition::User(comment.author_pk.clone()));

    let title = summarize(&comment.content, 80);
    let source_path = format!(
        "Ratel comment · {} / {}",
        strip_prefix(&comment_pk.to_string()),
        strip_prefix(&comment_sk.to_string())
    );
    let word_count = comment.content.split_whitespace().count() as i64;

    Essence::upsert_for_source(
        author_pk,
        comment_pk,
        comment_sk,
        EssenceSourceKind::PostComment,
        title,
        source_path,
        word_count,
        None,
    )
    .await
}

pub async fn detach_post_comment(comment: &PostComment) -> Result<()> {
    let (comment_pk, comment_sk) = post_comment_key(comment);
    let author_pk = comment
        .author_pk
        .parse::<Partition>()
        .unwrap_or_else(|_| Partition::User(comment.author_pk.clone()));
    Essence::delete_for_source(author_pk, &comment_pk, &comment_sk).await
}

/// Reconstructs the legacy `(pk, sk)` pair for a `PostComment` row from its
/// Postgres identity. Top-level comments live under `Feed(post_id)` /
/// `PostComment(id)`; replies live under `PostReply(post_id)` /
/// `PostCommentReply(parent_id, id)`.
fn post_comment_key(comment: &PostComment) -> (Partition, EntityType) {
    let post_id = comment.post_id.to_string();
    let comment_id = comment.id.to_string();
    match comment.parent_comment_id {
        Some(parent_id) => (
            Partition::PostReply(post_id),
            EntityType::PostCommentReply(parent_id.to_string(), comment_id),
        ),
        None => (
            Partition::Feed(post_id),
            EntityType::PostComment(comment_id),
        ),
    }
}

/// Looks up the parent space's `user_pk` to attribute the essence row to the
/// space creator (polls/quizzes are creator-authored content, so attribution
/// follows the space owner — not whoever called `update_poll`).
async fn lookup_space_creator(space_pk: &Partition) -> Result<Partition> {
    let space = SpaceCommon::get_by_partition(space_pk)
        .await
        .map_err(|e| {
            crate::error!("essence indexer: space lookup failed: {e}");
            EssenceError::ReadFailed
        })?
        .ok_or_else(|| {
            crate::error!("essence indexer: space {space_pk} not found");
            EssenceError::ReadFailed
        })?;
    space
        .user_pk
        .parse::<Partition>()
        .map_err(|_| EssenceError::ReadFailed.into())
}

/// `cli` kept (unused) for call-site compatibility — see module docs.
pub async fn index_poll(_cli: &aws_sdk_dynamodb::Client, poll: &SpacePoll) -> Result<()> {
    let space_pk = Partition::Space(poll.space_id.clone());
    let poll_sk = EntityType::SpacePoll(poll.poll_id.clone());
    let creator_pk = lookup_space_creator(&space_pk).await?;
    let title = if poll.title.is_empty() {
        "(Untitled poll)".to_string()
    } else {
        poll.title.clone()
    };
    let source_path = format!(
        "Ratel poll · {} / {}",
        strip_prefix(&space_pk.to_string()),
        strip_prefix(&poll_sk.to_string())
    );
    let word_count = (poll.title.split_whitespace().count()
        + poll.description.split_whitespace().count()) as i64;

    Essence::upsert_for_source(
        creator_pk,
        space_pk.clone(),
        poll_sk,
        EssenceSourceKind::Poll,
        title,
        source_path,
        word_count,
        Some(space_pk),
    )
    .await
}

pub async fn detach_poll(_cli: &aws_sdk_dynamodb::Client, poll: &SpacePoll) -> Result<()> {
    let space_pk = Partition::Space(poll.space_id.clone());
    let poll_sk = EntityType::SpacePoll(poll.poll_id.clone());
    let creator_pk = lookup_space_creator(&space_pk).await?;
    Essence::delete_for_source(creator_pk, &space_pk, &poll_sk).await
}

/// Quizzes carry their displayable title/description on the `SpaceAction`
/// (the one-per-action metadata row keyed by `(space, action_id)`). When
/// indexing, we look that row up to mirror the same text the user sees in
/// the arena card.
///
/// `cli` kept (unused) for call-site compatibility — see module docs.
pub async fn index_quiz(_cli: &aws_sdk_dynamodb::Client, quiz: &SpaceQuiz) -> Result<()> {
    use crate::features::spaces::pages::actions::models::SpaceAction;

    let space_pk = Partition::Space(quiz.space_id.clone());
    let quiz_sk = EntityType::SpaceQuiz(quiz.quiz_id.clone());
    let creator_pk = lookup_space_creator(&space_pk).await?;

    let (action_title, action_description) =
        match SpaceAction::get_one(&SpacePartition(quiz.space_id.clone()), &quiz.quiz_id).await {
            Ok(Some(action)) => (action.title, action.description),
            _ => (String::new(), String::new()),
        };

    let title = if action_title.trim().is_empty() {
        format!("Quiz {}", strip_prefix(&quiz_sk.to_string()))
    } else {
        action_title.clone()
    };
    let source_path = format!(
        "Ratel quiz · {} / {}",
        strip_prefix(&space_pk.to_string()),
        strip_prefix(&quiz_sk.to_string())
    );
    let word_count = (action_title.split_whitespace().count()
        + action_description.split_whitespace().count()) as i64;

    Essence::upsert_for_source(
        creator_pk,
        space_pk.clone(),
        quiz_sk,
        EssenceSourceKind::Quiz,
        title,
        source_path,
        word_count,
        Some(space_pk),
    )
    .await
}

pub async fn detach_quiz(_cli: &aws_sdk_dynamodb::Client, quiz: &SpaceQuiz) -> Result<()> {
    let space_pk = Partition::Space(quiz.space_id.clone());
    let quiz_sk = EntityType::SpaceQuiz(quiz.quiz_id.clone());
    let creator_pk = lookup_space_creator(&space_pk).await?;
    Essence::delete_for_source(creator_pk, &space_pk, &quiz_sk).await
}

/// Reconstructs the legacy `(pk, sk)` pair for a `SpacePostComment` row.
fn discussion_comment_key(comment: &SpacePostComment) -> (Partition, EntityType) {
    let post_pk = Partition::SpacePost(comment.post_id.clone());
    let sk = if comment.parent_comment_id.is_empty() {
        EntityType::SpacePostComment(comment.comment_id.clone())
    } else {
        EntityType::SpacePostCommentReply(
            comment.parent_comment_id.clone(),
            comment.comment_id.clone(),
        )
    };
    (post_pk, sk)
}

/// `space_pk` for the essence row comes from the comment's denormalized
/// `space_id` field (set by `SpacePostComment::new`). Older rows missing the
/// field index without `space_pk`, which only degrades the "open in space"
/// shortcut and not list/search.
pub async fn index_discussion_comment(comment: &SpacePostComment) -> Result<()> {
    let (comment_pk, comment_sk) = discussion_comment_key(comment);
    let author_pk = comment
        .author_pk
        .parse::<Partition>()
        .unwrap_or_else(|_| Partition::User(comment.author_pk.clone()));
    let space_pk = comment
        .space_id
        .as_ref()
        .map(|id| Partition::Space(id.clone()));

    let title = summarize(&comment.content, 80);
    let source_path = format!(
        "Discussion · {} / {}",
        strip_prefix(&comment_pk.to_string()),
        strip_prefix(&comment_sk.to_string())
    );
    let word_count = comment.content.split_whitespace().count() as i64;

    Essence::upsert_for_source(
        author_pk,
        comment_pk,
        comment_sk,
        EssenceSourceKind::DiscussionComment,
        title,
        source_path,
        word_count,
        space_pk,
    )
    .await
}

pub async fn detach_discussion_comment(comment: &SpacePostComment) -> Result<()> {
    let (comment_pk, comment_sk) = discussion_comment_key(comment);
    let author_pk = comment
        .author_pk
        .parse::<Partition>()
        .unwrap_or_else(|_| Partition::User(comment.author_pk.clone()));
    Essence::delete_for_source(author_pk, &comment_pk, &comment_sk).await
}

/// Drop the `PREFIX#` that `DynamoEnum` Display emits, returning just the
/// id portion for display. Idempotent on strings that have no `#`.
fn strip_prefix(raw: &str) -> &str {
    raw.split_once('#').map(|(_, tail)| tail).unwrap_or(raw)
}

/// Strip HTML tags and return a rough word count — matches how the running
/// create_post handler estimates body length so migrated rows are
/// consistent with newly-created ones.
fn estimate_word_count(html: &str) -> u32 {
    let re_tags = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = re_tags.replace_all(html, " ");
    text.split_whitespace().count() as u32
}

/// First `n` characters of `s` after HTML-tag strip + whitespace collapse.
/// Comment content is often rich-text HTML (discussion comments etc.);
/// delegates to the shared `common::utils::html` helpers so the same
/// cleanup logic runs on both the server (this indexer) and the client
/// (essence sources table).
fn summarize(s: &str, n: usize) -> String {
    crate::common::utils::html::summarize_plain(s, n)
}
