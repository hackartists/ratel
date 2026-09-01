//! `PostgresJson` supports named-field structs, single-field tuple newtypes, and enums —
//! applying it to a `union` must still fail (jsonb serialization has no union shape).
#![allow(dead_code)]

use postgres::PostgresJson;

#[derive(PostgresJson)]
pub union NotAStruct {
    a: u32,
    b: f32,
}

fn main() {}
