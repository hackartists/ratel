//! `PgKey<T>` — arg-less 조회 메서드(`X::get_by_id` / `X::delete_by_id`)의 유연한 키
//! 변환. 호출자가 pk 타입 그대로(`Uuid`)든, 문자열(`String`/`&str`)이든 넘길 수 있게
//! 하고, 문자열→Uuid 는 파싱한다. asset-storage 의 동명 트레이트를 이식한 것이다.
//!
//! 두 타입 파라미터(대상 `T` = 트레이트 인자, 입력 = `Self`)가 서로 달라
//! `PgKey<String> for &str` 과 `PgKey<Uuid> for &str` 는 겹치지 않는다 (별개 트레이트
//! 인스턴스). 파싱 실패는 [`Error::InvalidKey`](crate::Error::InvalidKey) 로 매핑한다.

use crate::error::{Error, Result};

/// 임의의 입력을 엔티티 pk 타입 `T` 로 변환한다. 실패 가능 (문자열→Uuid 파싱 등).
pub trait PgKey<T> {
    fn into_pg_key(self) -> Result<T>;
}

// ── identity: String pk ──
impl PgKey<String> for String {
    fn into_pg_key(self) -> Result<String> {
        Ok(self)
    }
}
impl PgKey<String> for &str {
    fn into_pg_key(self) -> Result<String> {
        Ok(self.to_string())
    }
}
impl PgKey<String> for &String {
    fn into_pg_key(self) -> Result<String> {
        Ok(self.clone())
    }
}

// ── identity: Uuid pk ──
impl PgKey<uuid::Uuid> for uuid::Uuid {
    fn into_pg_key(self) -> Result<uuid::Uuid> {
        Ok(self)
    }
}
impl PgKey<uuid::Uuid> for &uuid::Uuid {
    fn into_pg_key(self) -> Result<uuid::Uuid> {
        Ok(*self)
    }
}

// ── identity: i64 pk ──
impl PgKey<i64> for i64 {
    fn into_pg_key(self) -> Result<i64> {
        Ok(self)
    }
}

// ── parse: 문자열 → Uuid ──
impl PgKey<uuid::Uuid> for &str {
    fn into_pg_key(self) -> Result<uuid::Uuid> {
        uuid::Uuid::parse_str(self).map_err(|e| Error::InvalidKey(e.to_string()))
    }
}
impl PgKey<uuid::Uuid> for String {
    fn into_pg_key(self) -> Result<uuid::Uuid> {
        uuid::Uuid::parse_str(&self).map_err(|e| Error::InvalidKey(e.to_string()))
    }
}
impl PgKey<uuid::Uuid> for &String {
    fn into_pg_key(self) -> Result<uuid::Uuid> {
        uuid::Uuid::parse_str(self).map_err(|e| Error::InvalidKey(e.to_string()))
    }
}
