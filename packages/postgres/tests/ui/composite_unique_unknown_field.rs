//! struct-level `#[postgres(unique(a, b))]` must name real scalar/pk fields. Referencing a
//! column that no field declares is a typo that would otherwise only fail at runtime (the
//! `CREATE UNIQUE INDEX` referencing a nonexistent column) — the derive rejects it at compile
//! time instead.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
#[postgres(unique(workspace_id, nonexistent))]
pub struct CompositeUniqueUnknownField {
    pub id: Uuid,
    pub workspace_id: Uuid,
    pub application_number: String,
}

fn main() {}
