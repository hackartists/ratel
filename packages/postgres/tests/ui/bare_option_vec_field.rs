//! A bare `Option<Vec<T>>` field with no relation attribute is not a column either —
//! it must fail with the same actionable diagnostic as a bare `Vec<T>` field (not a
//! downstream `PostgresType` trait error), since the outer `Option` segment previously
//! let it slip past the bare-`Vec` check.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct BareOptionVecField {
    pub id: Uuid,
    pub tags: Option<Vec<String>>,
}

fn main() {}
