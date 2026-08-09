use std::marker::PhantomData;
use std::sync::Arc;

use sqlx::postgres::PgRow;
use sqlx::{PgPool, Postgres, QueryBuilder, Row, Transaction};
use tokio::sync::Mutex;

use crate::entity::PostgresEntity;
use crate::error::{Error, Result};
use crate::page::Page;
use crate::query::{AsQuerySpec, AsUpdateSet};
use crate::value::Value;

/// 공유 트랜잭션 핸들. 여러 엔티티의 repo 가 같은 tx 를 공유할 수 있도록
/// `Arc<Mutex<Option<..>>>` 로 감싼다. `Option` 이 `None` 이면 이미 commit/rollback 되어
/// 닫힌 tx 다 (그 이후 모든 실행은 [`Error::TxClosed`]).
type TxHandle = Arc<Mutex<Option<Transaction<'static, Postgres>>>>;

/// 쿼리가 실제로 실행되는 백엔드. `Pool` 은 커넥션 풀에서 커넥션을 빌려 자동 커밋으로,
/// `Tx` 는 공유 트랜잭션 위에서 실행한다.
#[derive(Clone)]
enum Backend {
    Pool(PgPool),
    Tx(TxHandle),
}

/// 실행 컨텍스트 — pool 또는 공유 tx 를 추상화한다. repo 내부와 `hydrate`/로더가
/// 이 타입만 보고 쿼리를 날리므로, tx-bound repo 의 `find`/`hydrate` 도 자연히 같은
/// 트랜잭션으로 나간다.
///
/// 모든 실행 메서드는 완성 전의 [`QueryBuilder`] 를 **값으로** 받아 내부에서 `build()`
/// 한 뒤 백엔드에서 실행한다 (빌더가 만드는 `Query` 가 빌더를 빌리므로, 빌더를 메서드
/// 안으로 옮겨야 lifetime 이 성립한다).
#[derive(Clone)]
pub struct Db {
    backend: Backend,
}

impl Db {
    /// pool 백엔드 생성.
    fn pool(pool: PgPool) -> Self {
        Db {
            backend: Backend::Pool(pool),
        }
    }

    /// tx 백엔드 생성 — 공유 핸들을 클론해 바인딩한다.
    fn tx(handle: TxHandle) -> Self {
        Db {
            backend: Backend::Tx(handle),
        }
    }

    /// `SELECT …` 등을 실행해 모든 행을 가져온다.
    pub async fn fetch_all(&self, mut qb: QueryBuilder<'_, Postgres>) -> Result<Vec<PgRow>> {
        let query = qb.build();
        match &self.backend {
            Backend::Pool(pool) => Ok(query.fetch_all(pool).await?),
            Backend::Tx(handle) => {
                let mut guard = handle.lock().await;
                let tx = guard.as_mut().ok_or(Error::TxClosed)?;
                Ok(query.fetch_all(&mut **tx).await?)
            }
        }
    }

    /// 최대 한 행을 가져온다 (0/1 행).
    pub async fn fetch_optional(
        &self,
        mut qb: QueryBuilder<'_, Postgres>,
    ) -> Result<Option<PgRow>> {
        let query = qb.build();
        match &self.backend {
            Backend::Pool(pool) => Ok(query.fetch_optional(pool).await?),
            Backend::Tx(handle) => {
                let mut guard = handle.lock().await;
                let tx = guard.as_mut().ok_or(Error::TxClosed)?;
                Ok(query.fetch_optional(&mut **tx).await?)
            }
        }
    }

    /// `INSERT`/`UPDATE`/`DELETE` 등을 실행해 영향받은 행 수를 반환한다.
    pub async fn execute(&self, mut qb: QueryBuilder<'_, Postgres>) -> Result<u64> {
        let query = qb.build();
        let result = match &self.backend {
            Backend::Pool(pool) => query.execute(pool).await?,
            Backend::Tx(handle) => {
                let mut guard = handle.lock().await;
                let tx = guard.as_mut().ok_or(Error::TxClosed)?;
                query.execute(&mut **tx).await?
            }
        };
        Ok(result.rows_affected())
    }

