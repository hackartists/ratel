//! 통합 테스트용 공용 헬퍼. `tests/*.rs` 에서 `mod common;` 로 포함한다
//! (하위 디렉터리이므로 별도 테스트 바이너리로 컴파일되지 않는다).

/// `DATABASE_URL`(없으면 로컬 기본값)로 커넥션 풀을 열고, 프로세스 전역 풀로도 심는다
/// (first-wins). 이후 no-arg `X::repository()` / `Tx::begin()` 이 이 풀을 쓴다. 반환된
/// 핸들은 명시적 풀이 필요한 곳(raw sqlx, `schema.create(&pool)`, `Tx::begin_with` 등)에서
/// 그대로 쓸 수 있다.
pub async fn pool() -> postgres::sqlx::PgPool {
    let url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres@localhost:5432/postgres".into());
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .max_connections(4)
        .connect(&url)
        .await
        .expect("postgres unreachable — run `make pg` first");
    // 전역 풀 시딩 (first-wins) — 한 테스트 바이너리 안에서 첫 호출만 반영된다.
    postgres::set_global_pool(pool.clone());
    pool
}
