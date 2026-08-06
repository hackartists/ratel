use postgres::cond::{Cond, escape_like};
use postgres::ops::{IntoOp, NumOp, OpLower, StringOp};
use postgres::sqlx::{Postgres, QueryBuilder};

fn render(c: Cond) -> String {
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new("");
    c.render(&mut qb);
    qb.sql().to_string()
}

#[test]
fn escape_like_escapes_wildcards() {
    assert_eq!(escape_like(r"a%b_c\d"), r"a\%b\_c\\d");
}

#[test]
fn string_or_combinator_renders_grouped() {
    let op = StringOp::StartsWith("a") | StringOp::EndsWith("c");
    let sql = render(op.into_op().lower("name"));
    assert_eq!(
        sql,
        r#"("name" LIKE $1 ESCAPE '\' OR "name" LIKE $2 ESCAPE '\')"#
    );
}

#[test]
fn num_between_and_empty_in() {
    let sql = render(NumOp::Between(1i64, 5i64).lower("age"));
    assert_eq!(sql, r#""age" BETWEEN $1 AND $2"#);
    let sql = render(NumOp::<i64>::In(vec![]).lower("age"));
    assert_eq!(sql, "FALSE");
}

#[test]
fn cond_bitand_groups() {
    let c = NumOp::Gte(20i64).lower("age") & NumOp::Lt(65i64).lower("age");
    assert_eq!(render(c), r#"("age" >= $1 AND "age" < $2)"#);
}

#[test]
fn col_string_preds_work_for_option_string_too() {
    use postgres::col::{Col, StringCol};
    let c: Col<Option<String>> = Col::new("nickname");
    assert_eq!(
        render(c.starts_with("a") | Col::<String>::new("name").eq("b")),
        r#"("nickname" LIKE $1 ESCAPE '\' OR "name" = $2)"#
    );
}

#[test]
fn col_ord_and_uuid_preds_cover_option_columns() {
    use postgres::col::{Col, OrdCol, UuidCol};
    let c: Col<Option<i64>> = Col::new("age");
    assert_eq!(render(c.between(10, 20)), r#""age" BETWEEN $1 AND $2"#);
    let u: Col<Option<postgres::uuid::Uuid>> = Col::new("owner_id");
    assert_eq!(
        render(u.eq(postgres::uuid::Uuid::nil())),
        r#""owner_id" = $1"#
    );
}
