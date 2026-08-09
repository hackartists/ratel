use sqlx::{Postgres, QueryBuilder};

use crate::value::Value;

/// LIKE/ILIKE 패턴에서 와일드카드로 오인될 문자를 이스케이프.
/// `\` → `\\`, `%` → `\%`, `_` → `\_` (순서 중요: `\` 먼저 이스케이프).
pub fn escape_like(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for c in raw.chars() {
        match c {
            '\\' => out.push_str(r"\\"),
            '%' => out.push_str(r"\%"),
            '_' => out.push_str(r"\_"),
            c => out.push(c),
        }
    }
    out
}

#[derive(Debug, Clone)]
pub enum PredExpr {
    Cmp(&'static str, Value),
    LikePat { ilike: bool, pattern: String },
    In(Vec<Value>),
    Between(Value, Value),
    IsNull(bool),
}

#[derive(Debug, Clone)]
pub enum Cond {
    And(Vec<Cond>),
    Or(Vec<Cond>),
    Pred {
        column: &'static str,
        expr: PredExpr,
    },
}

impl Cond {
    pub fn pred(column: &'static str, expr: PredExpr) -> Self {
        Cond::Pred { column, expr }
    }

    /// 렌더 규칙: 컬럼명은 항상 쿼팅, And/Or 는 괄호 그룹 + 구분자,
    /// 빈 In 은 FALSE, LIKE/ILIKE 는 항상 `ESCAPE '\'` 를 명시한다.
    pub fn render(&self, qb: &mut QueryBuilder<'_, Postgres>) {
        match self {
            Cond::And(cs) | Cond::Or(cs) => {
                let sep = if matches!(self, Cond::And(_)) {
                    " AND "
                } else {
                    " OR "
                };
                qb.push("(");
                for (i, c) in cs.iter().enumerate() {
                    if i > 0 {
                        qb.push(sep);
                    }
                    c.render(qb);
                }
                qb.push(")");
            }
            Cond::Pred { column, expr } => match expr {
                PredExpr::Cmp(op, v) => {
                    qb.push(format!("\"{column}\" {op} "));
                    v.clone().push_bind(qb);
                }
                PredExpr::LikePat { ilike, pattern } => {
                    qb.push(format!(
                        "\"{column}\" {} ",
                        if *ilike { "ILIKE" } else { "LIKE" }
                    ));
                    qb.push_bind(pattern.clone());
                    qb.push(" ESCAPE '\\'");
                }
                PredExpr::In(vs) if vs.is_empty() => {
                    qb.push("FALSE");
                }
                PredExpr::In(vs) => {
                    qb.push(format!("\"{column}\" IN ("));
                    for (i, v) in vs.iter().enumerate() {
                        if i > 0 {
                            qb.push(", ");
                        }
                        v.clone().push_bind(qb);
                    }
                    qb.push(")");
                }
                PredExpr::Between(a, b) => {
                    qb.push(format!("\"{column}\" BETWEEN "));
                    a.clone().push_bind(qb);
                    qb.push(" AND ");
                    b.clone().push_bind(qb);
                }
                PredExpr::IsNull(yes) => {
                    qb.push(format!(
                        "\"{column}\" IS {}NULL",
                        if *yes { "" } else { "NOT " }
                    ));
                }
            },
        }
    }
}

impl std::ops::BitAnd for Cond {
    type Output = Cond;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            Cond::And(mut v) => {
                v.push(rhs);
                Cond::And(v)
            }
            s => Cond::And(vec![s, rhs]),
        }
    }
}

impl std::ops::BitOr for Cond {
    type Output = Cond;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            Cond::Or(mut v) => {
                v.push(rhs);
                Cond::Or(v)
            }
            s => Cond::Or(vec![s, rhs]),
        }
    }
}
