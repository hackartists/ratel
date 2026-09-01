use super::*;

/// In-memory assembly helper for the post-detail response.
///
/// Postgres migration: previously a `DynamoEntity` untagged enum used to decode
/// every `sk`-prefixed row under a post's partition in one single-table query.
/// Postgres has no single-table layout, so `get_post_handler` now fetches the
/// post, its comments, its artwork and its repost with separate queries and
/// wraps each in this enum to reuse the existing `PostDetailResponse`
/// assembly. It is a plain server-only enum — no DB codec.
#[cfg(feature = "server")]
#[derive(Debug, Clone)]
pub enum PostMetadata {
    Post(Post),
    PostComment(PostComment),
    PostArtwork(PostArtwork),
    PostRepost(PostRepost),
}
