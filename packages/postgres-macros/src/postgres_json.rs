//! `#[derive(PostgresJson)]` — named-field struct · 단일 필드 tuple newtype · enum →
//! JSONB 컬럼(스키마리스 로지컬 타입).
//!
//! 생성 impl: `PostgresObject`(kind=Json, ddl=default) · `PostgresType`(Op=JsonOp<Self>,
//! sql_type=JsonB) · `From<Self> for Value` · sqlx `Type`/`Encode`/`Decode` — 전부
//! `sqlx::types::Json<Self>` 위임이라 대상 타입만 이미 있는 규칙을 지키면 된다:
//! `Serialize + DeserializeOwned + Clone`(sqlx Json 위임 + `From<Self> for Value`,
//! `Encode::encode_by_ref` 가 요구). v1 은 attribute 를 받지 않는다 —
//! `base_name` 은 항상 ident 의 snake_case.
//!
//! 생성 코드는 전부 `self`/`&self` 전체를 직렬화하는 타입 제네릭 코드라 필드 이름이나
//! variant 를 참조하지 않는다 — 그래서 단일 필드 tuple struct(`struct Foo(Inner);`)도,
//! **enum 도** named-field struct 와 동일한 codegen 으로 그대로 지원된다(필드/변형
//! 접근자 불필요). serde 는 단일 필드 tuple struct 를 투명하게(newtype) 직렬화하므로,
//! `Vec<String>` 을 감싼 뉴타입은 `to_value` 결과가 named-field wrapper 없이 bare JSON
//! 배열이 된다 — 마이그레이션 대상(asset-storage)이 `Vec<String>` 필드를 bare jsonb
//! 배열로 저장하는 것과 동일한 표현을 얻기 위한 의도된 shape. enum 은 serde 기본
//! (externally tagged) 표현으로 저장된다: unit variant 는 `"Google"`(JSON 문자열),
//! data-carrying variant 는 `{"B": 5}`(JSON 오브젝트) — asset-storage 가 enum 필드를
//! jsonb 로 저장하던 표현과 동일하다. union 만 여전히 거부한다.

use convert_case::{Case, Casing};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{Data, DeriveInput, Fields};

pub fn derive(input: DeriveInput) -> TokenStream {
    match derive_inner(input) {
        Ok(ts) => ts,
        Err(e) => e.to_compile_error(),
    }
}

fn derive_inner(input: DeriveInput) -> syn::Result<TokenStream> {
    let ident = input.ident.clone();

    match &input.data {
        Data::Struct(s) if matches!(s.fields, Fields::Named(_)) => {}
        Data::Struct(s) if matches!(&s.fields, Fields::Unnamed(u) if u.unnamed.len() == 1) => {}
        // enum: 생성 impl 은 `self` 전체를 serde 로 직렬화하므로 variant 를 참조하지
        // 않는다 — tuple newtype 과 동일한 codegen 이 그대로 통한다. union 만 거부한다.
        Data::Enum(_) => {}
        _ => {
            return Err(syn::Error::new_spanned(
                &input,
                "PostgresJson supports named-field structs, single-field tuple newtypes, or enums",
            ));
        }
    }

    let base_name = ident.to_string().to_case(Case::Snake);

    let expanded = quote! {
        #[automatically_derived]
        impl ::postgres::PostgresObject for #ident {
            fn kind() -> ::postgres::ObjectKind {
                ::postgres::ObjectKind::Json
            }
            fn base_name() -> &'static str {
                #base_name
            }
            fn ddl() -> ::postgres::Ddl {
                // JSON 은 스키마 오브젝트가 아니다 — CREATE/DROP 없음.
                ::postgres::Ddl::default()
            }
        }

        #[automatically_derived]
        impl ::postgres::PostgresType for #ident {
            type Op = ::postgres::ops::JsonOp<#ident>;
            fn sql_type() -> ::postgres::SqlType {
                ::postgres::SqlType::JsonB
            }
            // dependency_ddl은 트레이트 기본값(None)을 그대로 쓴다 — json 타입은
            // 컬럼 정의 전에 먼저 존재해야 할 DDL 이 없다.
        }

        #[automatically_derived]
        impl ::std::convert::From<#ident> for ::postgres::Value {
            fn from(v: #ident) -> Self {
                ::postgres::Value::Json(
                    ::postgres::serde_json::to_value(&v).expect("PostgresJson serialize"),
                )
            }
        }

        #[automatically_derived]
        impl ::postgres::sqlx::Type<::postgres::sqlx::Postgres> for #ident {
            fn type_info() -> ::postgres::sqlx::postgres::PgTypeInfo {
                <::postgres::sqlx::types::Json<#ident> as ::postgres::sqlx::Type<
                    ::postgres::sqlx::Postgres,
                >>::type_info()
            }
            fn compatible(ty: &::postgres::sqlx::postgres::PgTypeInfo) -> bool {
                <::postgres::sqlx::types::Json<#ident> as ::postgres::sqlx::Type<
                    ::postgres::sqlx::Postgres,
                >>::compatible(ty)
            }
        }

        #[automatically_derived]
        impl<'__q> ::postgres::sqlx::Encode<'__q, ::postgres::sqlx::Postgres> for #ident {
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
                <::postgres::sqlx::types::Json<#ident> as ::postgres::sqlx::Encode<
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
                <::postgres::sqlx::types::Json<#ident> as ::postgres::sqlx::Encode<
                    '__q,
                    ::postgres::sqlx::Postgres,
                >>::encode_by_ref(&::postgres::sqlx::types::Json(self.clone()), buf)
            }
        }

        #[automatically_derived]
        impl<'__r> ::postgres::sqlx::Decode<'__r, ::postgres::sqlx::Postgres> for #ident {
            fn decode(
                value: ::postgres::sqlx::postgres::PgValueRef<'__r>,
            ) -> ::std::result::Result<Self, ::postgres::sqlx::error::BoxDynError> {
                ::std::result::Result::Ok(
                    <::postgres::sqlx::types::Json<#ident> as ::postgres::sqlx::Decode<
                        '__r,
                        ::postgres::sqlx::Postgres,
                    >>::decode(value)?
                    .0,
                )
            }
        }
    };

    Ok(expanded)
}
