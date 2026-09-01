# Relations

A relation is declared as a plain struct field — `T`, `Option<T>`, or
`Vec<T>` where `T: PostgresEntity` — annotated with one of four cardinality
flags: `one_to_one`, `many_to_one`, `one_to_many`, `many_to_many`. Relation
fields are excluded from the base row (never a `SELECT` target); loading them
is always an explicit, separate step (see "Loading" below).

All four cardinalities are declarable **with no extra attributes** — every
foreign-key/join-table name has a convention-based default:

| kind | default FK / join-table naming |
|---|---|
| `many_to_one` / `one_to_one` (owning side — FK column lives on this table) | FK column = `{field}_id`, referencing the target's primary key |
| `one_to_many` (non-owning side — FK lives on the *other* table) | target's FK column = `{self base_name}_id` |
| `many_to_many` | join table = both sides' `base_name()`, **sorted then joined with `_`** (so either side can declare it and get the same name); each FK column = `{that side's base_name}_id` |

## Owning side — `one_to_one` / `many_to_one`

The FK column is created on **this** table:

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

/// 참조 대상. `email` 은 UNIQUE — `owner_email` FK 가 이 컬럼을 참조한다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r1_users")]
pub struct RUser {
    pub id: Uuid,
    #[postgres(unique)]
    pub email: String,
    pub name: String,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r1_orders")]
pub struct ROrder {
    pub id: Uuid,
    // 기본값: FK 컬럼 "user_id" UUID NOT NULL REFERENCES r1_users(id).
    #[postgres(many_to_one)]
    pub user: RUser,
    // 커스텀: reference_key 가 PK 가 아니면 대상 컬럼 타입을 매크로가 볼 수 없으므로
    // `type` 명시가 필수 — FK 컬럼 "owner_email" TEXT UNIQUE REFERENCES r1_users(email).
    #[postgres(one_to_one, foreign_key = "owner_email", type = "TEXT", reference_key = "email")]
    pub owner: Option<RUser>,
    pub total: i64,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let order_repo = ROrder::repository();

    // eager: with_user() — N+1 없는 배치 hydrate. `find` 는 `Page<T>` → `.items` 로 행 접근.
    let orders = order_repo.find(ROrder::query().with_user()).await?.items;

    // lazy: get() 은 관계를 채우지 않고, load_user() 로 명시적으로 채운다.
    let mut order = order_repo.get(orders[0].id).await?.unwrap();
    order.load_user(&order_repo).await?;
    Ok(())
}
```

`one_to_one` additionally puts `UNIQUE` on the FK column; `many_to_one` does
not. An `Option<T>` field makes the FK column nullable; a bare `T` makes it
`NOT NULL`. The FK value bound on insert is `self.<field>.primary_key()` for
the default reference, or the target's `reference_key` column value (via
`value_of`) for a custom one.

## Non-owning side — `one_to_many`

This field creates **no column and no constraint** on its own table — the
constraint is created by the owning side's `many_to_one` declaration. Get the
default FK derivation wrong on either side and hydration silently returns
nothing, so it is worth understanding when the default needs an override:

```rust
use postgres::prelude::*;
use postgres::uuid::Uuid;

// `#[postgres(table = "ex_users")]` 로 테이블명을 바꿨기 때문에, `posts` 의 기본 FK
// 유도값은 "{self base_name}_id" = "ex_users_id" 가 된다. 하지만 자식 쪽
// `Post.user`(many_to_one, 관례 기본값)가 실제로 만드는 컬럼명은
// "{필드명}_id" = "user_id" — 서로 어긋나므로 여기서 명시적으로 정렬해 준다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_users")]
pub struct User {
    pub id: Uuid,
    pub name: String,
    #[postgres(one_to_many, foreign_key = "user_id")]
    pub posts: Vec<Post>,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "ex_posts")]
