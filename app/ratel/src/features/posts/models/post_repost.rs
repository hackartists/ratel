use super::pg_json::BodyJson;
use crate::features::auth::User;
use crate::features::posts::types::*;
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

use uuid::Uuid;

#[cfg(feature = "server")]
use postgres::PostgresEntity;

use super::Post;

/// A repost of a post onto another feed.
///
/// Postgres migration: the DynamoDB identity `(pk = owner feed, sk = PostRepost)`
/// collapses to a surrogate `id` PK plus the natural key `unique(owner_pk)`
/// (one repost row per owner feed). `owner_pk` / `post_pk` / `author_pk` hold
/// the full `Partition` string form (wire-identical to the old `Partition`
/// fields). Stays cross-platform (embedded in `PostDetailResponse`); only the
/// `PostgresEntity` derive + model `impl` are server-gated.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "server", derive(postgres::PostgresEntity))]
#[cfg_attr(feature = "server", postgres(table = "post_reposts", unique(owner_pk)))]
pub struct PostRepost {
    pub id: Uuid,

    /// Feed partition string this repost is filed under (`"FEED#..."`).
    #[cfg_attr(feature = "server", postgres(index))]
    pub owner_pk: String,

    /// The reposted post's feed partition string (`"FEED#..."`).
    #[cfg_attr(feature = "server", postgres(index))]
    pub post_pk: String,
    pub post_title: String,
    #[serde(alias = "post_html_contents")]
    pub post_body: BodyJson,

    #[cfg_attr(feature = "server", postgres(index))]
    pub author_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
}

#[cfg(feature = "server")]
impl PostRepost {
    pub fn new(
        owner_pk: Partition,
        Post {
            id: post_id,
            title: post_title,
            body: post_body,
            ..
        }: Post,
        user: User,
    ) -> Self {
        let author_pk = user.pk();
        let User {
            display_name: author_display_name,
            profile_url: author_profile_url,
            ..
        } = user;

        Self {
            id: Uuid::now_v7(),
            owner_pk: owner_pk.to_string(),
            post_pk: Partition::Feed(post_id.to_string()).to_string(),
            post_title,
            post_body,
            author_pk: author_pk.to_string(),
            author_display_name,
            author_profile_url,
        }
    }

    /// The repost row filed under `owner_pk` (`"FEED#..."` string), if any.
    pub async fn find_by_owner(owner_pk: &str) -> Result<Option<Self>> {
        use postgres::ops::StringOp;
        Self::repository()
            .find_one(Self::query().owner_pk(StringOp::Eq(owner_pk.to_string())))
            .await
            .map_err(crate::common::Error::from)
    }
}
