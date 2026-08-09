use crate::Result;
use crate::object::{Ddl, PostgresObject};
use crate::ops::{BoolOp, NumOp, OpLower, StringOp, UuidOp};
use crate::query::{AsQuerySpec, AsUpdateSet};
use crate::value::Value;

/// 컬럼의 PostgreSQL SQL 타입.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SqlType {
    Text,
    Uuid,
    SmallInt,
    Int,
    BigInt,
    Real,
    DoublePrecision,
    Boolean,
    TimestampTz,
    JsonB,
    /// PG enum 타입명 (prefix 적용됨) — 쿼팅되어 렌더된다.
    Enum(String),
    /// 원문 그대로 사용할 커스텀 타입.
    Raw(String),
}

impl SqlType {
    pub fn to_sql(&self) -> String {
        match self {
            SqlType::Text => "TEXT".to_string(),
            SqlType::Uuid => "UUID".to_string(),
            SqlType::SmallInt => "SMALLINT".to_string(),
            SqlType::Int => "INT".to_string(),
            SqlType::BigInt => "BIGINT".to_string(),
            SqlType::Real => "REAL".to_string(),
            SqlType::DoublePrecision => "DOUBLE PRECISION".to_string(),
            SqlType::Boolean => "BOOLEAN".to_string(),
            SqlType::TimestampTz => "TIMESTAMPTZ".to_string(),
            SqlType::JsonB => "JSONB".to_string(),
            SqlType::Enum(n) => format!("\"{n}\""),
            SqlType::Raw(s) => s.clone(),
        }
    }
}

/// Rust 스칼라 타입 → PostgreSQL 컬럼 매핑 + 그 컬럼에 적용 가능한 연산자(Op).
pub trait PostgresType {
    type Op: OpLower;
    fn sql_type() -> SqlType;
    fn nullable() -> bool {
        false
    }
    /// 기존 행과 이전 INSERT가 생략한 새 non-null 컬럼을 채울 수 있는 안전한 DB 기본값.
    /// 도메인 의미를 일반화할 수 없는 타입은 `None`이며, 필드에 `sql_default`를 명시해야
    /// 버전형 컬럼 추가에 사용할 수 있다.
    fn migration_default_sql() -> Option<&'static str> {
        None
    }
    /// enum/json 타입처럼 컬럼 정의 전에 먼저 존재해야 하는 의존 DDL (없으면 None).
    fn dependency_ddl() -> Option<Ddl> {
        None
    }
}

impl PostgresType for String {
    type Op = StringOp;
    fn sql_type() -> SqlType {
        SqlType::Text
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("''")
    }
}

impl PostgresType for i16 {
    type Op = NumOp<i16>;
    fn sql_type() -> SqlType {
        SqlType::SmallInt
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("0")
    }
}

impl PostgresType for i32 {
    type Op = NumOp<i32>;
    fn sql_type() -> SqlType {
        SqlType::Int
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("0")
    }
}

impl PostgresType for i64 {
    type Op = NumOp<i64>;
    fn sql_type() -> SqlType {
        SqlType::BigInt
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("0")
    }
}

impl PostgresType for f32 {
    type Op = NumOp<f32>;
    fn sql_type() -> SqlType {
        SqlType::Real
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("0")
    }
}

impl PostgresType for f64 {
    type Op = NumOp<f64>;
    fn sql_type() -> SqlType {
        SqlType::DoublePrecision
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("0")
    }
}

impl PostgresType for bool {
    type Op = BoolOp;
    fn sql_type() -> SqlType {
        SqlType::Boolean
    }
    fn migration_default_sql() -> Option<&'static str> {
        Some("FALSE")
    }
}

impl PostgresType for uuid::Uuid {
    type Op = UuidOp;
    fn sql_type() -> SqlType {
        SqlType::Uuid
    }
}

impl PostgresType for chrono::DateTime<chrono::Utc> {
    type Op = NumOp<Self>;
    fn sql_type() -> SqlType {
        SqlType::TimestampTz
    }
}

impl<T: PostgresType> PostgresType for Option<T> {
    type Op = T::Op;
    fn sql_type() -> SqlType {
        T::sql_type()
    }
    fn nullable() -> bool {
        true
    }
    fn dependency_ddl() -> Option<Ddl> {
        T::dependency_ddl()
    }
}

