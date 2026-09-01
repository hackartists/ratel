use postgres::ident::{normalize_ident, qualified_with};

#[test]
fn normalizes_hyphen_and_case() {
    assert_eq!(normalize_ident("Asset-Prod-User"), "asset_prod_user");
    assert_eq!(normalize_ident("user"), "user");
    assert_eq!(normalize_ident("a b.c"), "a_b_c");
}

#[test]
fn qualified_joins_prefix_with_underscore() {
    assert_eq!(
        qualified_with(Some("asset-prod"), "user"),
        "asset_prod_user"
    );
    assert_eq!(qualified_with(None, "user"), "user");
}
