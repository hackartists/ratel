//! `PostgresJson` accepts a single-field tuple newtype but not a multi-field tuple
//! struct — the codegen serializes the whole value, so it needs exactly one field.
#![allow(dead_code)]

use postgres::PostgresJson;

#[derive(PostgresJson)]
pub struct NotANewtype(String, i32);

fn main() {}
