//! Postgres derive macros — `PostgresEntity`, `PostgresEnum`, `PostgresJson`.
//! 생성 코드는 런타임 crate(`::postgres`)의 트레이트/타입만 참조한다.

mod attrs;
mod entity;
mod postgres_enum;
mod postgres_json;

use proc_macro::TokenStream;
use syn::{DeriveInput, parse_macro_input};

/// named-field struct 를 소유 엔티티(테이블 행)로 만든다. struct-level `table`/`crate`,
/// field-level `pk`/`column`/`type`/`unique`/`index`/`skip` 지원. `PostgresObject`/
/// `PostgresEntity` impl 과 `{Name}Column`/`{Name}Cols`/`{Name}Query`/`{Name}Update`,
/// `Name::repository()` 를 생성한다. (관계 attribute 는 Task 10~12.)
#[proc_macro_derive(PostgresEntity, attributes(postgres))]
pub fn derive_postgres_entity(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    entity::derive(input).into()
}

/// unit-variant enum 을 PG native enum 타입(기본) 또는 TEXT(`#[postgres(text)]`)
/// 컬럼으로 저장한다. struct-level `#[postgres(type = "...")]`, variant-level
/// `#[postgres(rename = "...")]` 지원.
#[proc_macro_derive(PostgresEnum, attributes(postgres))]
pub fn derive_postgres_enum(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    postgres_enum::derive(input).into()
}

/// named-field struct 를 JSONB 컬럼(스키마리스 로지컬 타입)으로 저장한다.
/// 대상 타입은 `Serialize + DeserializeOwned + Clone` 이어야 한다. v1 은
/// attribute 를 받지 않는다 — `base_name` 은 항상 ident 의 snake_case.
#[proc_macro_derive(PostgresJson)]
pub fn derive_postgres_json(input: TokenStream) -> TokenStream {
    let input = parse_macro_input!(input as DeriveInput);
    postgres_json::derive(input).into()
}
