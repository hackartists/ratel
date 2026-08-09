//! At most one field may carry `#[postgres(default_order)]` — finders can only sort by a
//! single column, so two `default_order` fields on the same struct is ambiguous and must be
//! a compile error rather than silently picking one.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct MultipleDefaultOrder {
    pub id: Uuid,
    #[postgres(default_order)]
    pub created_at: i64,
    #[postgres(default_order)]
    pub updated_at: i64,
}

fn main() {}
