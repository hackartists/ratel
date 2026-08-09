//! Postgres column codecs for the shared space enums.
//!
//! `SpaceStatus`, `SpaceVisibility`, and `SpacePublishState` live in the shared
//! `common::types::space` module (which this migration must not edit), so they
//! cannot carry a `#[derive(PostgresEnum)]`. Each is stored in a `TEXT` column
//! using its existing serde **string** form — identical to the string DynamoDB
//! persisted — and the sqlx `Encode`/`Decode` codecs round-trip through serde.
//!
//! This mirrors the `UserType` column-codec pattern in
//! `common/models/auth/user.rs`. Keeping the model fields typed preserves the
//! `SpaceCommon::is_active()` / `is_public()` API and every caller that reads
//! `space.status` / `.visibility` / `.publish_state` as the enum type.
#![cfg(feature = "server")]

use crate::common::types::{SpacePublishState, SpaceStatus, SpaceVisibility};

/// Serde string form of an enum whose serde representation is a plain string
/// (matches the value DynamoDB stored).
fn enum_to_string<T: serde::Serialize>(v: &T) -> String {
    serde_json::to_value(v)
        .ok()
        .and_then(|x| x.as_str().map(str::to_string))
        .unwrap_or_default()
}

/// Recover such an enum from its stored serde string form.
fn enum_from_string<T: serde::de::DeserializeOwned>(s: &str) -> Option<T> {
    serde_json::from_value(serde_json::Value::String(s.to_string())).ok()
}

macro_rules! text_enum_codec {
    ($ty:ty) => {
        impl postgres::PostgresType for $ty {
            type Op = postgres::ops::StringOp;
            fn sql_type() -> postgres::SqlType {
                postgres::SqlType::Text
            }
        }

        impl From<$ty> for postgres::Value {
            fn from(v: $ty) -> Self {
                postgres::Value::Text(enum_to_string(&v))
            }
        }

        impl postgres::sqlx::Type<postgres::sqlx::Postgres> for $ty {
            fn type_info() -> postgres::sqlx::postgres::PgTypeInfo {
                <String as postgres::sqlx::Type<postgres::sqlx::Postgres>>::type_info()
            }
            fn compatible(ty: &postgres::sqlx::postgres::PgTypeInfo) -> bool {
                <String as postgres::sqlx::Type<postgres::sqlx::Postgres>>::compatible(ty)
            }
        }

        impl<'q> postgres::sqlx::Encode<'q, postgres::sqlx::Postgres> for $ty {
            fn encode_by_ref(
                &self,
                buf: &mut postgres::sqlx::postgres::PgArgumentBuffer,
            ) -> std::result::Result<
                postgres::sqlx::encode::IsNull,
                postgres::sqlx::error::BoxDynError,
            > {
                let s = enum_to_string(self);
                <String as postgres::sqlx::Encode<'q, postgres::sqlx::Postgres>>::encode(s, buf)
            }
        }

        impl<'r> postgres::sqlx::Decode<'r, postgres::sqlx::Postgres> for $ty {
            fn decode(
                value: postgres::sqlx::postgres::PgValueRef<'r>,
            ) -> std::result::Result<Self, postgres::sqlx::error::BoxDynError> {
                let raw =
                    <String as postgres::sqlx::Decode<'r, postgres::sqlx::Postgres>>::decode(value)?;
                enum_from_string(&raw)
                    .ok_or_else(|| format!("invalid {} value: {raw}", stringify!($ty)).into())
            }
        }
    };
}

text_enum_codec!(SpaceStatus);
text_enum_codec!(SpaceVisibility);
text_enum_codec!(SpacePublishState);
