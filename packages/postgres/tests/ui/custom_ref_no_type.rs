//! An owning relation with a custom `reference_key` (not the target's pk) needs an
//! explicit `type = "..."` so the macro knows the FK column's SQL type — it can't see
//! the target's field type from here.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

pub struct RefTarget {
    pub id: Uuid,
    pub email: String,
}

#[derive(PostgresEntity)]
pub struct CustomRefNoType {
    pub id: Uuid,
    #[postgres(many_to_one, reference_key = "email")]
    pub target: RefTarget,
}

fn main() {}
