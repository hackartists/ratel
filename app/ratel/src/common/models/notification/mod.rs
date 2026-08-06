mod inbox_dedup_marker;
mod notification;
mod user_device_token;
mod user_inbox_notification;

pub use inbox_dedup_marker::*;
pub use notification::*;
pub use user_device_token::*;
pub use user_inbox_notification::*;

// ─────────────────────────────────────────────────────────────────────────────
// jsonb column support for notification-domain types that live in
// `common/types` (which this migration must not edit).
//
// `EventStatus`, `NotificationData`, `InboxKind`, and `InboxPayload` are fields
// on the Postgres entities below, so each needs a `postgres::PostgresType` impl
// (plus the sqlx `Type`/`Encode`/`Decode` + `Into<Value>` a column requires).
// The `#[derive(PostgresJson)]` macro can only be attached at a type's
// definition site; because these types are defined in `common/types` we instead
// hand-write the *same* impls here — legal under Rust's orphan rules (foreign
// trait, local type) and fully self-contained to this module. The generated
// code is byte-for-byte what `PostgresJson` emits for an enum (stored as jsonb
// with serde's default externally-tagged representation), so on-wire/on-disk
// shape matches a native `PostgresJson` type.
//
// NOTE: each of these types may only carry ONE such impl crate-wide. If a later
// wave needs the same type as a Postgres column elsewhere, reuse these impls —
// do not re-derive `PostgresJson` on the type (would be a duplicate impl).
// ─────────────────────────────────────────────────────────────────────────────
#[cfg(feature = "server")]
macro_rules! jsonb_column {
    ($ty:ty, $base_name:literal) => {
        #[automatically_derived]
        impl ::postgres::PostgresObject for $ty {
            fn kind() -> ::postgres::ObjectKind {
                ::postgres::ObjectKind::Json
            }
            fn base_name() -> &'static str {
                $base_name
            }
            fn ddl() -> ::postgres::Ddl {
                ::postgres::Ddl::default()
            }
        }

        #[automatically_derived]
        impl ::postgres::PostgresType for $ty {
            type Op = ::postgres::ops::JsonOp<$ty>;
            fn sql_type() -> ::postgres::SqlType {
                ::postgres::SqlType::JsonB
            }
        }

        #[automatically_derived]
        impl ::std::convert::From<$ty> for ::postgres::Value {
            fn from(v: $ty) -> Self {
                ::postgres::Value::Json(
                    ::postgres::serde_json::to_value(&v).expect("jsonb_column serialize"),
                )
            }
        }

        #[automatically_derived]
        impl ::postgres::sqlx::Type<::postgres::sqlx::Postgres> for $ty {
            fn type_info() -> ::postgres::sqlx::postgres::PgTypeInfo {
                <::postgres::sqlx::types::Json<$ty> as ::postgres::sqlx::Type<
                    ::postgres::sqlx::Postgres,
                >>::type_info()
            }
            fn compatible(ty: &::postgres::sqlx::postgres::PgTypeInfo) -> bool {
                <::postgres::sqlx::types::Json<$ty> as ::postgres::sqlx::Type<
                    ::postgres::sqlx::Postgres,
                >>::compatible(ty)
            }
        }

        #[automatically_derived]
        impl<'__q> ::postgres::sqlx::Encode<'__q, ::postgres::sqlx::Postgres> for $ty {
            fn encode(
                self,
                buf: &mut ::postgres::sqlx::postgres::PgArgumentBuffer,
            ) -> ::std::result::Result<
                ::postgres::sqlx::encode::IsNull,
                ::postgres::sqlx::error::BoxDynError,
            >
            where
                Self: ::std::marker::Sized,
            {
                <::postgres::sqlx::types::Json<$ty> as ::postgres::sqlx::Encode<
                    '__q,
                    ::postgres::sqlx::Postgres,
                >>::encode(::postgres::sqlx::types::Json(self), buf)
            }

            fn encode_by_ref(
                &self,
                buf: &mut ::postgres::sqlx::postgres::PgArgumentBuffer,
            ) -> ::std::result::Result<
                ::postgres::sqlx::encode::IsNull,
                ::postgres::sqlx::error::BoxDynError,
            > {
                <::postgres::sqlx::types::Json<$ty> as ::postgres::sqlx::Encode<
                    '__q,
                    ::postgres::sqlx::Postgres,
                >>::encode_by_ref(&::postgres::sqlx::types::Json(self.clone()), buf)
            }
        }

        #[automatically_derived]
        impl<'__r> ::postgres::sqlx::Decode<'__r, ::postgres::sqlx::Postgres> for $ty {
            fn decode(
                value: ::postgres::sqlx::postgres::PgValueRef<'__r>,
            ) -> ::std::result::Result<Self, ::postgres::sqlx::error::BoxDynError> {
                ::std::result::Result::Ok(
                    <::postgres::sqlx::types::Json<$ty> as ::postgres::sqlx::Decode<
                        '__r,
                        ::postgres::sqlx::Postgres,
                    >>::decode(value)?
                    .0,
                )
            }
        }
    };
}

#[cfg(feature = "server")]
jsonb_column!(crate::common::types::EventStatus, "event_status");
#[cfg(feature = "server")]
jsonb_column!(crate::common::types::NotificationData, "notification_data");
#[cfg(feature = "server")]
jsonb_column!(crate::common::types::InboxKind, "inbox_kind");
#[cfg(feature = "server")]
jsonb_column!(crate::common::types::InboxPayload, "inbox_payload");
