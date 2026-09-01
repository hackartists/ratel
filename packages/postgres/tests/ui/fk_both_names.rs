//! A field must not declare both `references` and `foreign_key` — they are synonyms for
//! the same scalar FK-only constraint, so declaring both is ambiguous rather than a
//! silent "first one wins".
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct FkBothNames {
    pub id: Uuid,
    #[postgres(references = "parents(id)", foreign_key = "parents(id)")]
    pub parent_id: Uuid,
}

fn main() {}
