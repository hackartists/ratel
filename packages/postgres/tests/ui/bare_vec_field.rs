//! A bare `Vec<T>` field with no relation attribute is not a column — it must fail
//! with an actionable diagnostic (not a downstream `PostgresType` trait error)
//! pointing at `#[derive(PostgresJson)]` newtypes or a relation attribute.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct BareVecField {
    pub id: Uuid,
    pub tags: Vec<String>,
}

fn main() {}
