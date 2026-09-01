use postgres::PostgresEntity;
use postgres::uuid::Uuid;

#[derive(Default, PostgresEntity)]
struct UnsafeUnique {
    id: Uuid,
    #[postgres(version = 1, unique)]
    slug: String,
}

fn main() {}
