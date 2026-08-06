//! Task 7 — derive 없이 `PostgresObject`/`PostgresEntity` 를 **손으로** 구현한 `MUser`
//! (테이블 `manual_users`)로 Task 2~6 트레이트 표면이 실제 PostgreSQL 에서 동작함을 증명한다.
//!
//! 이 파일은 `#[derive(PostgresEntity)]` (Task 9+) 가 생성해야 할 코드의 **레퍼런스 구현**이다.
//! 매크로는 여기 손으로 쓴 것과 동등한 코드를 뽑아내야 한다.
//!
//! 전체 표면(모든 쿼리 빌더/컬럼/업데이트 세터)을 노출하되 단일 roundtrip 테스트가
//! 그 전부를 소비하지는 않으므로, 미사용 항목은 dead_code 로 허용한다.
#![allow(dead_code)]

mod common;

use postgres::cond::Cond;
use postgres::ops::{BoolOp, IntoOp, NumOp, OpLower, StringOp};
use postgres::sqlx::Row;
use postgres::sqlx::postgres::PgRow;
use postgres::uuid::Uuid;
use postgres::{
    AsQuerySpec, AsUpdateSet, BoolCol, Col, ColumnDef, Db, Ddl, ObjectKind, OrdCol, Order,
    PostgresEntity, PostgresObject, PostgresRepository, PostgresType, QuerySpec, Tx, UpdateSet,
    Value, build_create_table, init_pk,
};

// ─────────────────────────── 엔티티 ───────────────────────────

/// 손으로 구현한 소유 엔티티. 스칼라 4개(pk uuid / text / bigint / boolean).
#[derive(Debug, Clone, PartialEq)]
struct MUser {
    id: Uuid,
    name: String,
    age: i64,
    agreed: bool,
}

/// derive 가 생성할 `columns()` 의 정적 소스.
static COLUMNS: [ColumnDef; 4] = [
    ColumnDef {
        name: "id",
        sql_type: <Uuid as PostgresType>::sql_type,
        nullable: false,
        unique: false,
        index: false,
        primary_key: true,
        version: 0,
        index_version: 0,
        default_sql: || None,
    },
    ColumnDef {
        name: "name",
        sql_type: <String as PostgresType>::sql_type,
        nullable: false,
        unique: false,
        index: false,
        primary_key: false,
        version: 0,
        index_version: 0,
        default_sql: || None,
    },
    ColumnDef {
        name: "age",
        sql_type: <i64 as PostgresType>::sql_type,
        nullable: false,
        unique: false,
        index: false,
        primary_key: false,
        version: 0,
        index_version: 0,
        default_sql: || None,
    },
    ColumnDef {
        name: "agreed",
        sql_type: <bool as PostgresType>::sql_type,
        nullable: false,
        unique: false,
        index: false,
        primary_key: false,
        version: 0,
        index_version: 0,
        default_sql: || None,
    },
];

impl PostgresObject for MUser {
    fn kind() -> ObjectKind {
        ObjectKind::Table
    }
    fn base_name() -> &'static str {
        "manual_users"
    }
    fn ddl() -> Ddl {
        build_create_table(&Self::name(), &COLUMNS, &[], &[])
    }
}

impl PostgresEntity for MUser {
    type Pk = Uuid;
    type Query = MUserQuery;
    type Update = MUserUpdate;

    fn primary_key(&self) -> Uuid {
        self.id
    }

