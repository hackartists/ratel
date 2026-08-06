use super::*;
use crate::features::auth::User;
use crate::features::membership::models::TeamPurchase;
use crate::features::membership::*;
use crate::features::posts::models::Team;
use crate::features::social::pages::member::dto::TeamRole;
use crate::social::pages::membership::user::controllers::PurchaseHistoryItem;

#[get("/v3/teams/:username/memberships/history?bookmark", user: User, team: Team, role: TeamRole)]
pub async fn get_team_purchase_history_handler(
    username: String,
    bookmark: Option<String>,
) -> Result<ListResponse<PurchaseHistoryItem>> {
    if !role.is_admin_or_owner() {
        return Err(Error::NotFound("Permission denied".to_string()));
    }

    // Bookmark is a 1-based page number (Postgres offset pagination replaces the
    // DynamoDB opaque last-evaluated-key bookmark).
    let page_no: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let page_size: i64 = 20;

    let team_pk = team.partition().to_string();
    let page = TeamPurchase::find_by_team_page(&team_pk, page_no, page_size).await?;

    let next_bookmark = if page_no < page.total_pages {
        Some((page_no + 1).to_string())
    } else {
        None
    };

    let items: Vec<PurchaseHistoryItem> = page.items.into_iter().map(Into::into).collect();

    Ok(ListResponse {
        items,
        bookmark: next_bookmark,
    })
}
