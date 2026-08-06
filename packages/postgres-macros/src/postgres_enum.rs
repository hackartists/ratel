//! `#[derive(PostgresEnum)]` — unit-variant enum → PG native enum 타입(기본) 또는
//! TEXT 저장(`#[postgres(text)]`).
//!
//! TEXT 모드에 한해 **단일 catch-all 뉴타입 변형**(`Unknown(String)` 모양)을 허용한다:
//! 알려진 라벨이 아니면 원문 문자열을 담아 흡수한다(native enum 타입은 고정 라벨
//! 집합이라 담을 수 없으므로 text 전용). 이 매크로는 **DB 컬럼 코덱만** 생성한다 —
//! `Display`/`FromStr`/serde 는 만들지 않으니, 필요하면 strum / serde_with 로 따로 붙인다.
//!
//! 생성 impl: `PostgresObject` · `PostgresEnumMeta` · `PostgresType` ·
//! `From<Self> for Value` · sqlx `Type`/`Encode`/`Decode`.
//! 모든 경로는 런타임 crate(`::postgres::…`)만 참조한다.

use convert_case::{Case, Casing};
use proc_macro2::TokenStream;
use quote::quote;
use syn::{Data, DeriveInput, Fields};

use crate::attrs::PostgresAttrs;

pub fn derive(input: DeriveInput) -> TokenStream {
    match derive_inner(input) {
        Ok(ts) => ts,
        Err(e) => e.to_compile_error(),
    }
}