    fn columns() -> &'static [ColumnDef] {
        &COLUMNS
    }

    fn from_pg_row(row: &PgRow) -> postgres::Result<Self> {
        Ok(MUser {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            age: row.try_get("age")?,
            agreed: row.try_get("agreed")?,
        })
    }

    fn insert_values(&self) -> Vec<(&'static str, Value)> {
        vec![
            ("id", init_pk(self.id.into())),
            ("name", self.name.clone().into()),
            ("age", self.age.into()),
            ("agreed", self.agreed.into()),
        ]
    }

    fn value_of(&self, column: &'static str) -> Option<Value> {
        match column {
            "id" => Some(self.id.into()),
            "name" => Some(self.name.clone().into()),
            "age" => Some(self.age.into()),
            "agreed" => Some(self.agreed.into()),
            _ => None,
        }
    }

    // 관계가 없으므로 eager 로딩은 no-op. 트레이트가 `impl Future + Send` 를 요구하므로
    // `async fn` 으로 구현한다 (본문에 await 가 없어 반환 future 는 자명하게 Send).
    async fn hydrate(_db: &Db, _items: &mut [Self], _query: &MUserQuery) -> postgres::Result<()> {
        Ok(())
    }
}

// ─────────────────────────── 쿼리 빌더 ───────────────────────────

/// 컬럼 열거 — `order_by` 대상.
enum MUserColumn {
    Id,
    Name,
    Age,
    Agreed,
}

impl MUserColumn {
    fn as_str(&self) -> &'static str {
        match self {
            MUserColumn::Id => "id",
            MUserColumn::Name => "name",
            MUserColumn::Age => "age",
            MUserColumn::Agreed => "agreed",
        }
    }
}

/// `filter(|c| …)` 클로저에 넘어가는 타입 있는 컬럼 참조 묶음.
struct MUserCols {
    name: Col<String>,
    age: Col<i64>,
    agreed: Col<bool>,
}

impl MUserCols {
    fn new() -> Self {
        MUserCols {
            name: Col::new("name"),
            age: Col::new("age"),
            agreed: Col::new("agreed"),
        }
    }
}

/// 타입 있는 쿼리 빌더 — 컬럼별 Op 진입점 + `filter`/`order_by`/`limit`/`offset`.
#[derive(Default)]
struct MUserQuery {
    spec: QuerySpec,
}

impl MUserQuery {
    fn name(mut self, op: impl IntoOp<StringOp>) -> Self {
        self.spec.conds.push(op.into_op().lower("name"));
        self
    }
    fn age(mut self, op: impl IntoOp<NumOp<i64>>) -> Self {
        self.spec.conds.push(op.into_op().lower("age"));
        self
    }
    fn agreed(mut self, op: impl IntoOp<BoolOp>) -> Self {
        self.spec.conds.push(op.into_op().lower("agreed"));
        self
    }
    fn filter(mut self, f: impl FnOnce(MUserCols) -> Cond) -> Self {
        self.spec.conds.push(f(MUserCols::new()));
        self
    }
    fn order_by(mut self, col: MUserColumn, order: Order) -> Self {
        self.spec.order.push((col.as_str(), order));
        self
    }
    fn limit(mut self, n: i64) -> Self {
        self.spec.limit = Some(n);
        self
    }
    fn offset(mut self, n: i64) -> Self {
        self.spec.offset = Some(n);
        self
    }
}

impl AsQuerySpec for MUserQuery {
    fn spec(&self) -> &QuerySpec {
        &self.spec
    }
}

// ─────────────────────────── 업데이트 세터 ───────────────────────────

/// 타입 있는 부분 업데이트 빌더 — 세팅한 컬럼만 SET 절에 실린다.
#[derive(Default)]
struct MUserUpdate {
    set: UpdateSet,
}

impl MUserUpdate {
    fn name(mut self, v: impl Into<String>) -> Self {
        self.set.push("name", Value::Text(v.into()));
        self
    }
    fn age(mut self, v: i64) -> Self {
        self.set.push("age", Value::I64(v));
        self
    }
    fn agreed(mut self, v: bool) -> Self {
        self.set.push("agreed", Value::Bool(v));
        self
    }
}

impl AsUpdateSet for MUserUpdate {
    fn set(&self) -> &UpdateSet {
        &self.set
    }
}

// ─────────────────────────── 통합 테스트 ───────────────────────────

