//! Server-side moderation helpers shared by the discussion controllers
//! (enforcement) and the admin moderation controllers.
#![cfg(feature = "server")]

use super::{UserBlock, UserModerationFlag};
use crate::common::*;
use std::collections::HashSet;

/// The set of `user_pk` strings the viewer has personally blocked (App Store
/// req #4). Comment listings drop authors in this set for that viewer.
pub async fn blocked_author_set(
    cli: &aws_sdk_dynamodb::Client,
    viewer_pk: Option<&Partition>,
) -> HashSet<String> {
    let viewer_id = match viewer_pk {
        Some(Partition::User(id)) => id.clone(),
        _ => return HashSet::new(),
    };
    let opt = UserBlock::opt().limit(500);
    match UserBlock::query(cli, Partition::UserBlock(viewer_id), opt).await {
        Ok((items, _)) => items
            .into_iter()
            .map(|b| b.blocked_pk.to_string())
            .collect(),
        Err(e) => {
            crate::error!("failed to load block set: {e}");
            HashSet::new()
        }
    }
}

/// True when the user is soft-banned by moderation: their comments are hidden
/// and new comments/replies are rejected (App Store req #5).
pub async fn is_user_soft_banned(cli: &aws_sdk_dynamodb::Client, user_pk: &Partition) -> bool {
    let (pk, sk) = match UserModerationFlag::keys(user_pk) {
        Some(keys) => keys,
        None => return false,
    };
    matches!(
        UserModerationFlag::get(cli, &pk, Some(sk)).await,
        Ok(Some(flag)) if flag.is_blocked()
    )
}

/// Drop moderation-hidden comments and comments authored by someone the viewer
/// personally blocked. `author_of` extracts each item's author `Partition`.
pub fn retain_visible<T>(
    items: Vec<T>,
    blocked: &HashSet<String>,
    hidden_of: impl Fn(&T) -> bool,
    author_of: impl Fn(&T) -> &Partition,
) -> Vec<T> {
    items
        .into_iter()
        .filter(|it| !hidden_of(it) && !blocked.contains(&author_of(it).to_string()))
        .collect()
}
