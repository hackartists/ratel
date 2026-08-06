//! A data-carrying (catch-all) `PostgresEnum` variant requires `#[postgres(text)]` —
//! a native PG enum type can't store arbitrary text. Here `Mixed` is native, so it fails.
#![allow(dead_code)]

use postgres::PostgresEnum;

#[derive(PostgresEnum)]
pub enum Mixed {
    Unit,
    Data(String),
}

fn main() {}
