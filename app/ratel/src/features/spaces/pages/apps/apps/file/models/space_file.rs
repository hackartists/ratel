use crate::features::spaces::pages::apps::apps::file::*;
use postgres::{PostgresEntity, PostgresJson};
use uuid::Uuid;

/// The space's file list stored as one opaque jsonb array. serde treats a
/// single-field tuple newtype transparently, so the column holds the bare
/// JSON array of `File`s (wire format unchanged from the DynamoDB row).
#[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq, PostgresJson)]
pub struct SpaceFileList(pub Vec<File>);

impl std::ops::Deref for SpaceFileList {
    type Target = Vec<File>;
    fn deref(&self) -> &Vec<File> {
        &self.0
    }
}

impl std::ops::DerefMut for SpaceFileList {
    fn deref_mut(&mut self) -> &mut Vec<File> {
        &mut self.0
    }
}

/// One file-list row per space. Postgres migration: surrogate `id` PK;
/// the DynamoDB `(Space(space_id), SpaceFile)` singleton identity becomes
/// the `unique(space_pk)` natural key. `space_pk` is the full `Partition`
/// string (cross-feature reference to the space); no FK.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, PostgresEntity)]
#[postgres(table = "space_files")]
pub struct SpaceFile {
    pub id: Uuid,

    #[postgres(unique)]
    pub space_pk: String,

    pub files: SpaceFileList,
}

impl SpaceFile {
    pub fn new(space_pk: Partition, files: Vec<File>) -> Self {
        Self {
            id: Uuid::now_v7(),
            space_pk: space_pk.to_string(),
            files: SpaceFileList(files),
        }
    }

    /// The single file-list row for a space, if any.
    pub async fn get_by_space(space_pk: &Partition) -> crate::common::Result<Option<Self>> {
        use postgres::ops::StringOp;
        Ok(Self::repository()
            .find_one(Self::query().space_pk(StringOp::Eq(space_pk.to_string())))
            .await?)
    }

    /// Natural-key upsert on `space_pk` (preserves the surrogate `id`).
    pub async fn save(&self) -> crate::common::Result<Self> {
        Ok(Self::repository().upsert_on(&["space_pk"], self).await?)
    }
}
