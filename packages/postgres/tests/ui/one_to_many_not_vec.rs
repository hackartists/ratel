//! `one_to_many` requires a `Vec<T>` field — applying it to a bare (non-Vec) field
//! must fail since there is no child collection to hydrate into.
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::PostgresEntity;

pub struct Child {
    pub id: Uuid,
}

#[derive(PostgresEntity)]
pub struct OneToManyNotVec {
    pub id: Uuid,
    #[postgres(one_to_many)]
    pub child: Child,
}

fn main() {}
