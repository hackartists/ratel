use crate::common::*;
use crate::features::auth::User;
#[cfg(feature = "server")]
use crate::features::essence::models::Essence;
use crate::features::essence::types::*;

/// Paginated list of the current user's Essence rows. `sort` selects the
/// `ORDER BY`; the default (when the client omits the param) is `last_edited`
/// — newest `updated_at` first.
///
/// Accepted `sort` values: `last_edited`, `word_count`, `title`.
///
/// When `kind` is present and non-`all`, the SQL query filters by that kind
/// directly (no in-memory scan). Per-kind totals are authoritative via the
/// `UserEssenceStats` counter, so the client can render "Page N of M".
///
/// `bookmark` carries the 1-based page number to fetch (opaque string to the
/// client — it just echoes back the value the previous response returned).
/// Absent/invalid → page 1. `limit` defaults to 10, capped at 50.
#[get("/api/essences?sort&bookmark&kind&limit", user: User)]
pub async fn list_essences_handler(
    sort: Option<String>,
    bookmark: Option<String>,
    kind: Option<String>,
    limit: Option<u32>,
) -> Result<ListResponse<EssenceResponse>> {
    let sort = parse_sort(sort.as_deref());
    let kind_filter = parse_kind(kind.as_deref());
    let page_size = limit.unwrap_or(10).clamp(1, 50) as i64;
    let page = bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);

    let result = Essence::list_for_user(&user.pk(), sort, kind_filter, page, page_size).await?;
    let has_next = result.page < result.total_pages;
    let items: Vec<EssenceResponse> = result
        .items
        .into_iter()
        .map(EssenceResponse::from)
        .collect();
    let next = if has_next {
        Some((page + 1).to_string())
    } else {
        None
    };
    Ok((items, next).into())
}

#[cfg(feature = "server")]
fn parse_sort(raw: Option<&str>) -> EssenceSort {
    match raw {
        Some("word_count") => EssenceSort::WordCountDesc,
        Some("title") => EssenceSort::TitleAsc,
        // Empty string, unknown value, or missing param → default.
        _ => EssenceSort::LastEditedDesc,
    }
}

#[cfg(feature = "server")]
fn parse_kind(raw: Option<&str>) -> KindFilter {
    match raw {
        Some("notion") => KindFilter::Notion,
        Some("post") => KindFilter::Post,
        Some("comment") => KindFilter::Comment,
        Some("poll") => KindFilter::Poll,
        Some("quiz") => KindFilter::Quiz,
        // `all`, empty, unknown, or missing → no filter.
        _ => KindFilter::All,
    }
}
