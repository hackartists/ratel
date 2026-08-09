use postgres::PostgresEntity;
use postgres::uuid::Uuid;

#[derive(Default, PostgresEntity)]
struct BadVersion {
    id: Uuid,
    #[postgres(version = "1")]
    value: String,
}

fn main() {}