/// PG enum 타입 메타데이터 — `#[derive(PostgresEnum)]` (Task 8) 가 구현을 생성한다.
pub trait PostgresEnumMeta {
    /// prefix 적용된 최종 SQL 타입명.
    fn pg_type_name() -> String;
    /// 이 variant 의 PG 라벨(문자열) 값. unit 변형은 `'static` 상수(무할당),
    /// text 모드의 단일 catch-all 변형(예: `Unknown(String)`)은 담긴 원문을 반환하므로
    /// `Cow` 로 둘을 모두 표현한다.
    fn pg_label(&self) -> std::borrow::Cow<'static, str>;
    /// native enum의 현재 라벨과 도입 버전. TEXT 모드는 빈 슬라이스를 반환한다.
    fn variants() -> &'static [EnumVariantDef] {
        &[]
    }
}

/// native PostgreSQL enum 라벨 메타데이터. version을 생략한 현재 라벨은 기준선 v0이다.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EnumVariantDef {
    pub label: &'static str,
    pub version: u64,
}

/// 컬럼 정의 — `#[derive(PostgresEntity)]` (Task 9) 가 생성한다.
///
/// REFERENCES 정보는 여기 두지 않는다 — `relations()`가 단일 소스다(spec 참조).
pub struct ColumnDef {
    pub name: &'static str,
    /// enum prefix 해석을 런타임으로 지연; 렌더는 `SqlType::to_sql()`.
    pub sql_type: fn() -> SqlType,
    pub nullable: bool,
    pub unique: bool,
    pub index: bool,
    /// 필드가 기존 테이블에 추가되는 버전. 속성을 생략한 현재 필드는 기준선 v0이다.
    pub version: u64,
    /// 일반 인덱스를 기존 테이블에 추가하는 버전. bare `index`는 필드 버전을 상속한다.
    pub index_version: u64,
    /// 필드의 명시적 `sql_default` 또는 타입의 기본 migration default.
    pub default_sql: fn() -> Option<&'static str>,
    pub primary_key: bool,
}

/// 관계의 카디널리티.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RelationKind {
    OneToOne,
    ManyToOne,
    OneToMany,
    ManyToMany,
    /// 로드되지 않는 제약 전용 FK — 스칼라 컬럼이 `#[postgres(references = …)]`
    /// (또는 `foreign_key = …`)로 FK 제약만 갖는 경우. 관계 필드가 아니므로
    /// with_*/load_*/hydrate/insert 바인딩은 생성되지 않는다 (스칼라가 스스로 바인딩).
    /// DDL 에서는 소유 관계처럼 REFERENCES 를 렌더한다.
    ForeignKey,
}

/// attribute 파싱 결과의 구조화 노출 — DDL·hydrate·(future) join 빌더의 단일 소스.
/// 슬롯 의미는 spec "관계 메타데이터" 표 참조 (foreign_key≅from_key, reference_key≅to_key).
pub struct RelationDef {
    pub field: &'static str,
    pub kind: RelationKind,
    pub target_table: fn() -> String,
    pub foreign_key: fn() -> String,
    pub reference_key: fn() -> String,
    pub join_table: Option<fn() -> String>,
    pub nullable: bool,
    pub unique: bool,
    /// FK 제약의 `ON DELETE {…}` SQL 조각 (예: "SET NULL", "CASCADE"). `None` 이면
    /// ON DELETE 절을 렌더하지 않는다. 스칼라 FK(references) 에서 주로 채워지지만
    /// 모든 소유 관계가 담을 수 있는 슬롯이다.
    pub on_delete: Option<&'static str>,
}

