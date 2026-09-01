//! Server-side moderation helpers shared by the discussion controllers
//! (enforcement) and the admin moderation controllers.
#![cfg(feature = "server")]

use super::{UserBlock, UserModerationFlag};
use crate::common::*;
use std::collections::HashSet;

/// The set of `user_pk` strings the viewer has personally blocked (App Store
/// req #4). Comment listings drop authors in this set for that viewer.
pub async fn blocked_author_set(viewer_pk: Option<&Partition>) -> HashSet<String> {
    let viewer_pk = match viewer_pk {
        Some(pk @ Partition::User(_)) => pk,
        _ => return HashSet::new(),
    };
    match UserBlock::blocked_by(viewer_pk).await {
        Ok(items) => items.into_iter().map(|b| b.blocked_pk).collect(),
        Err(e) => {
            crate::error!("failed to load block set: {e}");
            HashSet::new()
        }
    }
}

/// True when the user is soft-banned by moderation: their comments are hidden
/// and new comments/replies are rejected (App Store req #5).
pub async fn is_user_soft_banned(user_pk: &Partition) -> bool {
    UserModerationFlag::is_user_blocked(user_pk).await
}

/// Drop moderation-hidden comments and comments authored by someone the viewer
/// personally blocked. `author_of` extracts each item's author pk string.
pub fn retain_visible<T>(
    items: Vec<T>,
    blocked: &HashSet<String>,
    hidden_of: impl Fn(&T) -> bool,
    author_of: impl Fn(&T) -> &str,
) -> Vec<T> {
    items
        .into_iter()
        .filter(|it| !hidden_of(it) && !blocked.contains(author_of(it)))
        .collect()
}