    /// 바인딩 없는 평문 SQL 문 하나를 실행한다. DDL 문자열(create/drop table 등)용.
    pub async fn execute_sql(&self, sql: &str) -> Result<()> {
        let query = sqlx::query(sql);
        match &self.backend {
            Backend::Pool(pool) => {
                query.execute(pool).await?;
            }
            Backend::Tx(handle) => {
                let mut guard = handle.lock().await;
                let tx = guard.as_mut().ok_or(Error::TxClosed)?;
                query.execute(&mut **tx).await?;
            }
        }
        Ok(())
    }
}

/// 트랜잭션 핸들 — 여러 엔티티의 repo 가 [`PostgresRepository::with_tx`] 로 공유한다.
///
/// `commit`/`rollback` 없이 `Tx` 가 drop 되면, `Tx` 의 [`Drop`] 구현이 공유 슬롯에서
/// 내부 sqlx [`Transaction`] 을 즉시 꺼내 버려(그 `Transaction` 의 자체 `Drop` 이 롤백을
/// 큐잉) **바로** 롤백이 걸린다 — tx-bound repo 클론이 아직 살아있어도 상관없다. 그
/// 시점 이후 그 클론들의 호출은 슬롯이 `None` 이므로 [`Error::TxClosed`] 를 받는다.
pub struct Tx {
    inner: TxHandle,
}

impl Drop for Tx {
    /// commit/rollback 없이 `Tx` 가 drop 되면 즉시 공유 슬롯에서 트랜잭션을 꺼내 버린다
    /// (꺼낸 `Transaction` 의 `Drop` 이 롤백을 큐잉한다). `commit`/`rollback` 은 이미
    /// `self` 를 소비하며 슬롯을 `take()` 해두므로, 그 뒤에 도는 이 `Drop` 은 슬롯이
    /// 이미 `None` 이라 아무 일도 하지 않는다.
    ///
    /// 다른 태스크가 그 순간 락을 쥐고 있는 극단적 경합에서는 `try_lock` 이 실패해
    /// 즉시 처리를 못 하고, 마지막 `Arc` 클론이 drop 되는 시점으로 미뤄진다(그래도
    /// 결과적 정확성은 유지된다 — sqlx `Transaction` 의 `Drop` 자체가 롤백을 큐잉).
    fn drop(&mut self) {
        if let Ok(mut guard) = self.inner.try_lock() {
            guard.take(); // Some(tx) → drop(tx) → 롤백 큐잉; None → commit/rollback 이미 끝남, no-op
        }
    }
}

impl Tx {
    /// 프로세스 전역 풀([`crate::global::pool`])에서 트랜잭션을 시작한다 — 일차 API.
    /// [`set_global_pool`](crate::set_global_pool) 이 선행되어야 한다.
    pub async fn begin() -> Result<Tx> {
        Self::begin_with(crate::global::pool()).await
    }

    /// 주어진 풀에서 트랜잭션을 시작해 공유 핸들로 감싼다 — 명시적 풀 탈출구
    /// (서로 다른 풀이 필요한 경우). 전역 풀을 쓰려면 인자 없는 [`begin`](Self::begin).
    pub async fn begin_with(pool: &PgPool) -> Result<Tx> {
        let tx = pool.begin().await?;
        Ok(Tx {
            inner: Arc::new(Mutex::new(Some(tx))),
        })
    }

    /// 트랜잭션을 커밋한다. 이후 이 tx 에 바인딩된 repo 호출은 [`Error::TxClosed`].
    pub async fn commit(self) -> Result<()> {
        let tx = self.inner.lock().await.take().ok_or(Error::TxClosed)?;
        tx.commit().await?;
        Ok(())
    }

    /// 트랜잭션을 롤백한다. 이후 이 tx 에 바인딩된 repo 호출은 [`Error::TxClosed`].
    pub async fn rollback(self) -> Result<()> {
        let tx = self.inner.lock().await.take().ok_or(Error::TxClosed)?;
        tx.rollback().await?;
        Ok(())
    }
}

