use crate::cond::{Cond, PredExpr, escape_like};
use crate::value::Value;

/// 연산자(Op) → 렌더 가능한 [`Cond`] 로 낮추는 변환.
pub trait OpLower {
    fn lower(self, column: &'static str) -> Cond;
}

/// 편의 빌더 payload(`&str` 등) → 정규화된 연산자 타입으로의 변환.
pub trait IntoOp<T> {
    fn into_op(self) -> T;
}

// ─────────────────────────── StringOp ───────────────────────────

pub enum StringOp<S = String> {
    Eq(S),
    Ne(S),
    Like(S),
    ILike(S),
    StartsWith(S),
    EndsWith(S),
    Contains(S),
    In(Vec<S>),
    And(Vec<StringOp<S>>),
    Or(Vec<StringOp<S>>),
}

impl<S> std::ops::BitOr for StringOp<S> {
    type Output = StringOp<S>;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            StringOp::Or(mut v) => {
                v.push(rhs);
                StringOp::Or(v)
            }
            s => StringOp::Or(vec![s, rhs]),
        }
    }
}

impl<S> std::ops::BitAnd for StringOp<S> {
    type Output = StringOp<S>;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            StringOp::And(mut v) => {
                v.push(rhs);
                StringOp::And(v)
            }
            s => StringOp::And(vec![s, rhs]),
        }
    }
}

impl<S> StringOp<S> {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

impl<S: Into<String>> StringOp<S> {
    fn normalize(self) -> StringOp<String> {
        match self {
            StringOp::Eq(v) => StringOp::Eq(v.into()),
            StringOp::Ne(v) => StringOp::Ne(v.into()),
            StringOp::Like(v) => StringOp::Like(v.into()),
            StringOp::ILike(v) => StringOp::ILike(v.into()),
            StringOp::StartsWith(v) => StringOp::StartsWith(v.into()),
            StringOp::EndsWith(v) => StringOp::EndsWith(v.into()),
            StringOp::Contains(v) => StringOp::Contains(v.into()),
            StringOp::In(vs) => StringOp::In(vs.into_iter().map(Into::into).collect()),
            StringOp::And(ops) => StringOp::And(ops.into_iter().map(|o| o.normalize()).collect()),
            StringOp::Or(ops) => StringOp::Or(ops.into_iter().map(|o| o.normalize()).collect()),
        }
    }
}

impl OpLower for StringOp<String> {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            StringOp::Eq(v) => Cond::pred(col, PredExpr::Cmp("=", v.into())),
            StringOp::Ne(v) => Cond::pred(col, PredExpr::Cmp("<>", v.into())),
            StringOp::Like(p) => Cond::pred(
                col,
                PredExpr::LikePat {
                    ilike: false,
                    pattern: p,
                },
            ),
            StringOp::ILike(p) => Cond::pred(
                col,
                PredExpr::LikePat {
                    ilike: true,
                    pattern: p,
                },
            ),
            StringOp::StartsWith(v) => Cond::pred(
                col,
                PredExpr::LikePat {
                    ilike: false,
                    pattern: format!("{}%", escape_like(&v)),
                },
            ),
            StringOp::EndsWith(v) => Cond::pred(
                col,
                PredExpr::LikePat {
                    ilike: false,
                    pattern: format!("%{}", escape_like(&v)),
                },
            ),
            StringOp::Contains(v) => Cond::pred(
                col,
                PredExpr::LikePat {
                    ilike: false,
                    pattern: format!("%{}%", escape_like(&v)),
                },
            ),
            StringOp::In(vs) => {
                Cond::pred(col, PredExpr::In(vs.into_iter().map(Into::into).collect()))
            }
            StringOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            StringOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl<S: Into<String>> IntoOp<StringOp> for StringOp<S> {
    fn into_op(self) -> StringOp {
        self.normalize()
    }
}

// ─────────────────────────── NumOp / TimeOp ───────────────────────────

pub enum NumOp<T> {
    Eq(T),
    Ne(T),
    Gt(T),
    Gte(T),
    Lt(T),
    Lte(T),
    Between(T, T),
    In(Vec<T>),
    And(Vec<NumOp<T>>),
    Or(Vec<NumOp<T>>),
}

pub type TimeOp = NumOp<chrono::DateTime<chrono::Utc>>;

impl<T> std::ops::BitOr for NumOp<T> {
    type Output = NumOp<T>;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            NumOp::Or(mut v) => {
                v.push(rhs);
                NumOp::Or(v)
            }
            s => NumOp::Or(vec![s, rhs]),
        }
    }
}

