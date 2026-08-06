//! 관계 코드 생성 — 소유 측(one_to_one / many_to_one, Task 10) + 역방향(one_to_many, Task 11).
//!
//! 소유 관계 `#[postgres(many_to_one)] user: RUser` / `#[postgres(one_to_one, …)]
//! owner: Option<RUser>` 하나마다:
//!
//! - FK 컬럼 [`fk_column_def`] — `columns()` 에 합쳐진다.
//! - [`relation_def`] — `relations()` 엔트리. DDL 의 REFERENCES/UNIQUE + hydrate 의
//!   fk/ref 컬럼명 단일 소스.
//! - [`insert_value`] — `RelationRef::fk_value` 로 FK 값 바인딩.
//! - [`hydrate_block`] — `with_*` 플래그가 켜졌을 때 JOIN-on-self 배치 2차 쿼리.
//! - [`fk_setter`] — `{Update}` 의 FK 스칼라 세터. 기본 reference(FK → target PK)에서만
//!   생성된다; custom `reference_key` 관계는 FK 컬럼의 러스트 타입을 매크로가 알 수 없어
//!   생성하지 않는다.
//!
//! 역방향 관계 `#[postgres(one_to_many)] posts: Vec<RPost>` 하나마다:
//!
//! - 컬럼/제약/insert/FK 세터 **없음** (FK 는 자식의 소유 선언이 만든다).
//! - [`relation_def`] — `kind: OneToMany`, `target_table = Child::name()`,
//!   `foreign_key = attr | "{Self base_name}_id"`, `reference_key = Self::primary_key_column()`.
//! - [`hydrate_block`] — `with_*` 플래그가 켜졌을 때 자식 테이블을 부모 pk 리스트로 한 번에
//!   끌어와(N+1 없음) 각 부모 vec 에 분배. push 전 `clear()` 로 재로딩 idempotent.
//!
//! 다대다 관계 `#[postgres(many_to_many)] tags: Vec<RTag>` 하나마다:
//!
//! - 컬럼/제약/insert/FK 세터 **없음** — 링크는 조인테이블이 소유한다.
//! - [`relation_def`] — `kind: ManyToMany`, `foreign_key = from_key`(self 측),
//!   `reference_key = to_key`(target 측), `join_table = Some(유도된 조인테이블명)`.
//!   기본값(런타임 유도): join_table = 정렬된 `[Self, Target] base_name` 결합에
//!   `qualified_name`, from_key = `{Self base_name}_id`, to_key = `{Target base_name}_id`
//!   (모두 attr override 가능). 양쪽 엔티티가 선언하면 정렬 대칭 덕에 **같은** 조인테이블명.
//! - [`join_table_ddl_expr`] — 조인테이블 `CREATE TABLE IF NOT EXISTS`(양쪽 PK FK +
//!   `ON DELETE CASCADE` + 복합 PK); `join_table_ddls()` 에 모인다.
//! - [`ext_trait`] — `{Name}RepositoryExt` 의 `attach_{field}`(`ON CONFLICT DO NOTHING`) /
//!   `detach_{field}` 를 `PostgresRepository<Self>` 에 붙인다.
//! - [`hydrate_block`] — `with_*` 플래그가 켜졌을 때 조인테이블을 부모 pk 로 JOIN 해 한 번에
//!   끌어와 각 부모 vec 에 분배. push 전 `clear()` 로 재로딩 idempotent.
//!
//! 공통: [`loader_method`](lazy `load_*`) · [`with_flag_field`] / [`with_method`]
//! (`{Query}` 플래그 + `with_*()`) 는 두 종류 모두에 생성된다.
//!
//! 소유 관계 target 은 `<#ty as RelationRef>::Target`(매크로가 `Option` 을 텍스트 파싱하지
//! 않음); one_to_many target 은 `Vec<Child>` 의 inner `Child` 를 직접 쓴다(`Vec` 은
//! `RelationRef` impl 이 없음).

use proc_macro2::TokenStream;
use quote::{format_ident, quote};

use super::model::{ColumnModel, RelationModel};

