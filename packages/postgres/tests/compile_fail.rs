//! Task 14 — trybuild 컴파일 실패 스위트.
//!
//! `#[derive(PostgresEntity)]`/`PostgresEnum`/`PostgresJson`가 잘못된 선언을 컴파일
//! 타임에 거부하는지, 그리고 거부 메시지가 매크로 내부(`entity/model.rs`,
//! `postgres_enum.rs`, `postgres_json.rs`)의 의도한 `compile_error!`인지를 증명한다.
#![allow(dead_code)]

#[test]
fn ui() {
    let t = trybuild::TestCases::new();
    t.compile_fail("tests/ui/no_pk.rs"); // pk 필드 없음
    t.compile_fail("tests/ui/data_enum.rs"); // PostgresEnum 에 data-carrying variant
    t.compile_fail("tests/ui/self_ref_m2m.rs"); // self-referential many_to_many 키 생략 (Vec<Self> + Vec<Ident> 스펠링)
    t.compile_fail("tests/ui/custom_ref_no_type.rs"); // custom reference_key + type 누락
    t.compile_fail("tests/ui/json_non_struct.rs"); // PostgresJson 을 union 에 적용 (enum 은 이제 허용)
    t.compile_fail("tests/ui/json_multi_tuple.rs"); // PostgresJson 을 multi-field tuple struct 에 적용
    t.compile_fail("tests/ui/one_to_many_not_vec.rs"); // one_to_many 를 non-Vec 필드에 적용
    t.compile_fail("tests/ui/bare_vec_field.rs"); // 관계 attr 없는 bare Vec<T> 필드
    t.compile_fail("tests/ui/bare_option_vec_field.rs"); // 관계 attr 없는 bare Option<Vec<T>> 필드
    t.compile_fail("tests/ui/fk_bad_on_delete.rs"); // on_delete allowlist 밖의 값
    t.compile_fail("tests/ui/fk_both_names.rs"); // references + foreign_key 동시 선언
    t.compile_fail("tests/ui/multiple_default_order.rs"); // default_order 필드가 2개 이상
    t.compile_fail("tests/ui/composite_unique_unknown_field.rs"); // unique(...) 가 실존하지 않는 필드 참조
    t.compile_fail("tests/ui/version_must_be_integer.rs"); // version 문자열 금지
    t.compile_fail("tests/ui/versioned_non_null_without_default.rs"); // 자동/명시 default 없는 필수 컬럼
    t.compile_fail("tests/ui/versioned_unique.rs"); // 기존 DB unique 자동 추가 금지
}