impl<T> std::ops::BitAnd for NumOp<T> {
    type Output = NumOp<T>;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            NumOp::And(mut v) => {
                v.push(rhs);
                NumOp::And(v)
            }
            s => NumOp::And(vec![s, rhs]),
        }
    }
}

impl<T> NumOp<T> {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

impl<T: Into<Value>> OpLower for NumOp<T> {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            NumOp::Eq(v) => Cond::pred(col, PredExpr::Cmp("=", v.into())),
            NumOp::Ne(v) => Cond::pred(col, PredExpr::Cmp("<>", v.into())),
            NumOp::Gt(v) => Cond::pred(col, PredExpr::Cmp(">", v.into())),
            NumOp::Gte(v) => Cond::pred(col, PredExpr::Cmp(">=", v.into())),
            NumOp::Lt(v) => Cond::pred(col, PredExpr::Cmp("<", v.into())),
            NumOp::Lte(v) => Cond::pred(col, PredExpr::Cmp("<=", v.into())),
            NumOp::Between(a, b) => Cond::pred(col, PredExpr::Between(a.into(), b.into())),
            NumOp::In(vs) => {
                Cond::pred(col, PredExpr::In(vs.into_iter().map(Into::into).collect()))
            }
            NumOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            NumOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl<T: Into<Value>> IntoOp<NumOp<T>> for NumOp<T> {
    fn into_op(self) -> NumOp<T> {
        self
    }
}

// ─────────────────────────── BoolOp ───────────────────────────

pub enum BoolOp {
    Eq(bool),
    Ne(bool),
    And(Vec<BoolOp>),
    Or(Vec<BoolOp>),
}

impl std::ops::BitOr for BoolOp {
    type Output = BoolOp;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            BoolOp::Or(mut v) => {
                v.push(rhs);
                BoolOp::Or(v)
            }
            s => BoolOp::Or(vec![s, rhs]),
        }
    }
}

impl std::ops::BitAnd for BoolOp {
    type Output = BoolOp;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            BoolOp::And(mut v) => {
                v.push(rhs);
                BoolOp::And(v)
            }
            s => BoolOp::And(vec![s, rhs]),
        }
    }
}

impl BoolOp {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

impl OpLower for BoolOp {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            BoolOp::Eq(v) => Cond::pred(col, PredExpr::Cmp("=", v.into())),
            BoolOp::Ne(v) => Cond::pred(col, PredExpr::Cmp("<>", v.into())),
            BoolOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            BoolOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl IntoOp<BoolOp> for BoolOp {
    fn into_op(self) -> BoolOp {
        self
    }
}

// ─────────────────────────── UuidOp ───────────────────────────

pub enum UuidOp {
    Eq(uuid::Uuid),
    Ne(uuid::Uuid),
    In(Vec<uuid::Uuid>),
    And(Vec<UuidOp>),
    Or(Vec<UuidOp>),
}

impl std::ops::BitOr for UuidOp {
    type Output = UuidOp;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            UuidOp::Or(mut v) => {
                v.push(rhs);
                UuidOp::Or(v)
            }
            s => UuidOp::Or(vec![s, rhs]),
        }
    }
}

impl std::ops::BitAnd for UuidOp {
    type Output = UuidOp;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            UuidOp::And(mut v) => {
                v.push(rhs);
                UuidOp::And(v)
            }
            s => UuidOp::And(vec![s, rhs]),
        }
    }
}

impl UuidOp {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

impl OpLower for UuidOp {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            UuidOp::Eq(v) => Cond::pred(col, PredExpr::Cmp("=", v.into())),
            UuidOp::Ne(v) => Cond::pred(col, PredExpr::Cmp("<>", v.into())),
            UuidOp::In(vs) => {
                Cond::pred(col, PredExpr::In(vs.into_iter().map(Into::into).collect()))
            }
            UuidOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            UuidOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl IntoOp<UuidOp> for UuidOp {
    fn into_op(self) -> UuidOp {
        self
    }
}

// ─────────────────────────── EnumOp ───────────────────────────

pub enum EnumOp<E> {
    Eq(E),
    Ne(E),
    In(Vec<E>),
    And(Vec<EnumOp<E>>),
    Or(Vec<EnumOp<E>>),
}

impl<E> std::ops::BitOr for EnumOp<E> {
    type Output = EnumOp<E>;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            EnumOp::Or(mut v) => {
                v.push(rhs);
                EnumOp::Or(v)
            }
            s => EnumOp::Or(vec![s, rhs]),
        }
    }
}

