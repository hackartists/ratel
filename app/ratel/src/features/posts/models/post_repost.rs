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
// Serialize through `PostRepostWire` so the shipped mobile build still finds
// the legacy `pk`/`sk` keys. See `PostRepostWire`.
#[serde(into = "PostRepostWire")]
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

/// Wire form of [`PostRepost`] — identical plus the legacy `pk`/`sk` keys.
///
/// Same reason as `UserWire`. The DynamoDB identity was
/// `(owner feed, PostRepost)`; `owner_pk` still holds that partition string.
#[derive(Serialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/", rename = "PostRepost"))]
pub struct PostRepostWire {
    /// The reposting owner's feed partition, parsed from `owner_pk`.
    pub pk: Partition,
    /// Always `EntityType::PostRepost`.
    pub sk: EntityType,

    pub id: Uuid,
    pub owner_pk: String,
    pub post_pk: String,
    pub post_title: String,
    pub post_body: BodyJson,
    pub author_pk: String,
    pub author_display_name: String,
    pub author_profile_url: String,
}

impl From<PostRepost> for PostRepostWire {
    fn from(v: PostRepost) -> Self {
        Self {
            pk: v.owner_pk.parse().unwrap_or_default(),
            sk: EntityType::PostRepost,

            id: v.id,
            owner_pk: v.owner_pk,
            post_pk: v.post_pk,
            post_title: v.post_title,
            post_body: v.post_body,
            author_pk: v.author_pk,
            author_display_name: v.author_display_name,
            author_profile_url: v.author_profile_url,
        }
    }
}

#[cfg(test)]
mod shipped_client_compat_tests {
    use super::*;

    /// The identity fields the shipped mobile build declares on `PostRepost`,
    /// copied from commit 38ac1fcd8. Neither carries `#[serde(default)]`.
    #[derive(Debug, serde::Deserialize)]
    #[allow(dead_code)]
    struct ShippedKeys {
        pk: Partition,
        sk: EntityType,
    }

    #[test]
    fn shipped_build_can_parse_current_row() {
        let v = PostRepost { owner_pk: "FEED#f1".into(), ..Default::default() };
        let json = serde_json::to_value(&v).expect("serialize");
        assert_eq!(json["pk"], serde_json::json!("FEED#f1"));
        assert_eq!(json["sk"], serde_json::json!("POST_REPOST"));
        serde_json::from_value::<ShippedKeys>(json).expect("shipped build must parse this");
    }

    #[test]
    fn shipped_build_breaks_without_legacy_keys() {
        let mut json = serde_json::to_value(PostRepost { owner_pk: "FEED#f1".into(), ..Default::default() }).expect("serialize");
        json.as_object_mut().unwrap().remove("pk");
        let err = serde_json::from_value::<ShippedKeys>(json).expect_err("must fail");
        assert!(err.to_string().contains("missing field `pk`"), "got: {err}");
    }
}

// TypeScript binding (`make gen-ts` only). `PostRepost` serializes through
// `PostRepostWire`, which is exported under this name; delegate every method so
// references, declarations and the output file all come from the wire struct.
#[cfg(feature = "ts-bridge")]
impl ts_rs::TS for PostRepost {
    type WithoutGenerics = Self;

    fn ident() -> String {
        <PostRepostWire as ts_rs::TS>::ident()
    }
    fn decl() -> String {
        <PostRepostWire as ts_rs::TS>::decl()
    }
    fn decl_concrete() -> String {
        <PostRepostWire as ts_rs::TS>::decl_concrete()
    }
    fn name() -> String {
        <PostRepostWire as ts_rs::TS>::name()
    }
    fn inline() -> String {
        <PostRepostWire as ts_rs::TS>::inline()
    }
    fn inline_flattened() -> String {
        <PostRepostWire as ts_rs::TS>::inline_flattened()
    }
    fn visit_dependencies(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <PostRepostWire as ts_rs::TS>::visit_dependencies(v)
    }
    fn visit_generics(v: &mut impl ts_rs::TypeVisitor)
    where
        Self: 'static,
    {
        <PostRepostWire as ts_rs::TS>::visit_generics(v)
    }
    fn output_path() -> Option<&'static std::path::Path> {
        <PostRepostWire as ts_rs::TS>::output_path()
    }
}
