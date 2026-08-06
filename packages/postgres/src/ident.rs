use std::sync::OnceLock;

static PREFIX: OnceLock<Option<String>> = OnceLock::new();

/// POSTGRES_PREFIX — 런타임 1회 읽기. 빈 문자열은 미설정 취급.
pub fn table_prefix() -> Option<&'static str> {
    PREFIX
        .get_or_init(|| {
            std::env::var("POSTGRES_PREFIX")
                .ok()
                .filter(|s| !s.is_empty())
        })
        .as_deref()
}

/// 소문자화 + `[^a-z0-9_]` → `_`
pub fn normalize_ident(raw: &str) -> String {
    raw.chars()
        .map(|c| {
            let c = c.to_ascii_lowercase();
            if c.is_ascii_alphanumeric() || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

/// 테스트 가능한 순수형: prefix 명시
pub fn qualified_with(prefix: Option<&str>, base: &str) -> String {
    match prefix {
        Some(p) => normalize_ident(&format!("{p}_{base}")),
        None => normalize_ident(base),
    }
}

/// env prefix 적용 최종 식별자
pub fn qualified_name(base: &str) -> String {
    qualified_with(table_prefix(), base)
}