/// 관계의 참조 대상 엔티티 타입. one_to_many 는 `Vec<Child>` 의 inner `Child`,
/// 소유 관계는 `<#ty as RelationRef>::Target`.
fn target_ty(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    match &rel.vec_child {
        Some(child) => quote! { #child },
        None => {
            let ty = &rel.ty;
            quote! { <#ty as #krate::RelationRef>::Target }
        }
    }
}

/// one_to_many FK 컬럼명 런타임 식 (`String`). attr `foreign_key` 리터럴이 있으면 그것,
/// 없으면 `format!("{}_id", <Self as PostgresObject>::base_name())`. 이 식은 관계 없는
/// 비캡처 클로저/hydrate 양쪽에서 쓰이며 `Self` 는 타입 참조라 캡처가 아니다.
fn one_to_many_fk_expr(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    match &rel.foreign_key {
        Some(fk) => quote! { ::std::string::String::from(#fk) },
        None => quote! {
            ::std::format!("{}_id", <Self as #krate::PostgresObject>::base_name())
        },
    }
}

/// reference 컬럼명을 만드는 `String` 식 — override 있으면 그 리터럴, 없으면 런타임에
/// target 의 `primary_key_column()`.
fn reference_key_expr(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let target = target_ty(krate, rel);
    match &rel.reference_key {
        Some(rk) => quote! { ::std::string::String::from(#rk) },
        None => quote! {
            ::std::string::String::from(
                <#target as #krate::PostgresEntity>::primary_key_column()
            )
        },
    }
}

/// FK 컬럼의 `ColumnDef { … }` 리터럴 — `columns()` 의 OnceLock vec 에 합쳐진다.
pub fn fk_column_def(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let ty = &rel.ty;
    let name = rel.fk_column();
    let unique = rel.is_one_to_one();
    let target = target_ty(krate, rel);

    // FK 컬럼 SQL 타입: `type` override 면 Raw, 아니면 target PK 의 sql_type.
    let sql_type = match &rel.sql_type_override {
        Some(raw) => quote! {
            (|| #krate::SqlType::Raw(::std::string::String::from(#raw))) as fn() -> #krate::SqlType
        },
        None => quote! {
            <<#target as #krate::PostgresEntity>::Pk as #krate::PostgresType>::sql_type
        },
    };

    quote! {
        #krate::ColumnDef {
            name: #name,
            sql_type: #sql_type,
            nullable: <#ty as #krate::RelationRef>::NULLABLE,
            unique: #unique,
            index: false,
            version: 0,
            index_version: 0,
            default_sql: (|| ::core::option::Option::None)
                as fn() -> ::core::option::Option<&'static str>,
            primary_key: false,
        }
    }
}

/// `RelationDef { … }` 리터럴 — `relations()` 의 OnceLock vec 에 합쳐진다.
pub fn relation_def(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    if rel.is_one_to_many() {
        return relation_def_one_to_many(krate, rel);
    }
    if rel.is_many_to_many() {
        return relation_def_many_to_many(krate, rel);
    }
    let ty = &rel.ty;
    let field_str = rel.field.to_string();
    let fk = rel.fk_column();
    let unique = rel.is_one_to_one();
    let kind_variant = rel.kind.variant_ident();
    let target = target_ty(krate, rel);
    let ref_key = reference_key_expr(krate, rel);

    quote! {
        #krate::RelationDef {
            field: #field_str,
            kind: #krate::RelationKind::#kind_variant,
            target_table: (|| <#target as #krate::PostgresObject>::name())
                as fn() -> ::std::string::String,
            foreign_key: (|| ::std::string::String::from(#fk))
                as fn() -> ::std::string::String,
            reference_key: (|| #ref_key) as fn() -> ::std::string::String,
            join_table: ::core::option::Option::None,
            nullable: <#ty as #krate::RelationRef>::NULLABLE,
            unique: #unique,
            on_delete: ::core::option::Option::None,
        }
    }
}

/// one_to_many `RelationDef { … }` 리터럴. 부모 컬럼이 없으므로 `foreign_key` 는 자식
/// 테이블의 FK 컬럼명(런타임 식), `reference_key` 는 부모 pk 컬럼(항상 기본; custom
/// reference_key 는 파싱에서 거부됨), `target_table` 은 자식 테이블.
fn relation_def_one_to_many(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let field_str = rel.field.to_string();
    let target = target_ty(krate, rel);
    let fk_expr = one_to_many_fk_expr(krate, rel);

    quote! {
        #krate::RelationDef {
            field: #field_str,
            kind: #krate::RelationKind::OneToMany,
            target_table: (|| <#target as #krate::PostgresObject>::name())
                as fn() -> ::std::string::String,
            foreign_key: (|| #fk_expr) as fn() -> ::std::string::String,
            reference_key: (|| ::std::string::String::from(
                <Self as #krate::PostgresEntity>::primary_key_column()
            )) as fn() -> ::std::string::String,
            join_table: ::core::option::Option::None,
            nullable: false,
            unique: false,
            on_delete: ::core::option::Option::None,
        }
    }
}

/// 스칼라 FK-only 컬럼(`#[postgres(references = …)]`)의 `RelationDef` 리터럴 —
/// `kind: ForeignKey`. 컬럼 자체는 그대로 스칼라라 별도 FK 컬럼을 합성하지 않는다:
/// `foreign_key` 는 스칼라 컬럼명 자신, `reference_key` 는 참조 대상 컬럼, `target_table`
/// 은 `qualified_name(fk_table)`(POSTGRES_PREFIX 설정 시 prefix 반영, 없으면 리터럴 —
/// asset-storage 대응). `nullable` 은 컬럼 타입의 `PostgresType::nullable()`(Option → true).
/// with_*/load_*/hydrate/insert 는 생성하지 않는다 — 스칼라가 스스로 바인딩한다.
/// `fk` 가 없는 컬럼은 `None`.
pub fn scalar_fk_relation_def(krate: &syn::Path, col: &ColumnModel) -> Option<TokenStream> {
    let fk = col.fk.as_ref()?;
    let field_str = col.field.to_string();
    let column = &col.column;
    let ty = &col.ty;
    let fk_table = &fk.table;
    let fk_column = &fk.column;
    let on_delete = match &fk.on_delete {
        Some(od) => quote! { ::core::option::Option::Some(#od) },
        None => quote! { ::core::option::Option::None },
    };

    Some(quote! {
        #krate::RelationDef {
            field: #field_str,
            kind: #krate::RelationKind::ForeignKey,
            target_table: (|| #krate::ident::qualified_name(#fk_table))
                as fn() -> ::std::string::String,
            foreign_key: (|| ::std::string::String::from(#column))
                as fn() -> ::std::string::String,
            reference_key: (|| ::std::string::String::from(#fk_column))
                as fn() -> ::std::string::String,
            join_table: ::core::option::Option::None,
            nullable: <#ty as #krate::PostgresType>::nullable(),
            unique: false,
            on_delete: #on_delete,
        }
    })
}

// ── many_to_many 규약 유도 런타임 식 ──────────────────────────────────────────
//
// `self_ty` 로 self 타입 토큰을 받는다: `relations()`/`hydrate`/`join_table_ddls` 안에서는
// `Self`(= 엔티티), 확장 트레이트 impl(수신자가 repository) 안에서는 concrete `#ident`.

/// 조인테이블명 `String` 식. override 있으면 `qualified_name(#lit)`, 없으면 정렬된
/// `[Self base_name, Target base_name]` 결합에 `qualified_name` 적용 (양쪽 대칭 → 동일 이름).
fn m2m_join_expr(krate: &syn::Path, rel: &RelationModel, self_ty: &TokenStream) -> TokenStream {
    match &rel.join_table {
        Some(name) => quote! { #krate::ident::qualified_name(#name) },
        None => {
            let target = target_ty(krate, rel);
            quote! {
                {
                    let mut __v = [
                        <#self_ty as #krate::PostgresObject>::base_name(),
                        <#target as #krate::PostgresObject>::base_name(),
                    ];
                    __v.sort();
                    #krate::ident::qualified_name(&::std::format!("{}_{}", __v[0], __v[1]))
                }
            }
        }
    }
}

/// from_key 컬럼명 `String` 식 (조인테이블의 self 측 컬럼). override 없으면
/// `{Self base_name}_id`.
fn m2m_from_key_expr(krate: &syn::Path, rel: &RelationModel, self_ty: &TokenStream) -> TokenStream {
    match &rel.from_key {
        Some(k) => quote! { ::std::string::String::from(#k) },
        None => quote! {
            ::std::format!("{}_id", <#self_ty as #krate::PostgresObject>::base_name())
        },
    }
}

/// to_key 컬럼명 `String` 식 (조인테이블의 target 측 컬럼). override 없으면
/// `{Target base_name}_id`.
fn m2m_to_key_expr(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    match &rel.to_key {
        Some(k) => quote! { ::std::string::String::from(#k) },
        None => {
            let target = target_ty(krate, rel);
            quote! {
                ::std::format!("{}_id", <#target as #krate::PostgresObject>::base_name())
            }
        }
    }
}

/// many_to_many `RelationDef { … }`. 부모 컬럼 없음. `foreign_key = from_key`(self 측),
/// `reference_key = to_key`(target 측), `join_table = Some(유도된 조인테이블명)`. 이 엔트리
/// 하나가 조인테이블 DDL·attach/detach·hydrate 의 컬럼명 단일 소스다.
fn relation_def_many_to_many(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let field_str = rel.field.to_string();
    let target = target_ty(krate, rel);
    let self_ty = quote! { Self };
    let from_key = m2m_from_key_expr(krate, rel, &self_ty);
    let to_key = m2m_to_key_expr(krate, rel);
    let join = m2m_join_expr(krate, rel, &self_ty);

    quote! {
        #krate::RelationDef {
            field: #field_str,
            kind: #krate::RelationKind::ManyToMany,
            target_table: (|| <#target as #krate::PostgresObject>::name())
                as fn() -> ::std::string::String,
            foreign_key: (|| #from_key) as fn() -> ::std::string::String,
            reference_key: (|| #to_key) as fn() -> ::std::string::String,
            join_table: ::core::option::Option::Some(
                (|| #join) as fn() -> ::std::string::String
            ),
            nullable: false,
            unique: false,
            on_delete: ::core::option::Option::None,
        }
    }
}

/// many_to_many 조인테이블 `Ddl` 런타임 값 — `join_table_ddls()` 가 m2m 필드마다 하나씩
/// 모은다. self/target PK 컬럼을 FK 로 참조(`ON DELETE CASCADE`)하고 (from,to) 복합 PK 를
/// 건다. `CREATE TABLE IF NOT EXISTS` 라 양쪽 엔티티가 같은 조인테이블을 emit 해도 멱등.
/// PK 의 SQL 타입은 런타임에 `<Pk as PostgresType>::sql_type().to_sql()` 로 얻는다.
pub fn join_table_ddl_expr(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let self_ty = quote! { Self };
    let target = target_ty(krate, rel);
    let from_key = m2m_from_key_expr(krate, rel, &self_ty);
    let to_key = m2m_to_key_expr(krate, rel);
    let join = m2m_join_expr(krate, rel, &self_ty);

    quote! {
        {
            let __join: ::std::string::String = #join;
            let __from: ::std::string::String = #from_key;
            let __to: ::std::string::String = #to_key;
            let __self_tbl = <#self_ty as #krate::PostgresObject>::name();
            let __target_tbl = <#target as #krate::PostgresObject>::name();
            let __self_pk = <#self_ty as #krate::PostgresEntity>::primary_key_column();
            let __target_pk = <#target as #krate::PostgresEntity>::primary_key_column();
            let __self_pk_ty =
                <<#self_ty as #krate::PostgresEntity>::Pk as #krate::PostgresType>::sql_type()
                    .to_sql();
            let __target_pk_ty =
                <<#target as #krate::PostgresEntity>::Pk as #krate::PostgresType>::sql_type()
                    .to_sql();
            #krate::Ddl {
                create: ::std::vec![
                    ::std::format!(
                        "CREATE TABLE IF NOT EXISTS \"{join}\" (\
                         \"{from}\" {fty} NOT NULL REFERENCES \"{st}\"(\"{spk}\") ON DELETE CASCADE, \
                         \"{to}\" {tty} NOT NULL REFERENCES \"{tt}\"(\"{tpk}\") ON DELETE CASCADE, \
                         PRIMARY KEY (\"{from}\", \"{to}\"))",
                        join = __join,
                        from = __from,
                        to = __to,
                        fty = __self_pk_ty,
                        tty = __target_pk_ty,
                        st = __self_tbl,
                        spk = __self_pk,
                        tt = __target_tbl,
                        tpk = __target_pk,
                    ),
                ],
                post_create: ::std::vec::Vec::new(),
                drop: ::std::vec![
                    ::std::format!("DROP TABLE IF EXISTS \"{join}\" CASCADE", join = __join),
                ],
                versioned: ::core::option::Option::None,
            }
        }
    }
}

/// many_to_many 확장 트레이트 `{Name}RepositoryExt` + `impl … for PostgresRepository<#ident>`.
/// m2m 필드마다 `attach_{field}`(`INSERT … ON CONFLICT DO NOTHING`) / `detach_{field}`
/// (`DELETE …`) 를 생성한다. tx-bound repo 클론에서도 그대로 그 tx 로 나간다(`self.db()`).
pub fn ext_trait(
    krate: &syn::Path,
    ident: &syn::Ident,
    vis: &syn::Visibility,
    m2m: &[&RelationModel],
) -> TokenStream {
    if m2m.is_empty() {
        return TokenStream::new();
    }
    let trait_ident = format_ident!("{}RepositoryExt", ident);
    let self_ty = quote! { #ident };

    let mut decls = Vec::new();
    let mut impls = Vec::new();
    for rel in m2m {
        let attach = rel.attach_ident();
        let detach = rel.detach_ident();
        let target = target_ty(krate, rel);
        let from_key = m2m_from_key_expr(krate, rel, &self_ty);
        let to_key = m2m_to_key_expr(krate, rel);
        let join = m2m_join_expr(krate, rel, &self_ty);

        decls.push(quote! {
            fn #attach(
                &self,
                from: <#ident as #krate::PostgresEntity>::Pk,
                to: <#target as #krate::PostgresEntity>::Pk,
            ) -> impl ::core::future::Future<Output = #krate::Result<()>> + ::core::marker::Send;

            fn #detach(
                &self,
                from: <#ident as #krate::PostgresEntity>::Pk,
                to: <#target as #krate::PostgresEntity>::Pk,
            ) -> impl ::core::future::Future<Output = #krate::Result<()>> + ::core::marker::Send;
        });

        impls.push(quote! {
            async fn #attach(
                &self,
                from: <#ident as #krate::PostgresEntity>::Pk,
                to: <#target as #krate::PostgresEntity>::Pk,
            ) -> #krate::Result<()> {
                let __join: ::std::string::String = #join;
                let __from: ::std::string::String = #from_key;
                let __to: ::std::string::String = #to_key;
                let mut __qb = #krate::sqlx::QueryBuilder::<#krate::sqlx::Postgres>::new(
                    ::std::format!(
                        "INSERT INTO \"{j}\" (\"{f}\", \"{t}\") VALUES (",
                        j = __join, f = __from, t = __to,
                    ),
                );
                let __vf: #krate::Value = ::core::convert::Into::into(from);
                __vf.push_bind(&mut __qb);
                __qb.push(", ");
                let __vt: #krate::Value = ::core::convert::Into::into(to);
                __vt.push_bind(&mut __qb);
                __qb.push(") ON CONFLICT DO NOTHING");
                #krate::PostgresRepository::<#ident>::db(self).execute(__qb).await?;
                ::core::result::Result::Ok(())
            }

            async fn #detach(
                &self,
                from: <#ident as #krate::PostgresEntity>::Pk,
                to: <#target as #krate::PostgresEntity>::Pk,
            ) -> #krate::Result<()> {
                let __join: ::std::string::String = #join;
                let __from: ::std::string::String = #from_key;
                let __to: ::std::string::String = #to_key;
                let mut __qb = #krate::sqlx::QueryBuilder::<#krate::sqlx::Postgres>::new(
                    ::std::format!("DELETE FROM \"{j}\" WHERE \"{f}\" = ", j = __join, f = __from),
                );
                let __vf: #krate::Value = ::core::convert::Into::into(from);
                __vf.push_bind(&mut __qb);
                __qb.push(::std::format!(" AND \"{t}\" = ", t = __to));
                let __vt: #krate::Value = ::core::convert::Into::into(to);
                __vt.push_bind(&mut __qb);
                #krate::PostgresRepository::<#ident>::db(self).execute(__qb).await?;
                ::core::result::Result::Ok(())
            }
        });
    }

    quote! {
        #vis trait #trait_ident {
            #( #decls )*
        }

        #[automatically_derived]
        impl #trait_ident for #krate::PostgresRepository<#ident> {
            #( #impls )*
        }
    }
}

/// `insert_values()` 에 더할 `(fk_col, Value)` 튜플. reference override 는
/// `RelationRef::fk_value` 에 `Some(col)` 로 넘겨 custom 컬럼 값을 바인딩한다.
pub fn insert_value(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let field = &rel.field;
    let fk = rel.fk_column();
    let reference_opt = match &rel.reference_key {
        Some(rk) => quote! { ::core::option::Option::Some(#rk) },
        None => quote! { ::core::option::Option::None },
    };
    quote! {
        (#fk, #krate::RelationRef::fk_value(&self.#field, #reference_opt))
    }
}

/// `hydrate()` 안, 이 관계 하나의 배치 2차 쿼리 블록. `with_*` 플래그가 켜졌을 때만
/// 실행되고, 부모 pk 리스트로 target 을 JOIN-on-self 로 끌어와 필드에 대입한다.
///
/// `s."{pk}" AS __parent_key` 별칭은 target 컬럼과 이름 충돌하면 안 된다 — `__parent_key`
/// 라는 컬럼을 문자 그대로 가진 엔티티는 v1 에서 미지원(허용된 제약).
pub fn hydrate_block(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    if rel.is_one_to_many() {
        return hydrate_block_one_to_many(krate, rel);
    }
    if rel.is_many_to_many() {
        return hydrate_block_many_to_many(krate, rel);
    }
    let field = &rel.field;
    let with_flag = rel.with_ident();
    let fk = rel.fk_column();
    let target = target_ty(krate, rel);
    let ref_key = reference_key_expr(krate, rel);

    quote! {
        if query.#with_flag {
            let __self_table = <Self as #krate::PostgresObject>::name();
            let __target_table = <#target as #krate::PostgresObject>::name();
            let __pk_col = <Self as #krate::PostgresEntity>::primary_key_column();
            let __fk_col: &str = #fk;
            let __ref_col: ::std::string::String = #ref_key;
            let __target_columns = <#target as #krate::PostgresEntity>::select_columns(
                ::core::option::Option::Some("t")
            );

            let mut __qb = #krate::sqlx::QueryBuilder::<#krate::sqlx::Postgres>::new(
                ::std::format!(
                    "SELECT s.\"{pk}\" AS __parent_key, {columns} FROM \"{tt}\" t \
                     JOIN \"{st}\" s ON s.\"{fk}\" = t.\"{rc}\" WHERE s.\"{pk}\" IN (",
                    pk = __pk_col,
                    tt = __target_table,
                    st = __self_table,
                    fk = __fk_col,
                    rc = __ref_col,
                    columns = __target_columns,
                ),
            );
            let mut __first = true;
            for __item in items.iter() {
                if !__first {
                    __qb.push(", ");
                }
                __first = false;
                let __k: #krate::Value = ::core::convert::Into::into(
                    #krate::PostgresEntity::primary_key(__item),
                );
                __k.push_bind(&mut __qb);
            }
            __qb.push(")");

            let __rows = db.fetch_all(__qb).await?;
            for __row in &__rows {
                let __parent: <Self as #krate::PostgresEntity>::Pk =
                    #krate::sqlx::Row::try_get(__row, "__parent_key")?;
                let __child = <#target as #krate::PostgresEntity>::from_pg_row(__row)?;
                if let ::core::option::Option::Some(__it) = items
                    .iter_mut()
                    .find(|__i| #krate::PostgresEntity::primary_key(&**__i) == __parent)
                {
                    #krate::RelationAssign::assign(&mut __it.#field, __child);
                }
            }
        }
    }
}

/// one_to_many hydrate 블록. `with_*` 플래그가 켜졌을 때 자식 테이블을 부모 pk 리스트로
/// 한 번(single query)에 끌어와 각 부모 vec 에 분배한다 — N+1 없음. push 전에 각 부모의
/// vec 을 `clear()` 해 재로딩(load_* 재호출)이 중복을 만들지 않게 한다(idempotent).
///
/// 자식 행의 FK 컬럼값이 부모 pk 이므로 `try_get::<Self::Pk>(fk_col)` 로 부모 키를 읽어
/// `primary_key()` 와 매칭한다. custom reference_key(자식 FK 가 부모 pk 타입이 아닐 수
/// 있음)는 파싱 단계에서 거부되므로 여기선 항상 pk 매칭이 안전하다.
fn hydrate_block_one_to_many(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let field = &rel.field;
    let with_flag = rel.with_ident();
    let target = target_ty(krate, rel);
    let fk_expr = one_to_many_fk_expr(krate, rel);

    quote! {
        if query.#with_flag {
            // 재로딩 idempotent: 채우기 전에 각 부모의 vec 을 비운다.
            for __p in items.iter_mut() {
                __p.#field.clear();
            }

            let __child_table = <#target as #krate::PostgresObject>::name();
            let __fk_col: ::std::string::String = #fk_expr;
            let __child_columns = <#target as #krate::PostgresEntity>::select_columns(
                ::core::option::Option::Some("c")
            );

            let mut __qb = #krate::sqlx::QueryBuilder::<#krate::sqlx::Postgres>::new(
                ::std::format!(
                    "SELECT {columns} FROM \"{ct}\" c WHERE c.\"{fk}\" IN (",
                    ct = __child_table,
                    fk = __fk_col,
                    columns = __child_columns,
                ),
            );
            let mut __first = true;
            for __item in items.iter() {
                if !__first {
                    __qb.push(", ");
                }
                __first = false;
                let __k: #krate::Value = ::core::convert::Into::into(
                    #krate::PostgresEntity::primary_key(__item),
                );
                __k.push_bind(&mut __qb);
            }
            __qb.push(")");

            let __rows = db.fetch_all(__qb).await?;
            for __row in &__rows {
                let __key: <Self as #krate::PostgresEntity>::Pk =
                    #krate::sqlx::Row::try_get(__row, __fk_col.as_str())?;
                let __child = <#target as #krate::PostgresEntity>::from_pg_row(__row)?;
                if let ::core::option::Option::Some(__it) = items
                    .iter_mut()
                    .find(|__i| #krate::PostgresEntity::primary_key(&**__i) == __key)
                {
                    __it.#field.push(__child);
                }
            }
        }
    }
}

/// many_to_many hydrate 블록. `with_*` 플래그가 켜졌을 때 조인테이블을 부모 pk 리스트로
/// 한 번(single query)에 JOIN 해 각 부모 vec 에 분배한다 — N+1 없음. push 전 각 부모의
/// vec 을 `clear()` 해 재로딩 idempotent.
///
/// `j."{from_key}" AS __parent_key` 로 부모 키(= Self::Pk)를 읽고, target 은 조인테이블의
/// `to_key` 로 JOIN 해 target의 명시적 컬럼을 `from_pg_row` 한다. `__parent_key` 라는 컬럼을 문자 그대로
/// 가진 target 은 v1 미지원(one_to_many/소유 관계와 동일한 허용 제약).
fn hydrate_block_many_to_many(krate: &syn::Path, rel: &RelationModel) -> TokenStream {
    let field = &rel.field;
    let with_flag = rel.with_ident();
    let target = target_ty(krate, rel);
    let self_ty = quote! { Self };
    let from_key = m2m_from_key_expr(krate, rel, &self_ty);
    let to_key = m2m_to_key_expr(krate, rel);
    let join = m2m_join_expr(krate, rel, &self_ty);

    quote! {
        if query.#with_flag {
            // 재로딩 idempotent: 채우기 전에 각 부모의 vec 을 비운다.
            for __p in items.iter_mut() {
                __p.#field.clear();
            }

            let __join: ::std::string::String = #join;
            let __from: ::std::string::String = #from_key;
            let __to: ::std::string::String = #to_key;
            let __target_table = <#target as #krate::PostgresObject>::name();
            let __target_pk = <#target as #krate::PostgresEntity>::primary_key_column();
            let __target_columns = <#target as #krate::PostgresEntity>::select_columns(
                ::core::option::Option::Some("t")
            );

            let mut __qb = #krate::sqlx::QueryBuilder::<#krate::sqlx::Postgres>::new(
                ::std::format!(
                    "SELECT j.\"{from}\" AS __parent_key, {columns} FROM \"{join}\" j \
                     JOIN \"{tt}\" t ON t.\"{tpk}\" = j.\"{to}\" WHERE j.\"{from}\" IN (",
                    from = __from,
                    join = __join,
                    tt = __target_table,
                    tpk = __target_pk,
                    to = __to,
                    columns = __target_columns,
                ),
            );
            let mut __first = true;
            for __item in items.iter() {
                if !__first {
                    __qb.push(", ");
                }
                __first = false;
                let __k: #krate::Value = ::core::convert::Into::into(
                    #krate::PostgresEntity::primary_key(__item),
                );
                __k.push_bind(&mut __qb);
            }
            __qb.push(")");

            let __rows = db.fetch_all(__qb).await?;
            for __row in &__rows {
                let __parent: <Self as #krate::PostgresEntity>::Pk =
                    #krate::sqlx::Row::try_get(__row, "__parent_key")?;
                let __child = <#target as #krate::PostgresEntity>::from_pg_row(__row)?;
                if let ::core::option::Option::Some(__it) = items
                    .iter_mut()
                    .find(|__i| #krate::PostgresEntity::primary_key(&**__i) == __parent)
                {
                    __it.#field.push(__child);
                }
            }
        }
    }
}

/// lazy 로더 `pub async fn load_{field}(&mut self, repo) -> Result<()>`.
/// tx-bound repo 를 넘기면 로딩도 같은 트랜잭션으로 나간다(`repo.db()`).
pub fn loader_method(krate: &syn::Path, vis: &syn::Visibility, rel: &RelationModel) -> TokenStream {
    let loader = rel.loader_ident();
    let with = rel.with_ident();
    quote! {
        #vis async fn #loader(
            &mut self,
            repo: &#krate::PostgresRepository<Self>,
        ) -> #krate::Result<()> {
            <Self as #krate::PostgresEntity>::hydrate(
                repo.db(),
                ::core::slice::from_mut(self),
                &<Self as #krate::PostgresEntity>::query().#with(),
            )
            .await
        }
    }
}

/// `{Query}` 구조체의 eager 플래그 필드 `with_{field}: bool`.
pub fn with_flag_field(rel: &RelationModel) -> TokenStream {
    let with = rel.with_ident();
    quote! { #with: bool }
}

/// `{Query}` 의 `with_{field}(self) -> Self` — 플래그를 켠다. 필드와 동명이지만
/// 필드/메서드는 별개 네임스페이스라 충돌하지 않는다.
pub fn with_method(vis: &syn::Visibility, rel: &RelationModel) -> TokenStream {
    let with = rel.with_ident();
    quote! {
        #vis fn #with(mut self) -> Self {
            self.#with = true;
            self
        }
    }
}

/// `{Update}` 의 FK 스칼라 세터 `fn {fk_col}(self, v: TargetPk) -> Self`.
///
/// **오직 기본 reference(`reference_key` 미지정, FK → target PK)에서만 생성한다.**
/// `reference_key` 를 override 한 관계는 FK 컬럼이 target 의 `Pk` 타입이 아니라
/// `type = "..."` 로 명시한 임의의 SQL 타입(예: `owner_email TEXT` → target PK 는
/// `Uuid`)을 갖는다. 매크로는 그 컬럼의 러스트 타입을 알 방법이 없으므로 세터를
/// `<Target as PostgresEntity>::Pk` 로 잘못 타이핑해 생성하면 컴파일은 되지만 값
/// 바인딩이 항상 틀린 SQL 타입(Uuid → TEXT 등)으로 나가 런타임에만 실패한다.
/// 그래서 custom reference_key 관계는 세터를 아예 생성하지 않는다 — 해당 컬럼은
/// 현재 `{Update}` 표면에서 세팅할 수 없다(v1 제약, 필요해지면 correct 타입을 별도
/// attr 로 받아 재도입).
pub fn fk_setter(krate: &syn::Path, vis: &syn::Visibility, rel: &RelationModel) -> TokenStream {
    if rel.reference_key.is_some() {
        return TokenStream::new();
    }
    let fk_ident = rel.fk_ident();
    let fk = rel.fk_column();
    let target = target_ty(krate, rel);
    quote! {
        #vis fn #fk_ident(
            mut self,
            v: <#target as #krate::PostgresEntity>::Pk,
        ) -> Self {
            self.set.push(#fk, ::core::convert::Into::into(v));
            self
        }
    }
}
