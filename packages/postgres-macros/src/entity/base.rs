//! `PostgresObject` + `PostgresEntity` impl + `Name::repository()` 생성.
//!
//! 컬럼 메타(`columns()`)는 런타임 `OnceLock` 로 지연 생성한다 — nullability 는
//! `PostgresType::nullable()`(blanket impl 이 `Option<T>` 를 처리) 경유로 결정하므로
//! 매크로가 `Option` 을 텍스트로 파싱하지 않는다. sql_type 은 `PostgresType::sql_type`
//! 함수 포인터를 넘겨 enum prefix 해석을 런타임으로 미룬다.

use proc_macro2::TokenStream;
use quote::{format_ident, quote};

use super::model::{ColumnModel, EntityModel};
use super::relations;

pub fn expand(model: &EntityModel) -> TokenStream {
    let EntityModel {
        ident,
        vis,
        base_name,
        krate,
        register_schema,
        pk,
        scalars,
        relations,
        skipped,
        default_order,
        composite_uniques,
    } = model;

    let query_ident = model.query_ident();
    let update_ident = model.update_ident();

    let pk_field = &pk.field;
    let pk_ty = &pk.ty;
    let pk_col = &pk.column;

    // ── columns(): OnceLock<Vec<ColumnDef>> — pk, 스칼라, 그리고 소유 관계발 FK 컬럼 ──
    // one_to_many/many_to_many 는 부모 테이블에 컬럼을 만들지 않는다 (링크는 각각 자식 FK /
    // 조인테이블이 소유).
    let pk_def = column_def_tokens(krate, pk, true);
    let scalar_defs = scalars.iter().map(|c| column_def_tokens(krate, c, false));
    let fk_defs = relations
        .iter()
        .filter(|r| r.is_owning())
        .map(|r| relations::fk_column_def(krate, r));

    // ── relations(): OnceLock<Vec<RelationDef>> ──
    // 관계 필드(one_to_one/…/many_to_many) + 스칼라 FK-only 컬럼(references/foreign_key).
    // 후자는 pk 도 될 수 있으므로 pk + 스칼라 전체를 훑어 `ForeignKey` 엔트리를 만든다.
    let relation_defs = relations.iter().map(|r| relations::relation_def(krate, r));
    let scalar_fk_defs: ::std::vec::Vec<TokenStream> = ::std::iter::once(pk)
        .chain(scalars.iter())
        .filter_map(|c| relations::scalar_fk_relation_def(krate, c))
        .collect();
    // 관계 또는 FK-only 스칼라가 하나라도 있을 때만 relations() 를 오버라이드한다
    // (없으면 trait 기본 &[]).
    let relations_fn = if relations.is_empty() && scalar_fk_defs.is_empty() {
        quote! {}
    } else {
        quote! {
            fn relations() -> &'static [#krate::RelationDef] {
                static RELATIONS: ::std::sync::OnceLock<::std::vec::Vec<#krate::RelationDef>> =
                    ::std::sync::OnceLock::new();
                RELATIONS
                    .get_or_init(|| ::std::vec![
                        #( #relation_defs, )*
                        #( #scalar_fk_defs, )*
                    ])
                    .as_slice()
            }
        }
    };

    // ── composite_uniques(): struct-level #[postgres(unique(a, b, …))] ──
    // 그룹이 하나라도 있을 때만 trait 기본(&[])을 오버라이드한다. 반환 타입이
    // `&'static [&'static [&'static str]]` 이므로, 길이가 다른 inner 슬라이스들이
    // 공통 타입으로 강제변환되도록 명시적 타입의 `const` 를 거친다.
    let composite_uniques_fn = if composite_uniques.is_empty() {
        quote! {}
    } else {
        let groups = composite_uniques.iter().map(|cols| {
            let lits = cols.iter().map(|c| quote! { #c });
            quote! { &[ #( #lits ),* ] }
        });
        quote! {
            fn composite_uniques() -> &'static [&'static [&'static str]] {
                const CU: &[&[&str]] = &[ #( #groups ),* ];
                CU
            }
        }
    };

    // ── FK 값(insert) + hydrate 블록 + lazy 로더 ──
    // insert 는 소유 FK 만 바인딩한다; one_to_many/many_to_many 는 부모 행에 값이 없다.
    let insert_fks = relations
        .iter()
        .filter(|r| r.is_owning())
        .map(|r| relations::insert_value(krate, r));
    let hydrate_blocks = relations.iter().map(|r| relations::hydrate_block(krate, r));
    let loader_methods = relations
        .iter()
        .map(|r| relations::loader_method(krate, vis, r));

    // ── many_to_many: join_table_ddls() 오버라이드 + 확장 트레이트(attach/detach) ──
    let m2m_rels: ::std::vec::Vec<_> = relations.iter().filter(|r| r.is_many_to_many()).collect();
    let join_table_ddls_fn = if m2m_rels.is_empty() {
        quote! {}
    } else {
        let ddl_exprs = m2m_rels
            .iter()
            .map(|r| relations::join_table_ddl_expr(krate, r));
        quote! {
            fn join_table_ddls() -> ::std::vec::Vec<#krate::Ddl> {
                ::std::vec![ #( #ddl_exprs ),* ]
            }
        }
    };
    let ext_trait = relations::ext_trait(krate, ident, vis, &m2m_rels);

    // ── 프로세스 인벤토리 자동 등록 (M7, Schema::from_inventory) ──
    // 기본적으로 모든 엔티티를 등록하되, 다른 서비스 소유 테이블의 read-only mirror는
    // `#[postgres(skip_schema)]`로 제외한다. `Schema::from_inventory()`는 현재 바이너리에
    // 링크된 등록만 본다. 값은 `static` 초기자(inventory::submit!)에 놓이므로 모든 필드가
    // `fn` 포인터(const 안전한 비캡처 클로저)다. enum prefix·타깃 테이블명은 런타임
    // prefix에 의존해 지연 평가한다. fk_targets는 FK를 렌더하는 관계의 위상정렬 간선이다.
    let inventory_submit = if *register_schema {
        quote! {
            #krate::inventory::submit! {
                #krate::SchemaRegistration {
                    name: || <#ident as #krate::PostgresObject>::name(),
                    table_ddl: || <#ident as #krate::PostgresObject>::ddl(),
                    enum_dependencies: || <#ident as #krate::PostgresEntity>::enum_dependencies(),
                    join_table_ddls: || <#ident as #krate::PostgresEntity>::join_table_ddls(),
                    fk_targets: || {
                        <#ident as #krate::PostgresEntity>::relations()
                            .iter()
                            .filter(|r| ::core::matches!(
                                r.kind,
                                #krate::RelationKind::OneToOne
                                    | #krate::RelationKind::ManyToOne
                                    | #krate::RelationKind::ForeignKey
                            ))
                            .map(|r| (r.target_table)())
                            .collect::<::std::vec::Vec<::std::string::String>>()
                    },
                }
            }
        }
    } else {
        quote! {}
    };

    // ── 전역 풀 기반 arg-less 편의 메서드 (asset-storage 대응) — 모든 엔티티 ──
    // 예전 `#[postgres(global)]` 게이트는 제거됐다: `repository()` 가 이미 전역 풀을 쓰므로
    // 그 위의 편의 메서드도 항상 생성한다.
    let global_methods = quote! {
        #vis async fn get_by_id(
            id: impl #krate::PgKey<<Self as #krate::PostgresEntity>::Pk>,
        ) -> #krate::Result<::core::option::Option<Self>> {
            Self::repository().get(id.into_pg_key()?).await
        }
        #vis async fn delete_by_id(
            id: impl #krate::PgKey<<Self as #krate::PostgresEntity>::Pk>,
        ) -> #krate::Result<Self> {
            Self::repository().delete_returning(id.into_pg_key()?).await
        }
        #vis async fn upsert(&self) -> #krate::Result<Self> {
            Self::repository().upsert(self).await
        }
        #vis async fn create(&self) -> #krate::Result<Self> {
            Self::repository().insert(self).await
        }
    };

    // ── #[postgres(find = "…")]: 전역 풀 named finder (asset-storage `X::find_by_room(v)` 대응) ──
    // pk + scalar 필드(컬럼을 갖는 모든 필드)마다 `NAME(value) -> Page<Self>` +
    // `NAME_page(value, page, page_size)` 를 생성한다 — pk 도 find 대상일 수 있다
    // (screener_watchlist 처럼 pk 이면서 동시에 FK-only `references` 인 필드; 실제
    // `#[pg(primary_key, find = "find_by_user")]` 선례). default_order 필드가 있으면
    // `ORDER BY <col> DESC` (newest-first). finder 는 전역 풀을 쓰며, 그 풀은 상시
    // 사용 가능하므로 별도 struct 게이트 없이 `find` attr 이 있는 필드마다 생성된다.
    let finder_methods = {
        let order_stmt = match default_order {
            ::core::option::Option::Some(oc) => quote! {
                spec.order.push((#oc, #krate::Order::Desc));
            },
            ::core::option::Option::None => quote! {},
        };
        let finders: ::std::vec::Vec<TokenStream> = ::std::iter::once(pk)
            .chain(scalars.iter())
            .filter_map(|c| {
                let name = c.find.as_ref()?;
                let finder_ident = format_ident!("{}", name);
                let page_ident = format_ident!("{}_page", name);
                let col = &c.column;
                ::core::option::Option::Some(quote! {
                    #vis async fn #finder_ident(
                        value: impl ::core::convert::Into<#krate::Value>,
                    ) -> #krate::Result<#krate::Page<Self>> {
                        let mut spec = #krate::QuerySpec::default();
                        spec.conds.push(#krate::cond::Cond::pred(
                            #col,
                            #krate::cond::PredExpr::Cmp("=", ::core::convert::Into::into(value)),
                        ));
                        #order_stmt
                        Self::repository().find_by_spec(&spec).await
                    }

                    #vis async fn #page_ident(
                        value: impl ::core::convert::Into<#krate::Value>,
                        page: i64,
                        page_size: i64,
                    ) -> #krate::Result<#krate::Page<Self>> {
                        let mut spec = #krate::QuerySpec::default();
                        spec.conds.push(#krate::cond::Cond::pred(
                            #col,
                            #krate::cond::PredExpr::Cmp("=", ::core::convert::Into::into(value)),
                        ));
                        #order_stmt
                        spec.page = ::core::option::Option::Some(page);
                        spec.page_size = ::core::option::Option::Some(page_size);
                        Self::repository().find_by_spec(&spec).await
                    }
                })
            })
            .collect();
        quote! { #( #finders )* }
    };

    // 관계가 없으면 hydrate 는 무인자 no-op (Task 9 동작 유지) — unused 경고 방지.
    let hydrate_body = if relations.is_empty() {
        quote! {
            let _ = (db, items, query);
            ::core::result::Result::Ok(())
        }
    } else {
        quote! {
            if items.is_empty() {
                return ::core::result::Result::Ok(());
            }
            #( #hydrate_blocks )*
            ::core::result::Result::Ok(())
        }
    };

    // ── from_pg_row: 스칼라/pk → try_get, skip/관계 → Default ──
    let from_pk = {
        let f = pk_field;
        quote! { #f: #krate::sqlx::Row::try_get(row, #pk_col)? }
    };
    let from_scalars = scalars.iter().map(|c| {
        let f = &c.field;
        let col = &c.column;
        quote! { #f: #krate::sqlx::Row::try_get(row, #col)? }
    });
    let from_defaults = relations
        .iter()
        .map(|r| &r.field)
        .chain(skipped.iter())
        .map(|f| quote! { #f: ::core::default::Default::default() });

    // ── insert_values ──
    let insert_scalars = scalars.iter().map(|c| {
        let f = &c.field;
        let col = &c.column;
        quote! { (#col, ::core::convert::Into::into(::core::clone::Clone::clone(&self.#f))) }
    });

    // ── value_of ──
    let value_of_scalars = scalars.iter().map(|c| {
        let f = &c.field;
        let col = &c.column;
        quote! {
            #col => ::core::option::Option::Some(
                ::core::convert::Into::into(::core::clone::Clone::clone(&self.#f))
            )
        }
    });

    // ── enum_dependencies: 모든 컬럼 타입의 dependency_ddl 수집 ──
    let dep_pk_ty = pk_ty;
    let dep_scalar_tys = scalars.iter().map(|c| &c.ty);

    quote! {
        #[automatically_derived]
        impl #krate::PostgresObject for #ident {
            fn kind() -> #krate::ObjectKind {
                #krate::ObjectKind::Table
            }
            fn base_name() -> &'static str {
                #base_name
            }
            fn ddl() -> #krate::Ddl {
                #krate::build_create_table(
                    &<Self as #krate::PostgresObject>::name(),
                    <Self as #krate::PostgresEntity>::columns(),
                    <Self as #krate::PostgresEntity>::relations(),
                    <Self as #krate::PostgresEntity>::composite_uniques(),
                )
            }
        }

        #[automatically_derived]
        impl #krate::PostgresEntity for #ident {
            type Pk = #pk_ty;
            type Query = #query_ident;
            type Update = #update_ident;

            fn primary_key_column() -> &'static str {
                #pk_col
            }

            fn primary_key(&self) -> #pk_ty {
                ::core::clone::Clone::clone(&self.#pk_field)
            }

            fn columns() -> &'static [#krate::ColumnDef] {
                static COLUMNS: ::std::sync::OnceLock<::std::vec::Vec<#krate::ColumnDef>> =
                    ::std::sync::OnceLock::new();
                COLUMNS
                    .get_or_init(|| ::std::vec![
                        #pk_def,
                        #( #scalar_defs, )*
                        #( #fk_defs, )*
                    ])
                    .as_slice()
            }

            #relations_fn

            #composite_uniques_fn

            fn from_pg_row(row: &#krate::sqlx::postgres::PgRow) -> #krate::Result<Self> {
                ::core::result::Result::Ok(Self {
                    #from_pk,
                    #( #from_scalars, )*
                    #( #from_defaults, )*
                })
            }

            fn insert_values(&self) -> ::std::vec::Vec<(&'static str, #krate::Value)> {
                ::std::vec![
                    (
                        #pk_col,
                        #krate::init_pk(
                            ::core::convert::Into::into(::core::clone::Clone::clone(&self.#pk_field))
                        )
                    ),
                    #( #insert_scalars, )*
                    #( #insert_fks, )*
                ]
            }

            fn value_of(&self, column: &'static str) -> ::core::option::Option<#krate::Value> {
                match column {
                    #pk_col => ::core::option::Option::Some(
                        ::core::convert::Into::into(::core::clone::Clone::clone(&self.#pk_field))
                    ),
                    #( #value_of_scalars, )*
                    _ => ::core::option::Option::None,
                }
            }

            fn enum_dependencies() -> ::std::vec::Vec<#krate::Ddl> {
                ::core::iter::IntoIterator::into_iter([
                    <#dep_pk_ty as #krate::PostgresType>::dependency_ddl(),
                    #( <#dep_scalar_tys as #krate::PostgresType>::dependency_ddl(), )*
                ])
                .flatten()
                .collect()
            }

            #join_table_ddls_fn

            async fn hydrate(
                db: &#krate::Db,
                items: &mut [Self],
                query: &#query_ident,
            ) -> #krate::Result<()> {
                #hydrate_body
            }
        }

        #[automatically_derived]
        impl #ident {
            /// 프로세스 전역 풀([`postgres::global::pool`]) 기반 리포지토리 — 일차 API.
            /// [`postgres::set_global_pool`] 선행 필요. 명시적 풀은
            /// `postgres::PostgresRepository::new(pool)`.
            #vis fn repository() -> #krate::PostgresRepository<Self> {
                #krate::PostgresRepository::new(#krate::global::pool().clone())
            }

            #global_methods

            #finder_methods

            #( #loader_methods )*
        }

        #ext_trait

        #inventory_submit
    }
}

