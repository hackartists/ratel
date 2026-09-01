#![doc = include_str!("../README.md")]

pub mod error;
pub use error::{Error, Result};
pub use serde_json;
pub use sqlx;
pub use uuid;

pub use postgres_macros::{PostgresEntity, PostgresEnum, PostgresJson};

/// 모든 `PostgresEntity` 파생 코드가 `#krate::inventory::submit!` 로 스키마 등록을
/// emit 하고, `Schema::from_inventory()` 가 `inventory::iter` 로 수집한다 (M7).
pub use inventory;

pub mod ident;
pub mod object;
pub use object::{Ddl, ObjectKind, PostgresObject, VersionedDdl, VersionedObject};

pub mod value;
pub use value::{Value, init_pk};

pub mod global;
pub use global::set_global_pool;

pub mod key;
pub use key::PgKey;

pub mod cond;
pub mod ops;

pub mod entity;
pub use entity::{
    ColumnDef, EnumVariantDef, PostgresEntity, PostgresEnumMeta, PostgresType, RelationAssign,
    RelationDef, RelationKind, RelationRef, SqlType,
};

pub mod query;
pub use query::{AsQuerySpec, AsUpdateSet, Order, QuerySpec, UpdateSet};

pub mod page;
pub use page::Page;

pub mod col;
pub use col::*;

pub mod repository;
pub use repository::{Db, PostgresRepository, Tx};

pub mod schema;
pub use schema::{
    SCHEMA_MIGRATION_LOCK_ID, SCHEMA_VERSION_TABLE, Schema, SchemaRegistration, build_create_enum,
    build_create_table,
};

/// 자주 함께 쓰이는 트레이트·타입·derive 매크로를 한 번에 들여오는 편의 진입점.
///
/// `use postgres::prelude::*;` 한 줄로 엔티티 정의(derive 3종: `PostgresEntity`/
/// `PostgresEnum`/`PostgresJson`) + 코어 트레이트(`PostgresObject`/`PostgresEntity`/
/// `PostgresType`/`PostgresEnumMeta`) + 관계 표면(`RelationRef`/`RelationAssign`) +
/// 실행/트랜잭션(`Db`/`PostgresRepository`/`Tx`) + 스키마 부트스트랩(`Schema`) +
/// 값/DDL 타입(`Value`/`init_pk`/`SqlType`/`ObjectKind`/`Ddl`) + 쿼리 표면(`Order`/
/// `Col`/컬럼별 확장 트레이트) + 연산자(`ops::*`)까지, 엔티티 정의부터 CRUD/쿼리/
/// 트랜잭션까지 필요한 표면 대부분을 가져온다 (`examples/basic.rs` 참조).
///
/// 크레이트 루트 re-export(`postgres::PostgresEntity` 등, 하위 호환용)는 그대로
/// 유지된다 — 이 모듈은 그 위에 얹은 큐레이션일 뿐, 대체가 아니다.
///
/// `postgres::uuid::Uuid` / `postgres::serde_json` / `postgres::sqlx` 처럼 크레이트
/// 루트가 재노출하는 서드파티 타입·크레이트는 이 prelude 에 포함하지 않는다 — 필요한
/// 곳에서 명시적으로 `use`한다.
pub mod prelude {
    // derive 3종. `PostgresEntity`는 매크로 네임스페이스라 아래의 트레이트
    // `PostgresEntity`와 이름이 겹치지만, 매크로/타입은 서로 다른 네임스페이스라
    // 충돌하지 않는다 (크레이트 루트가 이미 같은 방식으로 두 `PostgresEntity`를
    // 함께 re-export한다).
    pub use crate::{PostgresEnum, PostgresJson};

    // 코어 트레이트(+ `PostgresEntity` derive).
    pub use crate::{PostgresEntity, PostgresEnumMeta, PostgresObject, PostgresType};

    // 관계 표면.
    pub use crate::{RelationAssign, RelationRef};

    // 실행 컨텍스트/트랜잭션 + 스키마 부트스트랩 + 페이지네이션 결과.
    pub use crate::{Db, Page, PostgresRepository, Schema, Tx};

    // 전역 풀 모드(일차 API): 전역 풀 setter + `global` 모듈(pool/try_pool) + 유연한
    // 키 변환 트레이트.
    pub use crate::PgKey;
    pub use crate::global;
    pub use crate::set_global_pool;

    // 값/DDL/컬럼 타입.
    pub use crate::{Ddl, ObjectKind, SqlType, Value, VersionedDdl, VersionedObject, init_pk};

    // 쿼리 표면: 정렬 + 타입 있는 컬럼 참조 + 컬럼별 확장 트레이트.
    pub use crate::{BoolCol, Col, EnumCol, JsonCol, OrdCol, Order, StringCol, UuidCol};

    // 연산자(Op) enum + 낮춤/변환 트레이트 (`StringOp`/`NumOp`/`TimeOp`/`BoolOp`/
    // `UuidOp`/`EnumOp`/`JsonOp`/`OpLower`/`IntoOp`).
    pub use crate::ops::*;
}

/// `docs/*.md` 의 코드 블록을 `cargo test --doc` 의 컴파일 체크 대상으로 만든다.
///
/// 각 파일을 `#[doc = include_str!(...)]` 로 감싼 빈 모듈에 붙이면, rustdoc 이 그
/// 모듈의 doc-comment 로 취급해 안의 코드 펜스를 doctest 로 추출한다 —
/// `#[cfg(doctest)]` 라 일반 빌드에는 전혀 포함되지 않는다.
#[cfg(doctest)]
mod doc_tests {
    macro_rules! doc_check {
        ($name:ident, $path:literal) => {
            #[doc = include_str!($path)]
            mod $name {}
        };
    }
    doc_check!(getting_started, "../docs/getting-started.md");
    doc_check!(entity, "../docs/entity.md");
    doc_check!(enum_doc, "../docs/enum.md");
    doc_check!(json, "../docs/json.md");
    doc_check!(query, "../docs/query.md");
    doc_check!(update, "../docs/update.md");
    doc_check!(relations, "../docs/relations.md");
    doc_check!(transactions, "../docs/transactions.md");
    doc_check!(schema, "../docs/schema.md");
    doc_check!(extending, "../docs/extending.md");
}
