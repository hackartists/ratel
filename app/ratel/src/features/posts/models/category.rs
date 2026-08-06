use crate::types::*;
use crate::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// Post category tag.
///
/// Postgres migration: the DynamoDB single-table identity
/// `(pk = Category, sk = Category(name))` collapses to a surrogate `id` PK plus
/// the natural key `unique(name)`. The old `find_all` GSI scan becomes an
/// ordered `Category::query()` on the `name` index.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "post_categories", unique(name))]
pub struct Category {
    pub id: Uuid,

    #[postgres(index)]
    pub name: String,
    #[postgres(order)]
    pub created_at: i64,
}

#[cfg(feature = "server")]
impl Category {
    pub fn new(name: String) -> Self {
        let created_at = chrono::Utc::now().timestamp_millis();
        Self {
            id: Uuid::now_v7(),
            name,
            created_at,
        }
    }

    /// Idempotent get-or-create by natural key `name`. The DynamoDB
    /// conditional-create + on-conflict-get is replaced by a natural-key
    /// upsert on `name`, which preserves the existing `id`/`created_at` when
    /// the row already exists.
    pub async fn get_or_create_by_name(name: String) -> Result<Self> {
        use postgres::ops::StringOp;

        if let Some(existing) = Self::repository()
            .find_one(Self::query().name(StringOp::Eq(name.clone())))
            .await
            .map_err(crate::common::Error::from)?
        {
            return Ok(existing);
        }

        let category = Self::new(name);
        Self::repository()
            .upsert_on(&["name"], &category)
            .await
            .map_err(crate::common::Error::from)
    }

    /// All categories, newest-first (mirrors the old `find_all` scan). `page`
    /// is 1-based.
    pub async fn list(page: i64, page_size: i64) -> Result<postgres::Page<Self>> {
        Self::repository()
            .find(
                Self::query()
                    .order_by(CategoryColumn::CreatedAt, postgres::Order::Desc)
                    .page(page)
                    .page_size(page_size),
            )
            .await
            .map_err(crate::common::Error::from)
    }

    /// Delete a category by its natural key `name`.
    pub async fn delete_by_name(name: String) -> Result<()> {
        use postgres::ops::StringOp;
        let Some(existing) = Self::repository()
            .find_one(Self::query().name(StringOp::Eq(name)))
            .await
            .map_err(crate::common::Error::from)?
        else {
            return Ok(());
        };
        Self::repository()
            .delete(existing.id)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}
