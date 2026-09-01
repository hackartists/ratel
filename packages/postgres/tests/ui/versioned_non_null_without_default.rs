use postgres::PostgresEntity;
use postgres::uuid::Uuid;

#[derive(Default, PostgresEntity)]
struct MissingDefault {
    id: Uuid,
    #[postgres(version = 1)]
    owner_id: Uuid,
}

fn main() {}