/// 소유(pk-side) 엔티티 → 그 테이블의 행을 표현하는 타입.
///
/// `#[derive(PostgresEntity)]` (Task 9)가 `columns()`/`relations()`/`from_pg_row()`/
/// `insert_values()`/`value_of()`/`enum_dependencies()`/`join_table_ddls()`/`hydrate()`를
/// 생성한다 — 수기 구현 금지.
pub trait PostgresEntity: PostgresObject + Sized + Send + Sync + Unpin + 'static {
    type Pk: Into<Value>
        + Clone
        + PartialEq
        + Send
        + Sync
        + Unpin
        + for<'r> sqlx::Decode<'r, sqlx::Postgres>
        + sqlx::Type<sqlx::Postgres>;
    type Query: AsQuerySpec + Default + Send + Sync;
    type Update: AsUpdateSet + Default + Send;

    fn table_name() -> String {
        <Self as PostgresObject>::name()
    }
    fn primary_key_column() -> &'static str {
        "id"
    }
    fn primary_key(&self) -> Self::Pk;
    fn query() -> Self::Query {
        Default::default()
    }
    fn update() -> Self::Update {
        Default::default()
    }

    // ── derive 생성 (doc(hidden); 수기 구현 금지) ──
    fn columns() -> &'static [ColumnDef];
    /// repository가 wildcard 결과를 만들지 않도록 사용하는 명시적 컬럼 목록.
    fn select_columns(alias: Option<&str>) -> String {
        Self::columns()
            .iter()
            .map(|column| match alias {
                Some(alias) => format!("{alias}.\"{}\"", column.name),
                None => format!("\"{}\"", column.name),
            })
            .collect::<Vec<_>>()
            .join(", ")
    }
    fn relations() -> &'static [RelationDef] {
        &[]
    }
    /// struct-level `#[postgres(unique(a, b, …))]` 복합 UNIQUE 그룹들 — 각 그룹은
    /// 컬럼명의 순서 있는 슬라이스다. `build_create_table` 이 그룹마다
    /// `CREATE UNIQUE INDEX` 를 하나씩 방출한다. 복합 UNIQUE 가 없으면 빈 슬라이스.
    fn composite_uniques() -> &'static [&'static [&'static str]] {
        &[]
    }
    fn from_pg_row(row: &sqlx::postgres::PgRow) -> Result<Self>;
    /// (컬럼, 값) — pk 는 init_pk 적용, 소유 FK 는 RelationRef::fk_value.
    fn insert_values(&self) -> Vec<(&'static str, Value)>;
    /// custom reference_key 바인딩용 스칼라 컬럼 접근자.
    fn value_of(&self, column: &'static str) -> Option<Value>;
    /// 컬럼 dependency_ddl 수집 (enum CREATE TYPE 류) — 테이블 생성 전 실행.
    fn enum_dependencies() -> Vec<Ddl> {
        Vec::new()
    }
    /// m2m 조인테이블 Ddl — 참조 대상 테이블 생성 후 실행.
    fn join_table_ddls() -> Vec<Ddl> {
        Vec::new()
    }
    /// eager 로딩 훅 — Query 의 with_* 플래그 소비.
    /// Db 는 pool/tx 를 추상화한 실행 컨텍스트(Task 6) — tx-bound repo 의
    /// find 에서 호출되면 hydrate 쿼리도 같은 tx 로 나간다.
    fn hydrate(
        db: &crate::repository::Db,
        items: &mut [Self],
        query: &Self::Query,
    ) -> impl std::future::Future<Output = Result<()>> + Send;
}

/// 소유 관계 필드(`T` / `Option<T>`)의 FK 값·nullability 통일.
pub trait RelationRef {
    type Target: PostgresEntity;
    const NULLABLE: bool;
    /// reference: None = 대상 PK, Some(col) = custom reference_key.
    fn fk_value(&self, reference: Option<&'static str>) -> Value;
}

impl<T: PostgresEntity> RelationRef for T {
    type Target = T;
    const NULLABLE: bool = false;

    fn fk_value(&self, reference: Option<&'static str>) -> Value {
        match reference {
            None => self.primary_key().into(),
            Some(col) => self.value_of(col).unwrap_or(Value::Null),
        }
    }
}

impl<T: PostgresEntity> RelationRef for Option<T> {
    type Target = T;
    const NULLABLE: bool = true;

    fn fk_value(&self, reference: Option<&'static str>) -> Value {
        match self {
            None => Value::Null,
            Some(t) => t.fk_value(reference),
        }
    }
}

/// 관계 필드에 hydrate 된 자식을 대입하는 통일 인터페이스 — `T` / `Option<T>` 필드를
/// 매크로가 `Option` 을 텍스트 파싱하지 않고 다룰 수 있게 한다. 두 impl 은 타입 파라미터
/// (`T` vs `Option<T>` 수신자에 대한 `T` 값)가 달라 겹치지 않는다.
///
/// - `T` 필드(`user: RUser`) → `RelationAssign<RUser> for RUser` : `*self = child`
/// - `Option<T>` 필드(`owner: Option<RUser>`) → `RelationAssign<RUser> for Option<RUser>` : `*self = Some(child)`
pub trait RelationAssign<T> {
    fn assign(&mut self, value: T);
}

impl<T> RelationAssign<T> for T {
    fn assign(&mut self, value: T) {
        *self = value;
    }
}

impl<T> RelationAssign<T> for Option<T> {
    fn assign(&mut self, value: T) {
        *self = Some(value);
    }
}
