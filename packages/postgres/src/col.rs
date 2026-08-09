use std::marker::PhantomData;

use crate::cond::{Cond, PredExpr};
use crate::entity::{PostgresEnumMeta, PostgresType};
use crate::ops::{BoolOp, EnumOp, IntoOp, JsonOp, NumOp, OpLower, StringOp, UuidOp};
use crate::value::Value;

/// 타입 있는 컬럼 참조. `T` 는 이 컬럼의 Rust 스칼라 타입 (`PostgresType` 구현체).
pub struct Col<T> {
    pub name: &'static str,
    _t: PhantomData<T>,
}

// PhantomData<T> 는 T 에 상관없이 Copy/Clone 이므로, derive 가 강제하는
// `T: Clone`/`T: Copy` 바운드를 피하기 위해 수동으로 구현한다.
impl<T> Clone for Col<T> {
    fn clone(&self) -> Self {
        *self
    }
}
impl<T> Copy for Col<T> {}

impl<T> Col<T> {
    pub fn new(name: &'static str) -> Self {
        Self {
            name,
            _t: PhantomData,
        }
    }
}

impl<T: PostgresType> Col<T> {
    pub fn op(self, op: impl IntoOp<T::Op>) -> Cond {
        op.into_op().lower(self.name)
    }
    pub fn is_null(self) -> Cond {
        Cond::pred(self.name, PredExpr::IsNull(true))
    }
    pub fn is_not_null(self) -> Cond {
        Cond::pred(self.name, PredExpr::IsNull(false))
    }
}

// ─────────────────────────── StringCol ───────────────────────────

pub trait StringCol {
    fn eq(self, v: impl Into<String>) -> Cond;
    fn ne(self, v: impl Into<String>) -> Cond;
    fn like(self, v: impl Into<String>) -> Cond;
    fn ilike(self, v: impl Into<String>) -> Cond;
    fn starts_with(self, v: impl Into<String>) -> Cond;
    fn ends_with(self, v: impl Into<String>) -> Cond;
    fn contains(self, v: impl Into<String>) -> Cond;
    fn in_(self, vs: Vec<String>) -> Cond;
}

impl<T: PostgresType<Op = StringOp>> StringCol for Col<T> {
    fn eq(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::Eq(v.into()))
    }
    fn ne(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::Ne(v.into()))
    }
    fn like(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::Like(v.into()))
    }
    fn ilike(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::ILike(v.into()))
    }
    fn starts_with(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::StartsWith(v.into()))
    }
    fn ends_with(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::EndsWith(v.into()))
    }
    fn contains(self, v: impl Into<String>) -> Cond {
        self.op(StringOp::Contains(v.into()))
    }
    fn in_(self, vs: Vec<String>) -> Cond {
        self.op(StringOp::In(vs))
    }
}

// ─────────────────────────── OrdCol ───────────────────────────

pub trait OrdCol<V> {
    fn eq(self, v: V) -> Cond;
    fn ne(self, v: V) -> Cond;
    fn gt(self, v: V) -> Cond;
    fn gte(self, v: V) -> Cond;
    fn lt(self, v: V) -> Cond;
    fn lte(self, v: V) -> Cond;
    fn between(self, a: V, b: V) -> Cond;
    fn in_(self, vs: Vec<V>) -> Cond;
}

impl<T, V> OrdCol<V> for Col<T>
where
    T: PostgresType<Op = NumOp<V>>,
    V: Into<Value>,
{
    fn eq(self, v: V) -> Cond {
        self.op(NumOp::Eq(v))
    }
    fn ne(self, v: V) -> Cond {
        self.op(NumOp::Ne(v))
    }
    fn gt(self, v: V) -> Cond {
        self.op(NumOp::Gt(v))
    }
    fn gte(self, v: V) -> Cond {
        self.op(NumOp::Gte(v))
    }
    fn lt(self, v: V) -> Cond {
        self.op(NumOp::Lt(v))
    }
    fn lte(self, v: V) -> Cond {
        self.op(NumOp::Lte(v))
    }
    fn between(self, a: V, b: V) -> Cond {
        self.op(NumOp::Between(a, b))
    }
    fn in_(self, vs: Vec<V>) -> Cond {
        self.op(NumOp::In(vs))
    }
}

// ─────────────────────────── BoolCol ───────────────────────────

pub trait BoolCol {
    fn eq(self, v: bool) -> Cond;
    fn ne(self, v: bool) -> Cond;
}

impl<T: PostgresType<Op = BoolOp>> BoolCol for Col<T> {
    fn eq(self, v: bool) -> Cond {
        self.op(BoolOp::Eq(v))
    }
    fn ne(self, v: bool) -> Cond {
        self.op(BoolOp::Ne(v))
    }
}

// ─────────────────────────── UuidCol ───────────────────────────

pub trait UuidCol {
    fn eq(self, v: uuid::Uuid) -> Cond;
    fn ne(self, v: uuid::Uuid) -> Cond;
    fn in_(self, vs: Vec<uuid::Uuid>) -> Cond;
}

impl<T: PostgresType<Op = UuidOp>> UuidCol for Col<T> {
    fn eq(self, v: uuid::Uuid) -> Cond {
        self.op(UuidOp::Eq(v))
    }
    fn ne(self, v: uuid::Uuid) -> Cond {
        self.op(UuidOp::Ne(v))
    }
    fn in_(self, vs: Vec<uuid::Uuid>) -> Cond {
        self.op(UuidOp::In(vs))
    }
}

// ─────────────────────────── EnumCol ───────────────────────────

pub trait EnumCol<E> {
    fn eq(self, v: E) -> Cond;
    fn ne(self, v: E) -> Cond;
    fn in_(self, vs: Vec<E>) -> Cond;
}

impl<T, E> EnumCol<E> for Col<T>
where
    T: PostgresType<Op = EnumOp<E>>,
    E: PostgresEnumMeta + Into<Value>,
{
    fn eq(self, v: E) -> Cond {
        self.op(EnumOp::Eq(v))
    }
    fn ne(self, v: E) -> Cond {
        self.op(EnumOp::Ne(v))
    }
    fn in_(self, vs: Vec<E>) -> Cond {
        self.op(EnumOp::In(vs))
    }
}

// ─────────────────────────── JsonCol ───────────────────────────

pub trait JsonCol<J> {
    fn eq(self, v: J) -> Cond;
    fn ne(self, v: J) -> Cond;
    fn contains(self, v: serde_json::Value) -> Cond;
    fn contained_by(self, v: serde_json::Value) -> Cond;
}

impl<T, J> JsonCol<J> for Col<T>
where
    T: PostgresType<Op = JsonOp<J>>,
    J: serde::Serialize,
{
    fn eq(self, v: J) -> Cond {
        self.op(JsonOp::Eq(v))
    }
    fn ne(self, v: J) -> Cond {
        self.op(JsonOp::Ne(v))
    }
    fn contains(self, v: serde_json::Value) -> Cond {
        self.op(JsonOp::Contains(v))
    }
    fn contained_by(self, v: serde_json::Value) -> Cond {
        self.op(JsonOp::ContainedBy(v))
    }
}
