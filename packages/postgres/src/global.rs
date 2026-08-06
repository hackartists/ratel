//! 프로세스 전역 커넥션 풀 — 이 크레이트의 **일차(primary) API**.
//!
//! 애플리케이션은 부팅 시 [`set_global_pool`](crate::set_global_pool) 을 정확히 한 번
//! 호출해 풀을 심고(first-wins — 이후 호출은 조용히 무시), 그 뒤로는 pool 인자 없이
//! `X::repository()` / `Tx::begin()` / `X::get_by_id(id)` / `x.upsert()` 등을 쓴다.
//! asset-storage 의 `crate::config::get().postgres()` 대응. 심기 전에 [`pool`] 을
//! 호출하면 panic 한다 (설정 여부만 확인하려면 [`try_pool`]).
//!
//! 명시적 풀이 필요한 경우(테스트에서 서로 다른 풀 등)의 탈출구는
//! `PostgresRepository::new(pool)` / `Tx::begin_with(&pool)`.

use std::sync::OnceLock;

use crate::sqlx::PgPool;

static POOL: OnceLock<PgPool> = OnceLock::new();

/// 프로세스 전역 풀을 설정한다 — 이 크레이트의 일차 진입점. 첫 호출만 반영되고
/// (first-wins), 이후 호출은 조용히 무시된다. 크레이트 루트(`postgres::set_global_pool`)
/// 와 prelude 로도 재노출된다.
pub fn set_global_pool(pool: PgPool) {
    let _ = POOL.set(pool);
}

/// [`set_global_pool`] 의 내부용 별칭 (하위 호환). 신규 코드는 `set_global_pool` 을 쓴다.
pub fn init(pool: PgPool) {
    set_global_pool(pool);
}

/// 전역 풀 참조. [`set_global_pool`](crate::set_global_pool) 전에 호출하면 panic 한다.
pub fn pool() -> &'static PgPool {
    POOL.get()
        .expect("postgres global pool not set — call postgres::set_global_pool(pool) at startup")
}

/// 전역 풀 참조 (미설정이면 `None`). panic 없이 설정 여부를 확인하는 용도.
pub fn try_pool() -> Option<&'static PgPool> {
    POOL.get()
}