impl<E> std::ops::BitAnd for EnumOp<E> {
    type Output = EnumOp<E>;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            EnumOp::And(mut v) => {
                v.push(rhs);
                EnumOp::And(v)
            }
            s => EnumOp::And(vec![s, rhs]),
        }
    }
}

impl<E> EnumOp<E> {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

// 낮춤은 derive 가 생성한 모드 인지형 `From<E> for Value` 를 통과시킨다:
// native enum 은 `Value::Enum`(→ `::타입` 캐스트), `#[postgres(text)]` enum 은
// `Value::Text`(캐스트 없음) 를 만든다. 여기서 `Value::Enum` 을 직접 만들면
// text enum 에도 존재하지 않는 PG 타입으로 캐스트하는 SQL 을 뿜게 된다.
impl<E: crate::entity::PostgresEnumMeta + Into<Value>> OpLower for EnumOp<E> {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            EnumOp::Eq(v) => Cond::pred(col, PredExpr::Cmp("=", v.into())),
            EnumOp::Ne(v) => Cond::pred(col, PredExpr::Cmp("<>", v.into())),
            EnumOp::In(vs) => {
                Cond::pred(col, PredExpr::In(vs.into_iter().map(Into::into).collect()))
            }
            EnumOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            EnumOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl<E> IntoOp<EnumOp<E>> for EnumOp<E> {
    fn into_op(self) -> EnumOp<E> {
        self
    }
}

// ─────────────────────────── JsonOp ───────────────────────────

pub enum JsonOp<T> {
    Eq(T),
    Ne(T),
    Contains(serde_json::Value),
    ContainedBy(serde_json::Value),
    And(Vec<JsonOp<T>>),
    Or(Vec<JsonOp<T>>),
}

impl<T> std::ops::BitOr for JsonOp<T> {
    type Output = JsonOp<T>;
    fn bitor(self, rhs: Self) -> Self {
        match self {
            JsonOp::Or(mut v) => {
                v.push(rhs);
                JsonOp::Or(v)
            }
            s => JsonOp::Or(vec![s, rhs]),
        }
    }
}

impl<T> std::ops::BitAnd for JsonOp<T> {
    type Output = JsonOp<T>;
    fn bitand(self, rhs: Self) -> Self {
        match self {
            JsonOp::And(mut v) => {
                v.push(rhs);
                JsonOp::And(v)
            }
            s => JsonOp::And(vec![s, rhs]),
        }
    }
}

impl<T> JsonOp<T> {
    pub fn or(self, rhs: Self) -> Self {
        self | rhs
    }
    pub fn and(self, rhs: Self) -> Self {
        self & rhs
    }
}

impl<T: serde::Serialize> OpLower for JsonOp<T> {
    fn lower(self, col: &'static str) -> Cond {
        match self {
            JsonOp::Eq(v) => Cond::pred(
                col,
                PredExpr::Cmp(
                    "=",
                    Value::Json(serde_json::to_value(v).expect("JsonOp serialize")),
                ),
            ),
            JsonOp::Ne(v) => Cond::pred(
                col,
                PredExpr::Cmp(
                    "<>",
                    Value::Json(serde_json::to_value(v).expect("JsonOp serialize")),
                ),
            ),
            JsonOp::Contains(v) => Cond::pred(col, PredExpr::Cmp("@>", Value::Json(v))),
            JsonOp::ContainedBy(v) => Cond::pred(col, PredExpr::Cmp("<@", Value::Json(v))),
            JsonOp::And(ops) => Cond::And(ops.into_iter().map(|o| o.lower(col)).collect()),
            JsonOp::Or(ops) => Cond::Or(ops.into_iter().map(|o| o.lower(col)).collect()),
        }
    }
}

impl<T> IntoOp<JsonOp<T>> for JsonOp<T> {
    fn into_op(self) -> JsonOp<T> {
        self
    }
}
