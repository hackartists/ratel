//! Server-only services for the cross-posting pipeline.

pub mod adapters;
pub mod connection;
pub mod credentials;
pub mod dispatcher;
pub mod factory;
pub mod format;
pub mod oauth_state;
pub mod shard;
pub use adapters::*;

use crate::common::Partition;

/// Bare user id from `Partition::User(id)`. The Postgres `user_id` columns on
/// every cross-posting entity hold the bare id (no `USER#` prefix), so every
/// controller / service maps `user.pk` through this helper before a lookup.
pub fn user_id_of(pk: &Partition) -> String {
    match pk {
        Partition::User(id) => id.clone(),
        other => other.to_string(),
    }
}

/// Bare feed/post id from `Partition::Feed(id)`. Mirrors [`user_id_of`] for the
/// `post_id` columns.
pub fn feed_id_of(pk: &Partition) -> String {
    match pk {
        Partition::Feed(id) => id.clone(),
        other => other.to_string(),
    }
}

// Phase 1A+1D scope: failed jobs notify the author and surface a manual
// Retry CTA on the post-detail panel. We do NOT auto-retry — see the
// design doc § "Stage 3 (manual retry + notification)" for the spec
// rewrite. Stage 4 (adaptive engagement scheduler) is still pending.
