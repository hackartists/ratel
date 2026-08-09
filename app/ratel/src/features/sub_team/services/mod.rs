pub mod activity_aggregation;
pub mod announcement_fanout;
pub mod application_lifecycle;
pub mod broadcast_access;
pub mod termination;

pub use activity_aggregation::*;
pub use announcement_fanout::*;
pub use application_lifecycle::*;
pub use broadcast_access::*;
pub use termination::*;

/// Decode an opaque list bookmark into a 1-based page number. The DynamoDB
/// migration replaced the opaque LastEvaluatedKey cursor with a page-number
/// cursor: the bookmark is simply the next page number as a decimal string.
#[cfg(feature = "server")]
pub fn bookmark_to_page(bookmark: &Option<String>) -> i64 {
    bookmark
        .as_deref()
        .and_then(|s| s.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1)
}

/// Build the next-page bookmark from the current page and total page count.
/// `None` once the last page has been returned.
#[cfg(feature = "server")]
pub fn next_bookmark(page: i64, total_pages: i64) -> Option<String> {
    if page < total_pages {
        Some((page + 1).to_string())
    } else {
        None
    }
}
