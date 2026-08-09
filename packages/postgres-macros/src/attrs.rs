//! `#[postgres(...)]` 어트리뷰트 파서 — key=value 문자열 + bare flag 를 모은다.
//!
//! PostgresEnum(Task 8)·PostgresEntity(Task 9)·PostgresJson(Task 8.5) 가 공유한다.
//! 예: `#[postgres(type = "role", text)]`, `#[postgres(rename = "member_x")]`,
//! `#[postgres(table = "orders")]`.

use std::collections::{HashMap, HashSet};
use syn::{Attribute, Lit};

/// 한 항목(struct/variant/field)에 붙은 모든 `#[postgres(...)]` 의 병합 결과.
///
/// 세 가지 문법을 지원한다:
/// - `key = "value"` → [`values`](Self::get)
/// - bare `flag` → [`flags`](Self::has_flag)
/// - `key(inner = "…", flag, …)` 중첩 리스트 → [`lists`](Self::get_list) (재귀적으로
///   같은 `PostgresAttrs` 로 파싱). `#[postgres(references(table = "…", column = "…"))]`
///   같은 full-form FK 문법에 쓰인다.
#[derive(Default)]
pub struct PostgresAttrs {
    values: HashMap<String, String>,
    integers: HashMap<String, u64>,
    flags: HashSet<String>,
    lists: HashMap<String, PostgresAttrs>,
    /// struct-level `#[postgres(unique(a, b, …))]` 복합 UNIQUE 그룹들. `lists`/`flags`
    /// 와 달리 **컬럼 순서와 중복(여러 `unique(...)`)을 모두 보존**한다 — 복합 UNIQUE
    /// 인덱스명·컬럼 순서가 순서에 의존하고, 한 struct 에 여러 개를 걸 수 있기 때문이다.
    composite_uniques: Vec<Vec<String>>,
}

impl PostgresAttrs {
    /// 대상 항목의 attribute 슬라이스에서 `postgres` path 만 골라 파싱.
    pub fn parse(attrs: &[Attribute]) -> syn::Result<Self> {
        let mut out = PostgresAttrs::default();
        for attr in attrs {
            if !attr.path().is_ident("postgres") {
                continue;
            }
            attr.parse_nested_meta(|meta| out.consume(meta))?;
        }
        Ok(out)
    }

    /// `parse_nested_meta` 콜백 본체 — 한 개의 meta 항목을 소비한다. 중첩 리스트
    /// (`key(...)`)를 만나면 같은 로직으로 재귀 파싱해 하위 `PostgresAttrs` 로 담는다.
    fn consume(&mut self, meta: syn::meta::ParseNestedMeta) -> syn::Result<()> {
        let key = meta.path.require_ident()?.to_string();
        if meta.input.peek(syn::Token![=]) {
            let lit: Lit = meta.value()?.parse()?;
            match lit {
                Lit::Str(lit) => {
                    self.values.insert(key, lit.value());
                }
                Lit::Int(lit) => {
                    self.integers.insert(key, lit.base10_parse()?);
                }
                other => {
                    return Err(syn::Error::new_spanned(
                        other,
                        "postgres attribute values must be string or integer literals",
                    ));
                }
            }
        } else if meta.input.peek(syn::token::Paren) {
            // `unique(col_a, col_b, …)` — struct-level 복합 UNIQUE. bare-ident 목록을
            // **순서대로** 모아 `composite_uniques` 에 push 한다(여러 번 등장 가능).
            // 나머지 `key(...)` 는 기존대로 재귀 파싱해 `lists` 로. (field-level bare
            // `unique` 플래그는 Paren 이 없어 아래 `else` 로 빠지므로 충돌하지 않는다.)
            if key == "unique" {
                let mut cols = Vec::new();
                meta.parse_nested_meta(|inner| {
                    cols.push(inner.path.require_ident()?.to_string());
                    Ok(())
                })?;
                self.composite_uniques.push(cols);
            } else {
                let mut nested = PostgresAttrs::default();
                meta.parse_nested_meta(|inner| nested.consume(inner))?;
                self.lists.insert(key, nested);
            }
        } else {
            self.flags.insert(key);
        }
        Ok(())
    }

    /// `key = "value"` 조회.
    pub fn get(&self, key: &str) -> Option<&str> {
        self.values.get(key).map(String::as_str)
    }

    /// 정수 리터럴(`version = 1`) 조회.
    pub fn get_u64(&self, key: &str) -> Option<u64> {
        self.integers.get(key).copied()
    }

    /// bare flag(`text` 등) 존재 여부.
    pub fn has_flag(&self, key: &str) -> bool {
        self.flags.contains(key)
    }

    /// 중첩 리스트(`key(...)`) 조회 — 없으면 `None`.
    pub fn get_list(&self, key: &str) -> Option<&PostgresAttrs> {
        self.lists.get(key)
    }

    /// struct-level `#[postgres(unique(a, b, …))]` 복합 UNIQUE 그룹들(선언 순서 보존).
    /// 각 그룹은 필드 ident 문자열의 순서 있는 목록이다.
    pub fn composite_uniques(&self) -> &[Vec<String>] {
        &self.composite_uniques
    }
}