/// 엔티티 `T` 의 제네릭 CRUD 리포지토리.
///
/// 모든 실행은 [`Db`] 를 경유하므로, [`with_tx`](Self::with_tx) 로 만든 클론은 백엔드만
/// tx 로 바뀌어 이후 모든 호출(및 `find` 의 `hydrate`)이 같은 트랜잭션으로 나간다.
/// 메서드별 `*_with_tx` 변형은 없다.
pub struct PostgresRepository<T: PostgresEntity> {
    db: Db,
    pool: PgPool,
    _marker: PhantomData<T>,
}

// PhantomData<T> 때문에 파생 Clone 은 `T: Clone` 을 요구하므로 수동 구현한다.
impl<T: PostgresEntity> Clone for PostgresRepository<T> {
    fn clone(&self) -> Self {
        PostgresRepository {
            db: self.db.clone(),
            pool: self.pool.clone(),
            _marker: PhantomData,
        }
    }
}

impl<T: PostgresEntity> PostgresRepository<T> {
    /// 풀 백엔드로 리포지토리를 만든다 — 명시적 풀 탈출구 (서로 다른 풀이 필요한
    /// 경우). 전역 풀 기반 일차 API 는 생성된 [`X::repository()`](crate::PostgresEntity)
    /// 또는 [`global`](Self::global).
    pub fn new(pool: PgPool) -> Self {
        PostgresRepository {
            db: Db::pool(pool.clone()),
            pool,
            _marker: PhantomData,
        }
    }

    /// 원본 커넥션 풀 (tx 바인딩 여부와 무관하게 항상 풀을 노출).
    pub fn pool(&self) -> &PgPool {
        &self.pool
    }

    /// 현재 실행 컨텍스트. 생성 로더(`load_*`)가 hydrate 시 사용한다.
    pub fn db(&self) -> &Db {
        &self.db
    }

    /// 주어진 tx 에 바인딩된 클론. 이후 모든 호출이 그 트랜잭션으로 나간다.
    pub fn with_tx(&self, tx: &Tx) -> Self {
        PostgresRepository {
            db: Db::tx(tx.inner.clone()),
            pool: self.pool.clone(),
            _marker: PhantomData,
        }
    }

    /// 테이블 생성: enum 의존 타입 → 본 테이블 → m2m 조인테이블 순서.
    pub async fn create_table(&self) -> Result<()> {
        for dep in T::enum_dependencies() {
            for stmt in &dep.create {
                self.db.execute_sql(stmt).await?;
            }
        }
        for stmt in &T::ddl().create {
            self.db.execute_sql(stmt).await?;
        }
        for jt in T::join_table_ddls() {
            for stmt in &jt.create {
                self.db.execute_sql(stmt).await?;
            }
        }
        for stmt in &T::ddl().post_create {
            self.db.execute_sql(stmt).await?;
        }
        Ok(())
    }

    /// 테이블 삭제: 조인테이블 → 본 테이블 순서.
    ///
    /// enum 의존 타입은 여러 테이블이 공유할 수 있으므로 여기서 drop 하지 않는다.
    pub async fn drop_table(&self) -> Result<()> {
        for jt in T::join_table_ddls() {
            for stmt in &jt.drop {
                self.db.execute_sql(stmt).await?;
            }
        }
        for stmt in &T::ddl().drop {
            self.db.execute_sql(stmt).await?;
        }
        Ok(())
    }

