//! `on_delete` must be one of the Postgres FK actions (case-insensitively) — a typo like
//! "NONSENSE" must be rejected at macro-expansion time, not surface only as a
//! `CREATE TABLE` failure at runtime once the DDL is executed.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(PostgresEntity)]
pub struct FkBadOnDelete {
    pub id: Uuid,
    #[postgres(references = "parents(id)", on_delete = "NONSENSE")]
    pub parent_id: Uuid,
}

fn main() {}
