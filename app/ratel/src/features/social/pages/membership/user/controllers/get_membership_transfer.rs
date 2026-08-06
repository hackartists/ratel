use super::super::*;
#[cfg(feature = "server")]
use super::super::models::UserPurchaseLocal;
#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PurchaseHistoryItem {
    pub tx_type: String,
    pub amount: i64,
    pub payment_id: String,
    pub tx_id: String,
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl From<UserPurchaseLocal> for PurchaseHistoryItem {
    fn from(purchase: UserPurchaseLocal) -> Self {
        Self {
            tx_type: purchase.tx_type,
            amount: purchase.amount,
            payment_id: purchase.payment_id,
            tx_id: purchase.tx_id,
            created_at: purchase.created_at,
        }
    }
}

#[get("/api/me/membership/history?bookmark", user: crate::features::auth::User)]
pub async fn get_purchase_history_handler(
    bookmark: Option<String>,
) -> Result<ListResponse<PurchaseHistoryItem>> {
    use super::super::models::UserPurchaseLocalColumn;
    use postgres::ops::StringOp;

    // Bookmark is a 1-based page number (Postgres offset pagination replaces
    // the DynamoDB opaque last-evaluated-key bookmark).
    let page_no: i64 = bookmark
        .as_deref()
        .and_then(|b| b.parse().ok())
        .filter(|p| *p >= 1)
        .unwrap_or(1);
    let page_size: i64 = 20;

    let user_pk = user.pk().to_string();

    let page: postgres::Page<UserPurchaseLocal> = UserPurchaseLocal::repository()
        .find(
            UserPurchaseLocal::query()
                .user_pk(StringOp::Eq(user_pk))
                .order_by(UserPurchaseLocalColumn::CreatedAt, postgres::Order::Desc)
                .page(page_no)
                .page_size(page_size),
        )
        .await
        .map_err(crate::common::Error::from)?;

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
