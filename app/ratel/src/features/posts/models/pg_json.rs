//! Postgres migration — JSONB column newtypes.
//!
//! The Postgres ORM maps each `PostgresEntity` field to a column whose Rust
//! type must implement `PostgresType`. Primitive scalars (`String`, `i64`,
//! `bool`, `Uuid`) and in-path enums that derive `PostgresJson`
//! (`PostType`, `PostStatus`, `Visibility`, `SpaceType`, `BoosterType`) satisfy
//! that directly. Composite fields (`Vec<String>`, `Vec<File>`, `ContentBody`,
//! and enums owned by other features) do not, so they are stored as JSONB via
//! these single-field newtype wrappers.
//!
//! Every wrapper is `#[serde(transparent)]`, so the JSON wire representation is
//! **identical** to the bare inner value — the models embedding these wrappers
//! serialize over the fullstack boundary exactly as they did before. Only the
//! Rust field type (and hence `.0` access) changes.
//!
//! The `PostgresJson` derive is server-gated: `postgres` is a server-only
//! optional dependency, and the web half must not reference it.

use crate::common::types::{ContentBody, File, SpaceVisibility, UserType};
use crate::features::posts::*;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

macro_rules! json_newtype {
    ($(#[$m:meta])* $name:ident, $inner:ty) => {
        $(#[$m])*
        #[derive(Debug, Default, Clone, Serialize, Deserialize, PartialEq)]
        #[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
        #[cfg_attr(feature = "server", derive(postgres::PostgresJson))]
        #[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
        #[serde(transparent)]
        pub struct $name(pub $inner);

        impl From<$inner> for $name {
            fn from(v: $inner) -> Self {
                Self(v)
            }
        }
        impl From<$name> for $inner {
            fn from(v: $name) -> Self {
                v.0
            }
        }
    };
}

json_newtype!(
    /// `Vec<String>` stored as a bare JSONB array. Used for `urls`,
    /// `categories`, and comment `images`.
    StringVec,
    Vec<String>
);

json_newtype!(
    /// `Vec<File>` (attachments) stored as a JSONB array.
    FileVec,
    Vec<File>
);

json_newtype!(
    /// Rich-text `ContentBody` stored as JSONB.
    BodyJson,
    ContentBody
);

impl BodyJson {
    /// Delegates to the inner `ContentBody`'s plain-text rendering.
    pub fn to_plain_text(&self) -> String {
        self.0.to_plain_text()
    }

    /// Delegates to the inner `ContentBody`'s HTML rendering.
    pub fn to_html(&self) -> String {
        self.0.to_html()
    }
}

json_newtype!(
    /// Cross-feature `UserType` (auth) stored as JSONB.
    AuthorTypeJson,
    UserType
);

json_newtype!(
    /// Cross-feature `SpaceVisibility` (common) stored as JSONB.
    SpaceVisibilityJson,
    SpaceVisibility
);
