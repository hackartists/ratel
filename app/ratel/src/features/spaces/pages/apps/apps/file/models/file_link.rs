use crate::features::spaces::pages::apps::apps::file::types::FileLinkTarget;
use crate::features::spaces::pages::apps::apps::file::*;
use postgres::PostgresEntity;
use uuid::Uuid;

/// One link row per (space, file_url, link_target). Postgres migration:
/// surrogate `id` PK; the DynamoDB `(Space(space_id), FileLink(uuid))`
/// identity is preserved via a fresh surrogate id per link. `space_pk` is
/// a cross-feature reference to the space (full `Partition` string). The
/// former gsi1 `file_url` lookup key stays an indexed column.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "file_links")]
pub struct FileLink {
    pub id: Uuid,

    #[postgres(index)]
    pub space_pk: String,

    #[postgres(index)]
    pub file_url: String,

    pub link_target: FileLinkTarget,

    #[postgres(order)]
    pub created_at: i64,
    pub updated_at: i64,
}

impl FileLink {
    pub fn new(
        space_pk: Partition,
        file_url: String,
        link_target: FileLinkTarget,
        now: i64,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            file_url,
            link_target,
            created_at: now,
            updated_at: now,
        }
    }

    /// Every link row for a space, oldest first.
    pub async fn list_by_space(space_pk: &Partition) -> crate::common::Result<Vec<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find(
                Self::query()
                    .space_pk(StringOp::Eq(space_pk.to_string()))
                    .order_by(FileLinkColumn::CreatedAt, postgres::Order::Asc),
            )
            .await?
            .items)
    }
}
