use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[cfg(feature = "server")]
use postgres::PostgresEntity;
#[cfg(feature = "server")]
use uuid::Uuid;

/// NFT-style artwork trait metadata attached to a post.
///
/// Postgres migration: the DynamoDB identity `(pk = feed post, sk = PostArtwork)`
/// collapses to a surrogate `id` PK plus the natural key `unique(post_id)` (one
/// artwork row per post). The embedded `metadata` list is stored as a JSONB
/// column via `ArtworkMetadataVec`.
#[cfg(feature = "server")]
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, PostgresEntity)]
#[postgres(table = "post_artworks", unique(post_id))]
pub struct PostArtwork {
    pub id: Uuid,

    #[postgres(index)]
    pub post_id: Uuid,

    pub metadata: ArtworkMetadataVec,
}

/// `Vec<PostArtworkMetadata>` stored as a bare JSONB array (serde-transparent).
#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
#[serde(transparent)]
pub struct ArtworkMetadataVec(pub Vec<PostArtworkMetadata>);

#[cfg(feature = "server")]
impl PostArtwork {
    pub fn new(post_id: Uuid, metadata: Vec<PostArtworkMetadata>) -> Self {
        Self {
            id: Uuid::now_v7(),
            post_id,
            metadata: ArtworkMetadataVec(metadata),
        }
    }

    /// The artwork row for a post, if any.
    pub async fn find_by_post(post_id: Uuid) -> Result<Option<Self>> {
        use postgres::ops::UuidOp;
        Self::repository()
            .find_one(Self::query().post_id(UuidOp::Eq(post_id)))
            .await
            .map_err(crate::common::Error::from)
    }

    /// Natural-key upsert on `post_id` (preserves surrogate `id`).
    pub async fn save(&self) -> Result<()> {
        Self::repository()
            .upsert_on(&["post_id"], self)
            .await
            .map_err(crate::common::Error::from)?;
        Ok(())
    }
}

/// Cross-platform value type embedded in `PostDetailResponse` — stays a plain
/// wire struct (no Postgres codec; it rides inside the JSONB column via
/// `ArtworkMetadataVec`).
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
pub struct PostArtworkMetadata {
    pub trait_type: String,
    pub value: String,
    pub display_type: Option<String>,
}
