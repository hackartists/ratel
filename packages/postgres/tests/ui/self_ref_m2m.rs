//! self-referential `many_to_many` (target == the struct itself) can't derive distinct
//! from/to join-table keys by convention — both spellings of "self" must be rejected
//! unless `join_table`/`from_key`/`to_key` are all explicit:
//! - `Vec<Self>` (the `Self` keyword)
//! - `Vec<TheStructName>` (the struct's own ident spelled out)
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct SelfRefVecSelf {
    pub id: Uuid,
    #[postgres(many_to_many)]
    pub related: Vec<Self>,
}

#[derive(PostgresEntity)]
pub struct SelfRefVecIdent {
    pub id: Uuid,
    #[postgres(many_to_many)]
    pub related: Vec<SelfRefVecIdent>,
}

fn main() {}