#[tokio::test]
async fn manual_entity_crud_roundtrip() {
    // 명시적 풀 API (탈출구) 를 그대로 검증한다: PostgresRepository::new(pool) +
    // Tx::begin_with(&pool). 전역 풀 no-arg 형태는 다른 테스트가 커버한다.
    let pool = common::pool().await;
    let repo: PostgresRepository<MUser> = PostgresRepository::new(pool.clone());
    repo.drop_table().await.ok();
    repo.create_table().await.unwrap();

    // ── insert: nil uuid → v7 채번 ──
    let u = MUser {
        id: Uuid::nil(),
        name: "hackartist".into(),
        age: 40,
        agreed: true,
    };
    let saved = repo.insert(&u).await.unwrap();
    assert!(!saved.id.is_nil());

    // ── get ──
    let got = repo.get(saved.id).await.unwrap().unwrap();
    assert_eq!(got.name, "hackartist");

    // ── 빈 업데이트 가드: SET 절이 비면 스키마 오류 ──
    assert!(matches!(
        repo.update(saved.id, MUser::update()).await,
        Err(postgres::Error::Schema(_))
    ));

    // ── find: StringOp(|) + filter(OrdCol & BoolCol) + order_by ──
    let found = repo
        .find(
            MUser::query()
                .name(StringOp::StartsWith("hack") | StringOp::EndsWith("zzz"))
                .filter(|c| c.age.gte(20) & c.agreed.eq(true))
                .order_by(MUserColumn::Age, Order::Desc),
        )
        .await
        .unwrap();
    assert_eq!(found.items.len(), 1);
    assert_eq!(found.total_count, 1);

    // ── find: 직접 빌더(age/agreed/limit/offset/order_by) 표면 — 매칭 0건 ──
    let none = repo
        .find(
            MUser::query()
                .age(NumOp::Lt(0))
                .agreed(BoolOp::Eq(false))
                .order_by(MUserColumn::Name, Order::Asc)
                .limit(10)
                .offset(0),
        )
        .await
        .unwrap();
    assert!(none.items.is_empty());
    assert_eq!(none.total_count, 0);

    // ── update … RETURNING explicit columns ──
    let updated = repo
        .update(
            saved.id,
            MUser::update().name("renamed").age(41).agreed(false),
        )
        .await
        .unwrap();
    assert_eq!(
        (updated.name.as_str(), updated.age, updated.agreed),
        ("renamed", 41, false)
    );

    // ── 트랜잭션: tx-bound repo, read-your-writes, drop = 즉시 rollback (tx_repo 가 살아있어도) ──
    let tx = Tx::begin_with(&pool).await.unwrap();
    let tx_repo = repo.with_tx(&tx);
    tx_repo.delete(saved.id).await.unwrap();
    assert!(tx_repo.get(saved.id).await.unwrap().is_none()); // tx 안에서는 지워짐 (read-your-writes)
    drop(tx); // tx_repo 가 아직 살아있어도 Tx::drop 이 공유 슬롯을 즉시 비워 롤백을 건다
    assert!(matches!(
        tx_repo.get(saved.id).await,
        Err(postgres::Error::TxClosed)
    )); // 닫힌 tx 에 바인딩된 repo 의 이후 사용은 즉시 에러
    assert!(repo.get(saved.id).await.unwrap().is_some()); // 원본 repo(pool)에선 롤백돼 살아있음

    // ── commit 경로 + 닫힌 tx 사용 에러 ──
    let tx = Tx::begin_with(&pool).await.unwrap();
    let tx_repo = repo.with_tx(&tx);
    tx_repo.delete(saved.id).await.unwrap();
    tx.commit().await.unwrap();
    assert!(matches!(
        tx_repo.get(saved.id).await,
        Err(postgres::Error::TxClosed)
    ));
    assert!(repo.get(saved.id).await.unwrap().is_none());
    repo.drop_table().await.unwrap();
}
