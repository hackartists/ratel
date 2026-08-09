//! `PostgresEntity` requires a primary key — no `#[postgres(pk)]` and no `id` field.
#![allow(dead_code)]

use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct NoPk {
    pub name: String,
}

fn main() {}
