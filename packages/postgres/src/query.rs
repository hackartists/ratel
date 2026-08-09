use sqlx::{Postgres, QueryBuilder};

use crate::cond::Cond;
use crate::value::Value;

/// ORDER BY 방향.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Order {
    Asc,
    Desc,
}

/// WHERE/ORDER BY/LIMIT/OFFSET/페이지네이션 조합. 렌더는 이미 진행 중인 `QueryBuilder`
/// 뒤에 이어붙인다.
///
/// 페이지네이션(`page`/`page_size`)은 raw `limit`/`offset` 보다 **우선**한다: `page_size`
/// 가 지정되면 `LIMIT {page_size} OFFSET {(page-1)*page_size}` 를 방출하고 `limit`/`offset`
/// 은 무시한다. `page` 만 있고 `page_size` 가 없으면 페이징은 no-op 이다 (오직 `page_size`
/// 만 페이징을 구동한다).
#[derive(Default)]
pub struct QuerySpec {
    pub conds: Vec<Cond>,
    pub order: Vec<(&'static str, Order)>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    /// 1-based 페이지 번호. `page_size` 없이는 무시된다. 1 미만 값(0, 음수)은
    /// `render` 에서 1로 clamp 된다 — OFFSET 이 음수가 되는 것을 막기 위해서다.
    pub page: Option<i64>,
    /// 페이지 크기. 지정되면 `limit`/`offset` 대신 페이징 LIMIT/OFFSET 을 구동한다.
    pub page_size: Option<i64>,
}

impl QuerySpec {
    /// ` WHERE c1 AND c2` 만 append (order/limit/offset/page 제외). `COUNT(*)` 집계처럼
    /// 조건에 매칭되는 전체 행을 세는 데 쓴다. conds 가 비면 아무것도 방출하지 않는다.
    /// top-level conds 는 AND 로만 묶이며 추가 괄호로 감싸지 않는다 (각 Cond 는 스스로 render 한다).
    pub fn render_where(&self, qb: &mut QueryBuilder<'_, Postgres>) {
        if !self.conds.is_empty() {
            qb.push(" WHERE ");
            for (i, c) in self.conds.iter().enumerate() {
                if i > 0 {
                    qb.push(" AND ");
                }
                c.render(qb);
            }
        }
    }

    /// ` WHERE c1 AND c2 … ORDER BY … LIMIT $n OFFSET $n` 를 순서대로 append.
    ///
    /// 페이지네이션이 raw limit/offset 보다 우선한다: `page_size` 가 `Some` 이면 그것으로
    /// LIMIT/OFFSET 을 계산하고 `limit`/`offset` 은 무시한다. 아니면 기존 `limit`/`offset`
    /// 을 그대로 방출한다.
    pub fn render(&self, qb: &mut QueryBuilder<'_, Postgres>) {
        self.render_where(qb);
        if !self.order.is_empty() {
            qb.push(" ORDER BY ");
            for (i, (col, ord)) in self.order.iter().enumerate() {
                if i > 0 {
                    qb.push(", ");
                }
                qb.push(format!(
                    "\"{col}\" {}",
                    match ord {
                        Order::Asc => "ASC",
                        Order::Desc => "DESC",
                    }
                ));
            }
        }
        if let Some(page_size) = self.page_size {
            // 페이징 우선: page_size 가 있으면 raw limit/offset 은 무시한다.
            // page 는 1-based; 1 미만 값(0, 음수)은 1로 clamp 한다 — 그렇지 않으면
            // OFFSET 이 음수가 되어 런타임 SQL 에러가 난다.
            let page = self.page.unwrap_or(1).max(1);
            let offset = (page - 1) * page_size;
            qb.push(" LIMIT ");
            qb.push_bind(page_size);
            qb.push(" OFFSET ");
            qb.push_bind(offset);
        } else {
            if let Some(limit) = self.limit {
                qb.push(" LIMIT ");
                qb.push_bind(limit);
            }
            if let Some(offset) = self.offset {
                qb.push(" OFFSET ");
                qb.push_bind(offset);
            }
        }
    }
}

/// UPDATE 의 SET 절 — `(컬럼, 값)` 쌍의 순서 있는 목록.
#[derive(Default)]
pub struct UpdateSet {
    pub sets: Vec<(&'static str, Value)>,
}

impl UpdateSet {
    pub fn push(&mut self, col: &'static str, v: Value) {
        self.sets.push((col, v));
    }

    /// ` SET "c1" = $1, "c2" = $2` 를 append.
    ///
    /// Precondition: `self.sets` must be non-empty. An empty `UpdateSet` would render a
    /// bare ` SET ` with no assignments, producing malformed SQL (`UPDATE t SET WHERE …`).
    /// The repository layer is responsible for rejecting empty updates before reaching this
    /// point (returning `Error::Schema("empty update")`); this is a defense-in-depth check.
    pub fn render_set(&self, qb: &mut QueryBuilder<'_, Postgres>) {
        debug_assert!(
            !self.sets.is_empty(),
            "render_set called with empty UpdateSet — repository must reject empty updates"
        );
        qb.push(" SET ");
        for (i, (col, v)) in self.sets.iter().enumerate() {
            if i > 0 {
                qb.push(", ");
            }
            qb.push(format!("\"{col}\" = "));
            v.clone().push_bind(qb);
        }
    }
}

pub trait AsQuerySpec {
    fn spec(&self) -> &QuerySpec;
}

pub trait AsUpdateSet {
    fn set(&self) -> &UpdateSet;
}