fn derive_inner(input: DeriveInput) -> syn::Result<TokenStream> {
    let ident = input.ident.clone();

    let data_enum = match &input.data {
        Data::Enum(e) => e,
        _ => {
            return Err(syn::Error::new_spanned(
                &input,
                "PostgresEnum supports only enums",
            ));
        }
    };

    let struct_attrs = PostgresAttrs::parse(&input.attrs)?;
    let text_mode = struct_attrs.has_flag("text");
    let base_name = struct_attrs
        .get("type")
        .map(str::to_string)
        .unwrap_or_else(|| ident.to_string().to_case(Case::Snake));

    // 변형 수집: unit 변형(라벨 상수) + 최대 하나의 catch-all 뉴타입 변형.
    let mut unit_variants: Vec<syn::Ident> = Vec::new();
    let mut unit_labels: Vec<String> = Vec::new();
    let mut unit_versions: Vec<u64> = Vec::new();
    let mut catch_all: Option<syn::Ident> = None;
    for v in &data_enum.variants {
        match &v.fields {
            Fields::Unit => {
                let vattrs = PostgresAttrs::parse(&v.attrs)?;
                let label = vattrs
                    .get("rename")
                    .map(str::to_string)
                    .unwrap_or_else(|| v.ident.to_string().to_case(Case::Snake));
                if vattrs.get("version").is_some() {
                    return Err(syn::Error::new_spanned(
                        v,
                        "postgres version must be an integer literal, for example version = 1",
                    ));
                }
                let version = vattrs.get_u64("version").unwrap_or(0);
                if vattrs.get_u64("version") == Some(0) {
                    return Err(syn::Error::new_spanned(
                        v,
                        "version 0 is the implicit enum baseline; omit #[postgres(version = 0)]",
                    ));
                }
                if text_mode && version > 0 {
                    return Err(syn::Error::new_spanned(
                        v,
                        "version is only supported for native PostgresEnum labels, not #[postgres(text)]",
                    ));
                }
                unit_variants.push(v.ident.clone());
                unit_labels.push(label);
                unit_versions.push(version);
            }
            // 단일 필드 뉴타입 = catch-all(예: `Unknown(String)`). native 타입은
            // 임의 텍스트를 담을 수 없으므로 TEXT 모드에서만, 하나만 허용한다.
            Fields::Unnamed(f) if f.unnamed.len() == 1 => {
                let vattrs = PostgresAttrs::parse(&v.attrs)?;
                if vattrs.get("version").is_some() || vattrs.get_u64("version").is_some() {
                    return Err(syn::Error::new_spanned(
                        v,
                        "a text catch-all enum variant cannot have a schema version",
                    ));
                }
                if catch_all.is_some() {
                    return Err(syn::Error::new_spanned(
                        v,
                        "PostgresEnum supports at most one catch-all (single-field) variant",
                    ));
                }
                if !text_mode {
                    return Err(syn::Error::new_spanned(
                        v,
                        "PostgresEnum catch-all (data-carrying) variant requires #[postgres(text)] — a native PG enum type can't store arbitrary text",
                    ));
                }
                catch_all = Some(v.ident.clone());
            }
            _ => {
                return Err(syn::Error::new_spanned(
                    v,
                    "PostgresEnum variants must be unit, or a single catch-all newtype (e.g. `Unknown(String)`)",
                ));
            }
        }
    }

    if unit_variants.is_empty() && catch_all.is_none() {
        return Err(syn::Error::new_spanned(
            &input,
            "PostgresEnum requires at least one variant",
        ));
    }

    let versions: std::collections::BTreeSet<u64> = unit_versions
        .iter()
        .copied()
        .filter(|version| *version > 0)
        .collect();
    if unit_versions.windows(2).any(|pair| pair[0] > pair[1]) {
        return Err(syn::Error::new_spanned(
            &input,
            "native enum variants must be declared in nondecreasing schema version order",
        ));
    }
    if let Some(max_version) = versions.last().copied() {
        for expected in 1..=max_version {
            if !versions.contains(&expected) {
                return Err(syn::Error::new_spanned(
                    &input,
                    format!("enum schema versions must be contiguous; missing version {expected}"),
                ));
            }
        }
    }
    if !text_mode && !unit_versions.iter().any(|version| *version == 0) {
        return Err(syn::Error::new_spanned(
            &input,
            "a native PostgresEnum needs at least one baseline v0 variant",
        ));
    }

    // ── PostgresObject.ddl() ──
    let ddl_body = if text_mode {
        quote! { ::postgres::Ddl::default() }
    } else {
        quote! {
            let __name = <#ident as ::postgres::PostgresObject>::name();
            ::postgres::build_create_enum(
                &__name,
                <#ident as ::postgres::PostgresEnumMeta>::variants(),
            )
        }
    };

    let variants_fn = if text_mode {
        quote! {}
    } else {
        quote! {
            fn variants() -> &'static [::postgres::EnumVariantDef] {
                const VARIANTS: &[::postgres::EnumVariantDef] = &[
                    #(
                        ::postgres::EnumVariantDef {
                            label: #unit_labels,
                            version: #unit_versions,
                        },
                    )*
                ];
                VARIANTS
            }
        }
    };

    // ── PostgresType — sql_type / dependency_ddl 만 모드에 따라 달라진다 ──
    let (sql_type_body, dependency_ddl_body) = if text_mode {
        (
            quote! { ::postgres::SqlType::Text },
            quote! { ::std::option::Option::None },
        )
    } else {
        (
            quote! { ::postgres::SqlType::Enum(<#ident as ::postgres::PostgresObject>::name()) },
            quote! { ::std::option::Option::Some(<#ident as ::postgres::PostgresObject>::ddl()) },
        )
    };

    // ── From<Self> for Value ── (pg_label 은 이제 Cow → into_owned 로 String 화)
    let value_from_body = if text_mode {
        quote! {
            ::postgres::Value::Text(
                ::std::borrow::Cow::into_owned(::postgres::PostgresEnumMeta::pg_label(&v))
            )
        }
    } else {
        quote! {
            ::postgres::Value::Enum(
                ::std::borrow::Cow::into_owned(::postgres::PostgresEnumMeta::pg_label(&v)),
                <#ident as ::postgres::PostgresEnumMeta>::pg_type_name(),
            )
        }
    };

    // pg_label: unit → Borrowed(라벨 상수), catch-all → Owned(담긴 원문).
    let catch_all_label_arm = catch_all.as_ref().map(|c| {
        quote! {
            #ident::#c(__inner) => ::std::borrow::Cow::Owned(
                ::std::string::ToString::to_string(__inner)
            ),
        }
    });

    // Decode 의 마지막 가지: catch-all 이면 원문을 담아 흡수, 아니면 unknown 에러.
    let catch_all_decode_arm = match &catch_all {
        Some(c) => quote! {
            __other => ::std::result::Result::Ok(
                #ident::#c(::std::string::ToString::to_string(__other))
            )
        },
        None => quote! {
            __other => ::std::result::Result::Err(
                ::std::format!(
                    "unknown {} label: {}",
                    <#ident as ::postgres::PostgresObject>::name(),
                    __other
                )
                .into(),
            )
        },
    };

    // ── sqlx::Type — native 는 leaked prefixed 이름, text 는 &str 위임 ──
    let type_impl = if text_mode {
        quote! {
            #[automatically_derived]
            impl ::postgres::sqlx::Type<::postgres::sqlx::Postgres> for #ident {
                fn type_info() -> ::postgres::sqlx::postgres::PgTypeInfo {
                    <&str as ::postgres::sqlx::Type<::postgres::sqlx::Postgres>>::type_info()
                }
                fn compatible(ty: &::postgres::sqlx::postgres::PgTypeInfo) -> bool {
                    <&str as ::postgres::sqlx::Type<::postgres::sqlx::Postgres>>::compatible(ty)
                }
            }
        }
    } else {
        quote! {
            #[automatically_derived]
            impl ::postgres::sqlx::Type<::postgres::sqlx::Postgres> for #ident {
                fn type_info() -> ::postgres::sqlx::postgres::PgTypeInfo {
                    static __NAME: ::std::sync::OnceLock<&'static str> = ::std::sync::OnceLock::new();
                    let __name: &'static str = __NAME.get_or_init(|| {
                        ::std::boxed::Box::leak(
                            <#ident as ::postgres::PostgresObject>::name().into_boxed_str(),
                        )
                    });
                    ::postgres::sqlx::postgres::PgTypeInfo::with_name(__name)
                }
                fn compatible(ty: &::postgres::sqlx::postgres::PgTypeInfo) -> bool {
                    // 명시적 RETURNING/decode 견고성: named 타입 + TEXT/VARCHAR 모두 허용.
                    let __n = ::postgres::sqlx::TypeInfo::name(ty);
                    let __self_info =
                        <#ident as ::postgres::sqlx::Type<::postgres::sqlx::Postgres>>::type_info();
                    __n.eq_ignore_ascii_case(::postgres::sqlx::TypeInfo::name(&__self_info))
                        || __n.eq_ignore_ascii_case("TEXT")
                        || __n.eq_ignore_ascii_case("VARCHAR")
                        || __n.eq_ignore_ascii_case("BPCHAR")
                        || __n.eq_ignore_ascii_case("\"char\"")
                }
            }
        }
    };

    let expanded = quote! {
        #[automatically_derived]
        impl ::postgres::PostgresObject for #ident {
            fn kind() -> ::postgres::ObjectKind {
                ::postgres::ObjectKind::Enum
            }
            fn base_name() -> &'static str {
                #base_name
            }
            fn ddl() -> ::postgres::Ddl {
                #ddl_body
            }
        }

        #[automatically_derived]
        impl ::postgres::PostgresEnumMeta for #ident {
            fn pg_type_name() -> ::std::string::String {
                <#ident as ::postgres::PostgresObject>::name()
            }
            fn pg_label(&self) -> ::std::borrow::Cow<'static, str> {
                match self {
                    #( #ident::#unit_variants => ::std::borrow::Cow::Borrowed(#unit_labels), )*
                    #catch_all_label_arm
                }
            }

            #variants_fn
        }

        #[automatically_derived]
        impl ::postgres::PostgresType for #ident {
            type Op = ::postgres::ops::EnumOp<#ident>;
            fn sql_type() -> ::postgres::SqlType {
                #sql_type_body
            }
            fn dependency_ddl() -> ::std::option::Option<::postgres::Ddl> {
                #dependency_ddl_body
            }
        }

        #[automatically_derived]
        impl ::std::convert::From<#ident> for ::postgres::Value {
            fn from(v: #ident) -> Self {
                #value_from_body
            }
        }

        #type_impl

        #[automatically_derived]
        impl<'__q> ::postgres::sqlx::Encode<'__q, ::postgres::sqlx::Postgres> for #ident {
            fn encode_by_ref(
                &self,
                buf: &mut ::postgres::sqlx::postgres::PgArgumentBuffer,
            ) -> ::std::result::Result<
                ::postgres::sqlx::encode::IsNull,
                ::postgres::sqlx::error::BoxDynError,
            > {
                let __label = ::postgres::PostgresEnumMeta::pg_label(self);
                <::std::string::String as ::postgres::sqlx::Encode<'__q, ::postgres::sqlx::Postgres>>::encode(
                    ::std::borrow::Cow::into_owned(__label),
                    buf,
                )
            }
        }

        #[automatically_derived]
        impl<'__r> ::postgres::sqlx::Decode<'__r, ::postgres::sqlx::Postgres> for #ident {
            fn decode(
                value: ::postgres::sqlx::postgres::PgValueRef<'__r>,
            ) -> ::std::result::Result<Self, ::postgres::sqlx::error::BoxDynError> {
                let __label = <&str as ::postgres::sqlx::Decode<
                    '__r,
                    ::postgres::sqlx::Postgres,
                >>::decode(value)?;
                match __label {
                    #( #unit_labels => ::std::result::Result::Ok(#ident::#unit_variants), )*
                    #catch_all_decode_arm
                }
            }
        }
    };

    Ok(expanded)
}
