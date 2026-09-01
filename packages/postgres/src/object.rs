#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ObjectKind {
    /// SQL table (has schema-defined DDL)
    Table,
    /// SQL enum type (custom domain)
    Enum,
    /// Schema-less logical object (JSONB struct type)
    Json,
}

/// 한 스키마 버전에서 실행할 DDL 묶음. `statements` 는 선언 순서대로 실행한다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionedDdl {
    pub version: u64,
    pub statements: Vec<String>,
}

/// 버전 원장에 기록할 단일 DB object 정의.
///
/// 테이블 scope는 prefix가 반영된 최종 테이블명이고, native enum은
/// `enum:{최종 타입명}`을 사용한다. `baseline`은 현재 코드가 기준선 v0에서 기대하는
/// 정규 DDL이며 checksum 입력으로만 사용한다. 빈 DB는 `Ddl::create`로 최신 형태를 바로
/// 만들고, 기존 DB는 `migrations`의 누락된 버전만 적용한다.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VersionedObject {
    pub scope: String,
    pub baseline: Vec<String>,
    pub migrations: Vec<VersionedDdl>,
}

/// CREATE/DROP 문 묶음.
///
/// `create`에는 enum/테이블/조인테이블 본체만 들어가고, 컬럼을 참조하는 인덱스는
/// `post_create`로 분리한다. 이 분리가 기존 테이블의 버전형 `ADD COLUMN`보다 인덱스가
/// 먼저 실행되는 일을 막는다.
#[derive(Debug, Clone, Default)]
pub struct Ddl {
    pub create: Vec<String>,
    pub post_create: Vec<String>,
    pub drop: Vec<String>,
    pub versioned: Option<VersionedObject>,
}

pub trait PostgresObject {
    fn kind() -> ObjectKind;
    /// prefix 적용 전 base 이름 (조인 테이블·FK 기본값 유도용)
    fn base_name() -> &'static str;
    /// prefix + 정규화 적용된 최종 SQL 식별자
    fn name() -> String {
        crate::ident::qualified_name(Self::base_name())
    }
    fn ddl() -> Ddl;
}
