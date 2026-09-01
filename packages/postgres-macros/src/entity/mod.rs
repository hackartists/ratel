//! `#[derive(PostgresEntity)]` — 소유 엔티티(테이블 행) 코드 생성.
//!
//! 생성물: `PostgresObject`(kind=Table) · `PostgresEntity`(columns/from_pg_row/
//! insert_values/value_of/enum_dependencies/hydrate) · `Name::repository()` ·
//! `{Name}Column`/`{Name}Cols`/`{Name}Query`/`{Name}Update`. 모든 경로는 런타임
//! crate(기본 `::postgres`, `#[postgres(crate = "...")]` 로 오버라이드)만 참조한다.
//!
//! 스칼라 컬럼(Task 9) + 소유 관계(one_to_one / many_to_one, Task 10) + 역방향
//! one_to_many(Task 11) + 다대다 many_to_many(Task 12)를 생성한다. 소유 관계는 FK 컬럼
//! 합성 + `relations()` 엔트리 + eager/lazy hydrate 로, one_to_many 는 (컬럼 없이)
//! `relations()` 엔트리 + 자식 배치 hydrate 로, many_to_many 는 (컬럼 없이) `relations()`
//! 엔트리 + `join_table_ddls()` 조인테이블 DDL + `{Name}RepositoryExt`(attach/detach) +
//! 조인테이블 배치 hydrate 로 이어진다.

mod base;
mod model;
mod query;
mod relations;

use proc_macro2::TokenStream;
use quote::quote;
use syn::DeriveInput;

use model::EntityModel;

pub fn derive(input: DeriveInput) -> TokenStream {
    match derive_inner(input) {
        Ok(ts) => ts,
        Err(e) => e.to_compile_error(),
    }
}

fn derive_inner(input: DeriveInput) -> syn::Result<TokenStream> {
    let model = EntityModel::from_derive_input(&input)?;
    let base = base::expand(&model);
    let query = query::expand(&model);
    Ok(quote! {
        #base
        #query
    })
}
