# Querying — `{Entity}::query()`

Every `#[derive(PostgresEntity)]` type gets a generated `{Name}Query` builder,
reached through the trait method `{Entity}::query()`. It combines **column
filters** (one method per column, taking a typed operator enum), a
**column-expression API** (`.filter(...)`) for cross-column boolean trees,
multi-column sorting, and pagination — then `repo.find(query)` /
`repo.find_one(query)` execute it. `find` returns a `Page<T>` (rows in
`.items`, plus `.total_count` / `.page` / `.page_size` / `.total_pages`);
`find_one` returns `Option<T>`.

```rust,no_run
use postgres::ops::{EnumOp, NumOp, StringOp};
use postgres::uuid::Uuid;
use postgres::{BoolCol, EnumCol, OrdCol, Order, PostgresEnum, PostgresEntity, StringCol};

#[derive(Debug, Clone, Copy, PartialEq, Default, PostgresEnum)]
pub enum Role {
    #[default]
    Owner,
    Admin,
    Member,
}

#[derive(Debug, Default, Clone, PartialEq, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub agreed: bool,
    pub role: Role,
    pub nickname: Option<String>,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let repo = User::repository();

    // 컬럼별 Op 진입점 + combinator(`|`/`&`, `BitOr`/`BitAnd` 오버로딩).
    let _ = repo
        .find(User::query().name(StringOp::StartsWith("al") | StringOp::Eq("bob")))
        .await?;

    // `.filter()` — 컬럼 표현식 API (Diesel 스타일). 클로저 인자는 derive 가 생성하는
    // `UserCols`, predicate 메서드가 `Cond` 를 반환하며 `&`/`|` 로 트리를 구성한다.
    let _ = repo
        .find(User::query().filter(|u| u.age.gte(20) & u.agreed.eq(true)))
        .await?;

    // `.filter()` 는 컬럼을 넘나드는 OR 도 표현할 수 있다 — Op-enum 컬럼 메서드로는 불가.
    let _ = repo
        .find(User::query().filter(|u| u.name.eq("bob") | u.role.eq(Role::Owner)))
        .await?;

    // `Option<T>` 컬럼의 null 체크 — 연산자 enum에 payload 없는 variant를 섞지 않고 분리.
    let _ = repo.find(User::query().filter(|u| u.nickname.is_null())).await?;
    let _ = repo.find(User::query().filter(|u| u.nickname.is_not_null())).await?;

    // 다중 정렬 — `.order_by()` 는 누적 체이닝, 호출 순서대로 `ORDER BY` 키가 쌓인다.
    let _ = repo
        .find(
            User::query()
                .order_by(UserColumn::Agreed, Order::Asc)
                .order_by(UserColumn::Age, Order::Desc),
        )
        .await?;

    // 페이지네이션 — `find` 는 `Page<T>` 를 반환한다: `.items`(이 페이지 행),
    // `.total_count`(WHERE 조건 전체 개수, `COUNT(*) OVER()` 로 같은 쿼리에서 산출),
    // `.page`/`.page_size`/`.total_pages`. `page_size` 가 raw `limit`/`offset` 보다 우선한다.
    let page = repo
        .find(User::query().order_by(UserColumn::Age, Order::Desc).page_size(2).page(1))
        .await?;
    let _ = (&page.items, page.total_count, page.total_pages, page.page, page.page_size);

    // page_size 없이 부르면 모든 행이 `.items` 에 담기고 page=1, page_size=total_count.
    let _ = repo.find(User::query()).await?.items;

    // raw limit/offset 도 여전히 사용 가능 (page_size 미지정 시).
    let _ = repo
        .find(User::query().order_by(UserColumn::Age, Order::Desc).limit(2).offset(1))
        .await?;

    // enum 컬럼 직접 연산자.
    let _ = repo.find(User::query().role(EnumOp::Eq(Role::Member))).await?;

    // 수치 연산자.
    let _ = repo.find(User::query().age(NumOp::Lt(26))).await?;

    Ok(())
}
```

## Operator enums

Which enum a column accepts is decided by `PostgresType::Op` (never
hardcoded in the macro), so every column's operator set is exactly this table:

| enum | variants | applies to |
|---|---|---|
| `StringOp` | `Eq` `Ne` `Like` `ILike` `StartsWith` `EndsWith` `Contains` `In` | `String` |
| `NumOp<T>` | `Eq` `Ne` `Gt` `Gte` `Lt` `Lte` `Between` `In` | integers/floats, `DateTime<Utc>` |
| `BoolOp` | `Eq` `Ne` | `bool` |
| `UuidOp` | `Eq` `Ne` `In` | `Uuid` |
| `EnumOp<E>` | `Eq` `Ne` `In` | a `PostgresEnum` type — see [`enum`](enum.md) |
| `JsonOp<T>` | `Eq` `Ne` `Contains` (`@>`) `ContainedBy` (`<@`) | a `PostgresJson` type — see [`json`](json.md) |

`StartsWith`/`EndsWith`/`Contains` escape `%`/`_` in the payload before
building the `LIKE` pattern; use `Like`/`ILike` directly for a raw pattern.

## Combinators

**Within one column**, every operator enum implements `Or(Vec<Self>)` /
`And(Vec<Self>)`, with `|`/`&` operator overloading (`BitOr`/`BitAnd`) as
sugar — `StringOp::StartsWith("a") | StringOp::EndsWith("c")` is
`Or(vec![StartsWith("a"), EndsWith("c")])`, rendered as a parenthesized `OR`.
Chaining different columns on the query builder itself (`.name(...).age(...)`)
combines with `AND`.

**Across columns**, use `.filter(|cols| ...)`: the predicate methods
(`eq`/`ne`/`like`/`ilike`/`starts_with`/`ends_with`/`contains`/`in_` on
string columns; `gt`/`gte`/`lt`/`lte`/`between` on numeric/time columns;
`is_null`/`is_not_null` on `Option` columns; `eq`/`ne`/`in_` on
enum/UUID/bool columns) return a `Cond` that composes with `&`/`|`
(`BitAnd`/`BitOr`) into an arbitrarily nested, parenthesized tree. Multiple
`.filter(...)` calls on the same query combine with `AND`.

`{Name}Column` (a generated enum of column names) + `Order { Asc, Desc }`
drive `.order_by(...)`, which accumulates — each call adds another `ORDER BY`
key in call order.

## Related

- [`entity`](entity.md) — deriving the entity these queries run against
- [`update`](update.md) — the equivalent builder for writes
- [`relations`](relations.md) — the `with_*` eager-loading flags usable on a query