    /// `INSERT … RETURNING <명시적 컬럼>` — 채번/기본값이 반영된 행을 디코드해 반환한다.
    pub async fn insert(&self, entity: &T) -> Result<T> {
        let values = entity.insert_values();
        let table = T::table_name();
        let select_columns = T::select_columns(None);

        let mut qb = QueryBuilder::<Postgres>::new(format!("INSERT INTO \"{table}\" ("));
        for (i, (col, _)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\""));
        }
        qb.push(") VALUES (");
        for (i, (_, v)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            v.clone().push_bind(&mut qb);
        }
        qb.push(format!(") RETURNING {select_columns}"));

        let row = self.db.fetch_optional(qb).await?.ok_or(Error::NotFound)?;
        T::from_pg_row(&row)
    }

    /// `INSERT … ON CONFLICT (pk) DO UPDATE SET … RETURNING <명시적 컬럼>` — pk 가 이미 있으면
    /// 갱신, 없으면 삽입한다. `insert`와 같은 컬럼/값 조립(`entity.insert_values()`)에
    /// pk 를 제외한 전 컬럼의 `col = EXCLUDED.col` 절만 덧붙인다.
    ///
    /// pk 외 컬럼이 없는 퇴화 케이스는 `DO NOTHING` 으로 대체한다 — 그 경우 충돌 시
    /// `RETURNING` 이 아무 행도 주지 않으므로 [`get`](Self::get) 으로 기존 행을 가져온다.
    pub async fn upsert(&self, entity: &T) -> Result<T> {
        let values = entity.insert_values();
        let table = T::table_name();
        let pk_col = T::primary_key_column();
        let select_columns = T::select_columns(None);

        let mut qb = QueryBuilder::<Postgres>::new(format!("INSERT INTO \"{table}\" ("));
        for (i, (col, _)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\""));
        }
        qb.push(") VALUES (");
        for (i, (_, v)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            v.clone().push_bind(&mut qb);
        }
        qb.push(format!(") ON CONFLICT (\"{pk_col}\") "));

        let mut has_non_pk = false;
        for (col, _) in values.iter() {
            if *col == pk_col {
                continue;
            }
            if !has_non_pk {
                qb.push("DO UPDATE SET ");
            } else {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\" = EXCLUDED.\"{col}\""));
            has_non_pk = true;
        }
        if !has_non_pk {
            qb.push("DO NOTHING");
        }
        qb.push(format!(" RETURNING {select_columns}"));

        match self.db.fetch_optional(qb).await? {
            Some(row) => T::from_pg_row(&row),
            // DO NOTHING 이 충돌로 스킵되면 RETURNING 이 비므로, 기존 행을 조회해 반환.
            None => self.get(entity.primary_key()).await?.ok_or(Error::NotFound),
        }
    }

    /// `INSERT … ON CONFLICT ("c1","c2") DO UPDATE SET … RETURNING <명시적 컬럼>` — **자연키 upsert**.
    /// PK 로 충돌하는 [`upsert`](Self::upsert) 와 달리, 호출자가 지정한 유일키(`conflict_cols`)
    /// 로 dedup 한다 — 복합 `#[postgres(unique(a, b))]`(또는 단일 `#[postgres(unique)]`)가
    /// UNIQUE 인덱스로 뒷받침하는 그 컬럼들이다. 충돌 시 **conflict 컬럼도 pk 도 아닌** 모든
    /// 컬럼을 들어온 행 값으로 갱신하고, 기존 행의 pk 는 **보존**한다(안정적 identity / id 재사용)
    /// — 그래서 같은 자연키를 다시 넣으면 중복이 아니라 in-place 갱신된다.
    ///
    /// `conflict_cols` 는 UNIQUE 제약/인덱스로 뒷받침돼야 한다 — 아니면 Postgres 가
    /// "no unique or exclusion constraint matching the ON CONFLICT specification" 로 거부한다.
    /// 복합 UNIQUE 는 `#[postgres(unique(a, b))]` 로 선언한다.
    ///
    /// 갱신할 컬럼이 전혀 없으면(모든 컬럼이 conflict 컬럼이거나 pk) `ON CONFLICT DO NOTHING`
    /// 으로 낮춘다 — 그 경우 RETURNING 이 비므로 conflict 키로 기존 행을 다시 읽어 반환한다.
    pub async fn upsert_on(&self, conflict_cols: &[&str], entity: &T) -> Result<T> {
        if conflict_cols.is_empty() {
            return Err(Error::Schema(
                "upsert_on requires at least one conflict column".into(),
            ));
        }
        let values = entity.insert_values();
        let table = T::table_name();
        let pk_col = T::primary_key_column();
        let select_columns = T::select_columns(None);

        let mut qb = QueryBuilder::<Postgres>::new(format!("INSERT INTO \"{table}\" ("));
        for (i, (col, _)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\""));
        }
        qb.push(") VALUES (");
        for (i, (_, v)) in values.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            v.clone().push_bind(&mut qb);
        }

        qb.push(") ON CONFLICT (");
        for (i, col) in conflict_cols.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\""));
        }
        qb.push(") ");

        let mut has_update = false;
        for (col, _) in values.iter() {
            // conflict 컬럼은 정의상 같으므로, 그리고 pk 는 충돌 시 안정적으로 두기 위해 제외.
            if *col == pk_col || conflict_cols.contains(col) {
                continue;
            }
            if !has_update {
                qb.push("DO UPDATE SET ");
            } else {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\" = EXCLUDED.\"{col}\""));
            has_update = true;
        }
        if !has_update {
            qb.push("DO NOTHING");
        }
        qb.push(format!(" RETURNING {select_columns}"));

        match self.db.fetch_optional(qb).await? {
            Some(row) => T::from_pg_row(&row),
            // DO NOTHING 이 충돌로 스킵되면 RETURNING 이 비므로, conflict 키로 기존 행 조회.
            None => {
                let mut qb2 = QueryBuilder::<Postgres>::new(format!(
                    "SELECT {select_columns} FROM \"{table}\" WHERE "
                ));
                for (i, col) in conflict_cols.iter().enumerate() {
                    if i > 0 {
                        qb2.push(" AND ");
                    }
                    qb2.push(format!("\"{col}\" = "));
                    let v = values
                        .iter()
                        .find_map(|(c, val)| if c == col { Some(val.clone()) } else { None })
                        .ok_or_else(|| {
                            Error::Schema(format!(
                                "upsert_on: conflict column `{col}` is not an insert column"
                            ))
                        })?;
                    v.push_bind(&mut qb2);
                }
                let row = self.db.fetch_optional(qb2).await?.ok_or(Error::NotFound)?;
                T::from_pg_row(&row)
            }
        }
    }

    /// PK 로 단건 조회.
    pub async fn get(&self, pk: T::Pk) -> Result<Option<T>> {
        let table = T::table_name();
        let pk_col = T::primary_key_column();
        let select_columns = T::select_columns(None);

        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "SELECT {select_columns} FROM \"{table}\" WHERE \"{pk_col}\" = "
        ));
        let v: Value = pk.into();
        v.push_bind(&mut qb);

        match self.db.fetch_optional(qb).await? {
            Some(row) => Ok(Some(T::from_pg_row(&row)?)),
            None => Ok(None),
        }
    }

    /// 쿼리 조건에 맞는 다건 조회 + eager hydrate + 페이지네이션.
    ///
    /// `COUNT(*) OVER()` 윈도우 집계로 매칭되는 전체 행 수(`total_count`)를 데이터 페이지와
    /// **같은 쿼리**에서 얻는다. 결과가 비면(범위를 벗어난 페이지 등) 별도 [`count`](Self::count)
    /// 로 WHERE 조건에 대한 실제 전체 수를 채워, 빈 페이지도 정확한 `total_count` 를 보고한다.
    ///
    /// 페이징 없이(`page_size` 미지정) 호출하면 모든 행이 `items` 에 담기고 `page == 1`,
    /// `page_size == total_count`, `total_pages == 1`.
    ///
    /// 알려진 한계: 윈도우 집계는 `AS __total_count` 로 결과 컬럼을 덧붙인다. 엔티티가
    /// 실제로 `__total_count` 라는 컬럼을 갖고 있으면 그 값과 충돌해 `from_pg_row` 디코딩이
    /// 어느 쪽 값을 읽을지 불분명해진다 — 엔티티 컬럼 이름으로 `__total_count` 는 쓰지 않는다.
    pub async fn find(&self, query: T::Query) -> Result<Page<T>> {
        // spec 차용은 fetch_page_by_spec 의 await 가 끝나면 종료되므로, 이후 &query 를
        // hydrate 로 다시 빌릴 수 있다.
        let mut page = self.fetch_page_by_spec(query.spec()).await?;
        // 컬럼명 기반 try_get 이라 추가된 __total_count 컬럼은 from_pg_row 에서 무시된다.
        T::hydrate(&self.db, &mut page.items, &query).await?;
        Ok(page)
    }

    /// 이미 조립된 [`QuerySpec`](crate::query::QuerySpec) 로 다건 조회 + 페이지네이션 —
    /// **관계 hydrate 없이** bare 행만 담은 [`Page`] 를 돌려준다. named finder(`#[postgres(find
    /// = …)]`)가 `X::find_by_room(v)` 형태로 호출하는 진입점으로, asset-storage 의 finder 처럼
    /// eager 관계를 채우지 않는다. eager hydrate 가 필요하면 [`find`](Self::find) 를 쓴다.
    ///
    /// 페이지네이션/`total_count` 계산은 [`find`](Self::find) 과 동일한 규칙(`COUNT(*) OVER()`
    /// 윈도우 집계 + 빈-페이지 fallback)을 공유한다.
    pub async fn find_by_spec(&self, spec: &crate::query::QuerySpec) -> Result<Page<T>> {
        self.fetch_page_by_spec(spec).await
    }

    /// `find`/`find_by_spec` 공유 코어: 명시적 컬럼 + `COUNT(*) OVER()` 로 페이지 행 + 전체 수를
    /// 한 쿼리에서 얻어 [`Page`] 를 만든다 (hydrate 는 하지 않는다 — 호출자 책임).
    async fn fetch_page_by_spec(&self, spec: &crate::query::QuerySpec) -> Result<Page<T>> {
        let table = T::table_name();
        let select_columns = T::select_columns(None);
        let mut qb = QueryBuilder::<Postgres>::new(format!(
            "SELECT {select_columns}, COUNT(*) OVER() AS __total_count FROM \"{table}\""
        ));
        spec.render(&mut qb);

        let rows = self.db.fetch_all(qb).await?;
        // total_count: 행이 있으면 윈도우 집계 컬럼에서, 없으면(빈 페이지) 별도 count 로.
        let total_count = match rows.first() {
            Some(first) => first.try_get::<i64, _>("__total_count")?,
            None => self.count_by_spec(spec).await?,
        };

        let items = rows
            .iter()
            .map(T::from_pg_row)
            .collect::<Result<Vec<T>>>()?;

        let page = spec.page.unwrap_or(1);
        // 페이징 없으면 page_size = total_count (0 이면 items 길이로 하한). total_count 는
        // 항상 items.len() 이상이므로 unpaged 시 page_size == total_count.
        let page_size = spec
            .page_size
            .unwrap_or_else(|| total_count.max(items.len() as i64));
        let total_pages = if total_count == 0 || page_size <= 0 {
            1
        } else {
            (total_count + page_size - 1) / page_size
        };

        Ok(Page {
            items,
            page,
            page_size,
            total_count,
            total_pages,
        })
    }

    /// WHERE 조건에 매칭되는 전체 행 수 (`SELECT COUNT(*)` — order/limit/offset/page 무시).
    /// [`find`](Self::find) 의 빈-페이지 fallback 이 이걸 호출한다.
    pub async fn count(&self, query: &T::Query) -> Result<i64> {
        self.count_by_spec(query.spec()).await
    }

    /// [`count`](Self::count) 의 spec 기반 코어 — `SELECT COUNT(*)` + WHERE 만.
    async fn count_by_spec(&self, spec: &crate::query::QuerySpec) -> Result<i64> {
        let table = T::table_name();
        let mut qb = QueryBuilder::<Postgres>::new(format!("SELECT COUNT(*) FROM \"{table}\""));
        spec.render_where(&mut qb);
        // COUNT(*) 는 GROUP BY 없이는 항상 정확히 한 행을 반환한다.
        match self.db.fetch_optional(qb).await? {
            Some(row) => Ok(row.try_get::<i64, _>(0)?),
            None => Ok(0),
        }
    }

    /// `find` 의 단건 버전 — 명시적 limit 이 없으면 `LIMIT 1` 을 강제한다.
    pub async fn find_one(&self, query: T::Query) -> Result<Option<T>> {
        let table = T::table_name();
        let spec = query.spec();
        let select_columns = T::select_columns(None);

        let mut qb =
            QueryBuilder::<Postgres>::new(format!("SELECT {select_columns} FROM \"{table}\""));
        spec.render(&mut qb);
        // T::Query 는 불투명 — spec 을 통해 limit 을 넣을 수 없으므로, 호출자가 limit 도
        // page_size 도 지정하지 않은 경우에만 LIMIT 1 을 뒤에 붙인다. page_size 가 있으면
        // render() 가 이미 `LIMIT $n OFFSET $m` 을 방출했으므로, 여기서 추가로 LIMIT 1 을
        // 붙이면 `LIMIT $n OFFSET $m LIMIT 1` 이 되어 SQL 문법 오류가 난다.
        if spec.limit.is_none() && spec.page_size.is_none() {
            qb.push(" LIMIT 1");
        }

        let rows = self.db.fetch_all(qb).await?;
        let Some(row) = rows.first() else {
            return Ok(None);
        };
        let mut items = vec![T::from_pg_row(row)?];
        T::hydrate(&self.db, &mut items, &query).await?;
        Ok(items.into_iter().next())
    }

    /// `UPDATE … SET … WHERE pk = … RETURNING <명시적 컬럼>`. 빈 업데이트는 스키마 오류,
    /// 대상 없음은 NotFound.
    pub async fn update(&self, pk: T::Pk, update: T::Update) -> Result<T> {
        let set = update.set();
        if set.sets.is_empty() {
            return Err(Error::Schema("empty update".into()));
        }
        let table = T::table_name();
        let pk_col = T::primary_key_column();
        let select_columns = T::select_columns(None);

        let mut qb = QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\""));
        set.render_set(&mut qb);
        qb.push(format!(" WHERE \"{pk_col}\" = "));
        let v: Value = pk.into();
        v.push_bind(&mut qb);
        qb.push(format!(" RETURNING {select_columns}"));

        let row = self.db.fetch_optional(qb).await?.ok_or(Error::NotFound)?;
        T::from_pg_row(&row)
    }

    /// PK 로 삭제. 대상 없음(0 rows) 은 NotFound.
    pub async fn delete(&self, pk: T::Pk) -> Result<()> {
        let table = T::table_name();
        let pk_col = T::primary_key_column();

        let mut qb =
            QueryBuilder::<Postgres>::new(format!("DELETE FROM \"{table}\" WHERE \"{pk_col}\" = "));
        let v: Value = pk.into();
        v.push_bind(&mut qb);

        let affected = self.db.execute(qb).await?;
        if affected == 0 {
            return Err(Error::NotFound);
        }
        Ok(())
    }

    /// PK 로 삭제하고 삭제된 행을 반환한다 (`… RETURNING <명시적 컬럼>`). 대상 없음(0 rows) 은
    /// NotFound. 파생된 `delete_by_id` 가 이걸 호출한다 —
    /// 삭제된 엔티티를 돌려준다.
    pub async fn delete_returning(&self, pk: T::Pk) -> Result<T> {
        let table = T::table_name();
        let pk_col = T::primary_key_column();
        let select_columns = T::select_columns(None);

        let mut qb =
            QueryBuilder::<Postgres>::new(format!("DELETE FROM \"{table}\" WHERE \"{pk_col}\" = "));
        let v: Value = pk.into();
        v.push_bind(&mut qb);
        qb.push(format!(" RETURNING {select_columns}"));

        let row = self.db.fetch_optional(qb).await?.ok_or(Error::NotFound)?;
        T::from_pg_row(&row)
    }
}