pub struct Post {
    pub id: Uuid,
    #[postgres(many_to_one)] // FK 컬럼 "user_id" (필드명 + "_id" 관례 기본값)
    pub user: User,
    pub title: String,
}
```

When the parent's table name has **no** prefix mismatch — i.e. its
`base_name()` already equals what the child's FK column is named — the
default just works and `foreign_key` can be omitted on the parent side
entirely; only the child's `many_to_one` needs a `foreign_key` override when
its own field name doesn't happen to match. Either way, `foreign_key` always
means "the column that holds the reference," on whichever table it actually
lives.

Loading mirrors the owning side: `repo.find(Parent::query().with_posts())` for
a batched eager load (one extra query total, not one per parent), or
`parent.load_posts(&repo).await?` to lazily fill an already-fetched row.
Reloading an already-hydrated parent clears the `Vec` first, so it never
duplicates entries.

## `many_to_many` — through a join table

Declared on either side (or both, as a mirror) with no owning column on
either entity — the join table owns the link:

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_articles")]
pub struct RArticle {
    pub id: Uuid,
    pub title: String,
    // 조인테이블 "r3_articles_r3_tags" (정렬된 base_name 결합) — 전부 기본값.
    #[postgres(many_to_many)]
    pub tags: Vec<RTag>,
}

// 반대쪽도 선언하면(미러) 동일한 조인테이블 이름을 유도한다 — 정렬 결합이라 대칭이다.
#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_tags")]
pub struct RTag {
    pub id: Uuid,
    pub name: String,
    #[postgres(many_to_many)]
    pub articles: Vec<RArticle>,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let article_repo = RArticle::repository();

    let (article_id, tag_id) = (Uuid::now_v7(), Uuid::now_v7());
    article_repo.attach_tags(article_id, tag_id).await?; // 중복 attach 는 무해
    let articles = article_repo.find(RArticle::query().with_tags()).await?.items;
    article_repo.detach_tags(article_id, tag_id).await?;
    let _ = articles;
    Ok(())
}
```

The join table needs **both** referenced tables to already exist, so a lone
`repo.create_table()` for one side isn't enough to bootstrap the whole
picture — see [`schema`](schema.md) for `Schema`, which sequences table
creation before join-table creation automatically.

A self-referential `many_to_many` (`Vec<Self>`, e.g. a `friends` field on
`User`) has all three defaults collide (both sides derive the same
`base_name`), so `join_table`/`from_key`/`to_key` must all be given
explicitly — the macro rejects a self-referential declaration that omits any
of them at compile time.

## Loading model (hybrid)

`find`/`get` always leave relation fields at their `Default` (`vec![]` /
`None` / `T::default()`). Two ways to fill them:

1. **Eager** — a `with_{field}()` flag on the query. To-one relations join;
   to-many relations run one batched follow-up query for the whole result set
   (never N+1).
2. **Lazy** — `entity.load_{field}(&repo).await?` on an already-fetched row.

## Relation metadata — `relations()`

The attribute-parsing result (`foreign_key`/`reference_key`, or
`join_table`/`from_key`/`to_key` for `many_to_many`) isn't hidden inside
generated code — it's exposed as structured data, symmetrical with
`columns()`, and it's what DDL generation, hydration, and the `attach_*`/
`detach_*` methods all read from:

```rust
use postgres::uuid::Uuid;
use postgres::PostgresEntity;

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_articles")]
pub struct RArticle {
    pub id: Uuid,
    pub title: String,
    #[postgres(many_to_many)]
    pub tags: Vec<RTag>,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
#[postgres(table = "r3_tags")]
pub struct RTag {
    pub id: Uuid,
    pub name: String,
    #[postgres(many_to_many)]
    pub articles: Vec<RArticle>,
}

let rels = <RArticle as PostgresEntity>::relations();
let tags = rels.iter().find(|r| r.field == "tags").unwrap();

// 양쪽에서 선언해도 정렬된 base_name 결합으로 항상 같은 조인테이블 이름이 나온다.
assert_eq!((tags.join_table.unwrap())(), "r3_articles_r3_tags");
assert_eq!((tags.foreign_key)(), "r3_articles_id");
assert_eq!((tags.reference_key)(), "r3_tags_id");
```

## Related

- [`entity`](entity.md) — the attributes referenced above (`foreign_key`, `type`, `reference_key`, ...)
- [`query`](query.md) — the `with_*` eager-loading flags
- [`update`](update.md) — FK setters on the owning side
- [`schema`](schema.md) — bootstrapping several related tables (and their join tables) together
