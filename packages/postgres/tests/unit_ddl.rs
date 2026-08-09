use postgres::ops::{NumOp, OpLower};
use postgres::query::{Order, QuerySpec};
use postgres::sqlx::{Postgres, QueryBuilder};

#[test]
fn query_spec_renders_where_order_limit() {
    let mut s = QuerySpec::default();
    s.conds.push(NumOp::Gte(20i64).lower("age"));
    s.order.push(("created_at", Order::Desc));
    s.order.push(("name", Order::Asc));
    s.limit = Some(20);
    let mut qb: QueryBuilder<Postgres> = QueryBuilder::new("SELECT * FROM t");
    s.render(&mut qb);
    assert_eq!(
        qb.sql(),
        r#"SELECT * FROM t WHERE "age" >= $1 ORDER BY "created_at" DESC, "name" ASC LIMIT $2"#
    );
}

#[test]
fn builds_create_table_with_fk_and_unique() {
    use postgres::entity::{ColumnDef, RelationDef, RelationKind, SqlType};
    use postgres::schema::build_create_table;
    static COLS: &[ColumnDef] = &[
        ColumnDef {
            name: "id",
            sql_type: || SqlType::Uuid,
            nullable: false,
            unique: false,
            index: false,
            primary_key: true,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
        ColumnDef {
            name: "email",
            sql_type: || SqlType::Text,
            nullable: false,
            unique: true,
            index: false,
            primary_key: false,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
        ColumnDef {
            name: "user_id",
            sql_type: || SqlType::Uuid,
            nullable: true,
            unique: false,
            index: true,
            primary_key: false,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
    ];
    static RELS: &[RelationDef] = &[RelationDef {
        field: "user",
        kind: RelationKind::ManyToOne,
        target_table: || "users_t".into(),
        foreign_key: || "user_id".into(),
        reference_key: || "id".into(),
        join_table: None,
        nullable: true,
        unique: false,
        on_delete: None,
    }];
    let ddl = build_create_table("orders_t", COLS, RELS, &[]);
    assert_eq!(
        ddl.create[0],
        "CREATE TABLE IF NOT EXISTS \"orders_t\" (\"id\" UUID PRIMARY KEY, \"email\" TEXT NOT NULL UNIQUE, \"user_id\" UUID REFERENCES \"users_t\"(\"id\"))"
    );
    assert_eq!(
        ddl.post_create[0],
        "CREATE INDEX IF NOT EXISTS \"orders_t_user_id_idx\" ON \"orders_t\"(\"user_id\")"
    );
    assert_eq!(ddl.drop[0], "DROP TABLE IF EXISTS \"orders_t\" CASCADE");
}

/// struct-level `#[postgres(unique(a, b))]` → `CREATE UNIQUE INDEX` DDL 문자열 (멱등,
/// 컬럼별 인덱스 뒤에 이어짐; 별도 DROP INDEX 없음 — DROP TABLE CASCADE 가 제거).
#[test]
fn builds_create_table_with_composite_unique() {
    use postgres::entity::{ColumnDef, SqlType};
    use postgres::schema::build_create_table;
    static COLS: &[ColumnDef] = &[
        ColumnDef {
            name: "id",
            sql_type: || SqlType::Uuid,
            nullable: false,
            unique: false,
            index: false,
            primary_key: true,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
        ColumnDef {
            name: "workspace_id",
            sql_type: || SqlType::Uuid,
            nullable: false,
            unique: false,
            index: true,
            primary_key: false,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
        ColumnDef {
            name: "application_number",
            sql_type: || SqlType::Text,
            nullable: false,
            unique: false,
            index: false,
            primary_key: false,
            version: 0,
            index_version: 0,
            default_sql: || None,
        },
    ];
    let uniques: &[&[&str]] = &[&["workspace_id", "application_number"]];
    let ddl = build_create_table("patent_records", COLS, &[], uniques);
    assert_eq!(
        ddl.create[0],
        "CREATE TABLE IF NOT EXISTS \"patent_records\" (\"id\" UUID PRIMARY KEY, \"workspace_id\" UUID NOT NULL, \"application_number\" TEXT NOT NULL)"
    );
    // 컬럼별 인덱스(workspace_id) 다음에 복합 UNIQUE 인덱스가 온다.
    assert_eq!(
        ddl.post_create[0],
        "CREATE INDEX IF NOT EXISTS \"patent_records_workspace_id_idx\" ON \"patent_records\"(\"workspace_id\")"
    );
    assert_eq!(
        ddl.post_create[1],
        "CREATE UNIQUE INDEX IF NOT EXISTS \"patent_records_workspace_id_application_number_key\" ON \"patent_records\" (\"workspace_id\",\"application_number\")"
    );
    // 복합 UNIQUE 는 별도 DROP INDEX 를 내지 않는다.
    assert_eq!(ddl.drop.len(), 1);
    assert_eq!(
        ddl.drop[0],
        "DROP TABLE IF EXISTS \"patent_records\" CASCADE"
    );
}
