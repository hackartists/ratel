use crate::common::models::space::{PARTICIPANT_KIND, SpaceParticipant};
#[cfg(feature = "server")]
use crate::common::models::space::SpaceParticipantColumn;
use crate::common::*;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct SpaceMemberResponse {
    pub user_id: UserPartition,
    pub display_name: String,
    pub username: String,
    pub profile_url: String,
}

#[cfg(feature = "server")]
impl From<SpaceParticipant> for SpaceMemberResponse {
    fn from(p: SpaceParticipant) -> Self {
        Self {
            user_id: p.user_pk.into(),
            display_name: p.display_name,
            username: p.username,
            profile_url: p.profile_url,
        }
    }
}

// Search tuning knobs. The GSI3 fast path is essentially free (DynamoDB
// handles `begins_with` natively on the sort key), so we only fall back to
// a page scan when that didn't already saturate the response. The scan
// caps bound the worst case for display_name prefix matching on huge
// spaces or non-ASCII queries that can't benefit from the GSI.
#[cfg(feature = "server")]
const SEARCH_PAGE_LIMIT: i32 = 50;
#[cfg(feature = "server")]
const SEARCH_MAX_PAGES: usize = 10;
#[cfg(feature = "server")]
const SEARCH_MAX_RESULTS: usize = 20;

#[get("/api/spaces/{space_id}/members?bookmark&query", role: SpaceUserRole)]
pub async fn list_space_members(
    space_id: SpacePartition,
    bookmark: Option<String>,
    query: Option<String>,
) -> Result<ListResponse<SpaceMemberResponse>> {
    use postgres::Order;
    use postgres::PostgresEntity;
    use postgres::ops::StringOp;

    let space_pk: Partition = space_id.into();

    let normalized_query = query
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_lowercase);

    match normalized_query {
        None => {
            // `bookmark` carries the 1-based page number (opaque to the client).
            let page = bookmark
                .as_deref()
                .and_then(|b| b.parse::<i64>().ok())
                .filter(|p| *p >= 1)
                .unwrap_or(1);
            let page_size = 50i64;

            let result = SpaceParticipant::repository()
                .find(
                    SpaceParticipant::query()
                        .space_pk(StringOp::Eq(space_pk.to_string()))
                        .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()))
                        .order_by(SpaceParticipantColumn::CreatedAt, Order::Desc)
                        .page(page)
                        .page_size(page_size),
                )
                .await
                .map_err(crate::common::Error::from)?;

            let next_bookmark = if page < result.total_pages {
                Some((page + 1).to_string())
            } else {
                None
            };

            let members = result
                .items
                .into_iter()
                .map(SpaceMemberResponse::from)
                .collect();

            Ok(ListResponse {
                items: members,
                bookmark: next_bookmark,
            })
        }
        Some(q) => {
            let mut matches: Vec<SpaceMemberResponse> = Vec::new();
            let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();

            // Fast path: username-prefix match via the indexed `username`
            // column — replaces the DynamoDB GSI3 `begins_with(username, q)`
            // query.
            let gsi_matches = SpaceParticipant::search_users_by_space(&space_pk, &q).await?;
            for p in gsi_matches {
                let pk_str = p.user_pk.clone();
                if seen.insert(pk_str) {
                    matches.push(SpaceMemberResponse::from(p));
                    if matches.len() >= SEARCH_MAX_RESULTS {
                        break;
                    }
                }
            }

            // Fallback: page-scan by space for display_name prefix matches.
            // Covers cases where the visible display name diverges from the
            // underlying username — notably non-ASCII names whose username
            // is transliterated. Bounded by SEARCH_MAX_PAGES to keep the
            // worst case predictable.
            if matches.len() < SEARCH_MAX_RESULTS {
                let mut page = 1i64;
                let mut pages = 0;
                loop {
                    if pages >= SEARCH_MAX_PAGES || matches.len() >= SEARCH_MAX_RESULTS {
                        break;
                    }
                    let result = SpaceParticipant::repository()
                        .find(
                            SpaceParticipant::query()
                                .space_pk(StringOp::Eq(space_pk.to_string()))
                                .kind(StringOp::Eq(PARTICIPANT_KIND.to_string()))
                                .order_by(SpaceParticipantColumn::CreatedAt, Order::Desc)
                                .page(page)
                                .page_size(SEARCH_PAGE_LIMIT as i64),
                        )
                        .await
                        .map_err(crate::common::Error::from)?;

                    for p in &result.items {
                        let pk_str = p.user_pk.clone();
                        if seen.contains(&pk_str) {
                            continue;
                        }
                        if p.display_name.to_lowercase().starts_with(&q) {
                            seen.insert(pk_str);
                            matches.push(SpaceMemberResponse::from(p.clone()));
                            if matches.len() >= SEARCH_MAX_RESULTS {
                                break;
                            }
                        }
                    }

                    pages += 1;
                    if page >= result.total_pages {
                        break;
                    }
                    page += 1;
                }
            }

            Ok(ListResponse {
                items: matches,
                bookmark: None,
            })
        }
    }
}
