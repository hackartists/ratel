use sqlx::{Postgres, QueryBuilder};

/// 바인딩 가능한 동적 SQL 값. 컬럼 타입별 variant + PG enum/JSONB 특수 케이스.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Text(String),
    I16(i16),
    I32(i32),
    I64(i64),
    F32(f32),
    F64(f64),
    Bool(bool),
    Uuid(uuid::Uuid),
    Timestamp(chrono::DateTime<chrono::Utc>),
    /// PG enum: (라벨, prefix 적용된 타입명) — `$n::타입` 캐스트로 바인딩
    Enum(String, String),
    /// JSONB — PostgresJson derive 의 From impl 이 생성
    Json(serde_json::Value),
    Null,
}

impl Value {
    pub fn push_bind(self, qb: &mut QueryBuilder<'_, Postgres>) {
        match self {
            Value::Text(v) => {
                qb.push_bind(v);
            }
            Value::I16(v) => {
                qb.push_bind(v);
            }
            Value::I32(v) => {
                qb.push_bind(v);
            }
            Value::I64(v) => {
                qb.push_bind(v);
            }
            Value::F32(v) => {
                qb.push_bind(v);
            }
            Value::F64(v) => {
                qb.push_bind(v);
            }
            Value::Bool(v) => {
                qb.push_bind(v);
            }
            Value::Uuid(v) => {
                qb.push_bind(v);
            }
            Value::Timestamp(v) => {
                qb.push_bind(v);
            }
            Value::Enum(label, ty) => {
                qb.push_bind(label);
                qb.push(format!("::{ty}"));
            }
            Value::Json(v) => {
                qb.push_bind(v);
            }
            Value::Null => {
                qb.push("NULL");
            }
        }
    }
}

impl From<String> for Value {
    fn from(v: String) -> Self {
        Value::Text(v)
    }
}
impl From<&str> for Value {
    fn from(v: &str) -> Self {
        Value::Text(v.to_string())
    }
}
impl From<i16> for Value {
    fn from(v: i16) -> Self {
        Value::I16(v)
    }
}
impl From<i32> for Value {
    fn from(v: i32) -> Self {
        Value::I32(v)
    }
}
impl From<i64> for Value {
    fn from(v: i64) -> Self {
        Value::I64(v)
    }
}
impl From<f32> for Value {
    fn from(v: f32) -> Self {
        Value::F32(v)
    }
}
impl From<f64> for Value {
    fn from(v: f64) -> Self {
        Value::F64(v)
    }
}
impl From<bool> for Value {
    fn from(v: bool) -> Self {
        Value::Bool(v)
    }
}
impl From<uuid::Uuid> for Value {
    fn from(v: uuid::Uuid) -> Self {
        Value::Uuid(v)
    }
}
impl From<chrono::DateTime<chrono::Utc>> for Value {
    fn from(v: chrono::DateTime<chrono::Utc>) -> Self {
        Value::Timestamp(v)
    }
}

impl<T: Into<Value>> From<Option<T>> for Value {
    fn from(v: Option<T>) -> Self {
        match v {
            Some(v) => v.into(),
            None => Value::Null,
        }
    }
}

/// PK 자동 채번: nil Uuid → v7. 그 외 통과.
pub fn init_pk(v: Value) -> Value {
    match v {
        Value::Uuid(u) if u.is_nil() => Value::Uuid(uuid::Uuid::now_v7()),
        v => v,
    }
}
