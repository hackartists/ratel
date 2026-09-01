//! 타입 있는 쿼리/업데이트 표면 생성: `{Name}Column`(+`as_str`) · `{Name}Cols`(+`new`) ·
//! `{Name}Query`(컬럼별 Op 진입점 + filter/order_by/limit/offset + `AsQuerySpec`) ·
//! `{Name}Update`(컬럼별 세터 + `AsUpdateSet`).
//!
//! pk 는 `{Name}Column`(order_by 대상)과 `{Name}Cols`(filter 클로저에서 pk 조건)에는
//! 포함되지만, `{Name}Query` 컬럼 메서드/`{Name}Update` 세터에는 포함되지 않는다 —
//! pk 로의 단건 조회/수정은 repository 의 get/update 가 담당한다.

use proc_macro2::TokenStream;
use quote::quote;

use super::model::EntityModel;
use super::relations;

pub fn expand(model: &EntityModel) -> TokenStream {
    let EntityModel {
        vis,
        krate,
        scalars,
        relations,
        ..
    } = model;

    let column_ident = model.column_enum_ident();
    let cols_ident = model.cols_ident();
    let query_ident = model.query_ident();
    let update_ident = model.update_ident();

    // ── {Name}Column: 모든 컬럼(pk + 스칼라) ──
    let all_cols = std::iter::once(&model.pk).chain(model.scalars.iter());
    let (col_variants, col_names): (Vec<_>, Vec<_>) = all_cols
        .map(|c| (c.variant_ident(), c.column.clone()))
        .unzip();

    // ── {Name}Cols: 모든 컬럼(pk + 스칼라) — filter 클로저에서 pk 로도 조건을 걸 수 있다 ──
    let cols_fields = std::iter::once(&model.pk).chain(scalars.iter()).map(|c| {
        let f = &c.field;
        let ty = &c.ty;
        quote! { #vis #f: #krate::Col<#ty> }
    });
    let cols_init = std::iter::once(&model.pk).chain(scalars.iter()).map(|c| {
        let f = &c.field;
        let col = &c.column;
        quote! { #f: #krate::Col::new(#col) }
    });

    let query_methods = scalars.iter().map(|c| {
        let f = &c.field;
        let ty = &c.ty;
        let col = &c.column;
        quote! {
            #vis fn #f(
                mut self,
                op: impl #krate::ops::IntoOp<<#ty as #krate::PostgresType>::Op>,
            ) -> Self {
                let __op = #krate::ops::IntoOp::into_op(op);
                self.spec.conds.push(#krate::ops::OpLower::lower(__op, #col));
                self
            }
        }
    });

    // ── {Name}Update 세터: 스칼라만. Option<T> 는 Into<Option<T>> 로 None 수용 ──
    let update_setters = scalars.iter().map(|c| {
        let f = &c.field;
        let ty = &c.ty;
        let col = &c.column;
        quote! {
            #vis fn #f(mut self, v: impl ::core::convert::Into<#ty>) -> Self {
                self.set.push(
                    #col,
                    #krate::Value::from(<_ as ::core::convert::Into<#ty>>::into(v)),
                );
                self
            }
        }
    });

    // ── 관계 표면: {Query} 의 with_* 플래그/메서드(모든 관계) + {Update} 의 FK 세터 ──
    // FK 세터는 소유 관계만 — one_to_many/many_to_many 는 부모 행에 FK 컬럼이 없다.
    let with_flag_fields = relations.iter().map(relations::with_flag_field);
    let with_methods = relations.iter().map(|r| relations::with_method(vis, r));
    let fk_setters = relations
        .iter()
        .filter(|r| r.is_owning())
        .map(|r| relations::fk_setter(krate, vis, r));

    quote! {
        #vis enum #column_ident {
            #( #col_variants, )*
        }

        #[automatically_derived]
        impl #column_ident {
            #vis fn as_str(&self) -> &'static str {
                match self {
                    #( Self::#col_variants => #col_names, )*
                }
            }
        }

        #vis struct #cols_ident {
            #( #cols_fields, )*
        }

        #[automatically_derived]
        impl #cols_ident {
            #vis fn new() -> Self {
                Self { #( #cols_init, )* }
            }
        }

        #[derive(::core::default::Default)]
        #vis struct #query_ident {
            spec: #krate::QuerySpec,
            #( #with_flag_fields, )*
        }

        #[automatically_derived]
        impl #query_ident {
            #( #query_methods )*

            #( #with_methods )*

            #vis fn filter(
                mut self,
                f: impl ::core::ops::FnOnce(#cols_ident) -> #krate::cond::Cond,
            ) -> Self {
                self.spec.conds.push(f(#cols_ident::new()));
                self
            }

            #vis fn order_by(mut self, col: #column_ident, order: #krate::Order) -> Self {
                self.spec.order.push((col.as_str(), order));
                self
            }

            #vis fn limit(mut self, n: i64) -> Self {
                self.spec.limit = ::core::option::Option::Some(n);
                self
            }

            #vis fn offset(mut self, n: i64) -> Self {
                self.spec.offset = ::core::option::Option::Some(n);
                self
            }

            /// 1-based 페이지 번호. `page_size` 와 함께 써야 페이징이 동작한다 (page_size
            /// 없이 page 만 주면 무시된다). 페이징은 raw limit/offset 보다 우선한다.
            #vis fn page(mut self, page: i64) -> Self {
                self.spec.page = ::core::option::Option::Some(page);
                self
            }

            /// 페이지 크기. 지정되면 `LIMIT page_size OFFSET (page-1)*page_size` 로 페이징하며
            /// raw limit/offset 은 무시된다. `find` 결과의 `page_size`/`total_pages` 를 구동한다.
            #vis fn page_size(mut self, page_size: i64) -> Self {
                self.spec.page_size = ::core::option::Option::Some(page_size);
                self
            }
        }

        #[automatically_derived]
        impl #krate::AsQuerySpec for #query_ident {
            fn spec(&self) -> &#krate::QuerySpec {
                &self.spec
            }
        }

        #[derive(::core::default::Default)]
        #vis struct #update_ident {
            set: #krate::UpdateSet,
        }

        #[automatically_derived]
        impl #update_ident {
            #( #update_setters )*

            #( #fk_setters )*
        }

        #[automatically_derived]
        impl #krate::AsUpdateSet for #update_ident {
            fn set(&self) -> &#krate::UpdateSet {
                &self.set
            }
        }
    }
}
