//! 기본 테이블명 자동 복수화 (no-DB, 순수 메타데이터).
//!
//! `#[postgres(table = "…")]` override 없이 선언한 엔티티의 기본 테이블 base 이름은
//! struct 이름 snake_case 에서 **마지막 underscore 세그먼트만 복수화**한 값이다:
//! `Article`→`articles`, `Company`→`companies`,
//! `EmailVerification`→`email_verifications`. `table = "…"` override 는 그대로 쓰이며
//! 복수화하지 않는다. DB 접속이 없다 — `base_name()` 은 매크로 확장 시점에 박힌 문자열
//! 리터럴이라 순수 컴파일 타임 값이다 (`name()` 은 여기에 prefix + 정규화만 더한다).
#![allow(dead_code)]

use postgres::uuid::Uuid;
use postgres::{PostgresEntity, PostgresObject};

/// 단일 세그먼트: `article` → `articles`.
#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct Article {
    pub id: Uuid,
}

/// `-y` → `-ies`: `company` → `companies`.
#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct Company {
    pub id: Uuid,
}

/// 다중 세그먼트 — 마지막만 복수화: `email_verification` → `email_verifications`
/// (앞 세그먼트 `email` 은 그대로).
#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct EmailVerification {
    pub id: Uuid,
}

/// override 는 복수화하지 않고 그대로 base 이름이 된다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "explicit_table")]
pub struct WithExplicitTable {
    pub id: Uuid,
}

#[test]
fn default_table_name_pluralizes_last_segment() {
    assert_eq!(Article::base_name(), "articles");
    assert_eq!(Company::base_name(), "companies");
    assert_eq!(EmailVerification::base_name(), "email_verifications");
    // override 는 verbatim (복수화 안 함).
    assert_eq!(WithExplicitTable::base_name(), "explicit_table");
}