/// 컬럼 하나의 `ColumnDef { … }` 리터럴. `type` override 는 `SqlType::Raw` 를 만드는
/// 비캡처 클로저를 `fn` 포인터로 강제 변환한다; 없으면 `PostgresType::sql_type` 경로.
fn column_def_tokens(krate: &syn::Path, col: &ColumnModel, primary_key: bool) -> TokenStream {
    let name = &col.column;
    let ty = &col.ty;
    let unique = col.unique;
    let index = col.index;
    let version = col.version;
    let index_version = col.index_version;

    let sql_type = match &col.sql_type_override {
        Some(raw) => quote! {
            (|| #krate::SqlType::Raw(::std::string::String::from(#raw))) as fn() -> #krate::SqlType
        },
        None => quote! { <#ty as #krate::PostgresType>::sql_type },
    };
    let default_sql = match &col.sql_default {
        Some(sql) => quote! {
            (|| ::core::option::Option::Some(#sql))
                as fn() -> ::core::option::Option<&'static str>
        },
        None => quote! { <#ty as #krate::PostgresType>::migration_default_sql },
    };

    quote! {
        #krate::ColumnDef {
            name: #name,
            sql_type: #sql_type,
            nullable: <#ty as #krate::PostgresType>::nullable(),
            unique: #unique,
            index: #index,
            version: #version,
            index_version: #index_version,
            default_sql: #default_sql,
            primary_key: #primary_key,
        }
    }
}
