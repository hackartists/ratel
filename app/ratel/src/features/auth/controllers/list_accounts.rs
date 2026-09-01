// Migrated from packages/main-api/src/controllers/v3/auth/list_accounts.rs
use crate::features::auth::models::*;
use crate::features::auth::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use std::collections::HashSet;

#[derive(Debug, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct ListAccountsQueryParams {
    pub device_id: String,
    pub bookmark: Option<String>,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct AccountItem {
    pub user_pk: Partition,
    pub display_name: String,
    pub profile_url: String,
    pub username: String,
    pub user_type: UserType,
    pub last_login_at: i64,
    pub revoked: bool,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct ListAccountsResponse {
    pub items: Vec<AccountItem>,
    pub bookmark: Option<String>,
}

#[get("/api/auth/accounts")]
pub async fn list_accounts_handler(params: ListAccountsQueryParams) -> Result<ListAccountsResponse> {
    // Bookmark is now a 1-based page index (Postgres has no opaque cursor);
    // preserved as an `Option<String>` on the wire for client compatibility.
    let page = params
        .bookmark
        .as_deref()
        .and_then(|b| b.parse::<i64>().ok())
        .unwrap_or(1)
        .max(1);
    let page_size = 10;

    let result = UserRefreshToken::find_by_device_id(&params.device_id, page, page_size).await?;
    let next_bookmark = if page < result.total_pages {
        Some((page + 1).to_string())
    } else {
        None
    };

    if result.items.is_empty() {
        return Ok(ListAccountsResponse {
            items: vec![],
            bookmark: next_bookmark,
        });
    }

    let now_ts = crate::common::utils::time::now();
    let mut seen = HashSet::<String>::new();
    let mut accounts = Vec::<AccountItem>::new();

    for rt in result.items.into_iter() {
        if rt.revoked {
            continue;
        }
        if let Some(exp) = rt.expired_at {
            if exp < now_ts {
                continue;
            }
        }

        if !seen.insert(rt.user_pk.clone()) {
            continue;
        }

        let user_pk: Partition = match rt.user_pk.parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        accounts.push(AccountItem {
            user_pk,
            display_name: rt.user_display_name,
            profile_url: rt.user_profile_url,
            username: rt.user_username,
            user_type: rt.user_type.0,
            last_login_at: rt.created_at,
            revoked: rt.revoked,
        });
    }

    Ok(ListAccountsResponse {
        items: accounts,
        bookmark: next_bookmark,
    })
}
