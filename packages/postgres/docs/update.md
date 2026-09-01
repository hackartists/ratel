# Updating — `{Entity}::update()`

`{Entity}::update()` returns a generated `{Name}Update` partial-update
builder — one setter per column, taking the value directly (not an operator
enum, since an update is an assignment, not a predicate). Only the columns you
call a setter for end up in the `SET` clause; `repo.update(pk, update)` runs
`UPDATE ... SET ... WHERE {pk} = ... RETURNING *`.

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
    pub age: i64,
    pub nickname: Option<String>,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct Post {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub user: User, // FK 컬럼 "user_id"
    pub title: String,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API)
    let user_repo = User::repository();
    let post_repo = Post::repository();

    let user_id = Uuid::now_v7();
    let other_user_id = Uuid::now_v7();
    let post_id = Uuid::now_v7();

    // 부분 갱신 — 세팅한 컬럼(name, age)만 SET 절에 실린다.
    let updated = user_repo
        .update(user_id, User::update().name("hackartist-renamed").age(34))
        .await?;
    assert_eq!(updated.name, "hackartist-renamed");
    assert_eq!(updated.age, 34);

    // `Option<T>` 컬럼 — `Some(v)`/`None` 세터로 값 대입과 NULL 대입 둘 다 가능하다.
    let nulled = user_repo.update(user_id, User::update().nickname(None)).await?;
    assert_eq!(nulled.nickname, None);
    let renicked = user_repo
        .update(user_id, User::update().nickname(Some("nick".to_string())))
        .await?;
    assert_eq!(renicked.nickname.as_deref(), Some("nick"));

    // 관계 소유 필드의 FK 세터 — 엔티티 전체가 아니라 FK 스칼라 값만으로 소유자를 재지정한다.
    post_repo
        .update(post_id, Post::update().user_id(other_user_id))
        .await?;

    Ok(())
}
```

## Notes

- An empty update (`{Entity}::update()` with no setters called) is rejected —
  `repo.update(...)` returns `Error::Schema(...)` rather than issuing a
  no-op `UPDATE`.
- FK setters are only generated for a relation using the **default
  reference** (the FK column points at the target's primary key, so the
  setter's argument type is the target's `Pk`). A relation declared with a
  custom `reference_key` (e.g. `owner_email` referencing `email` rather than
  `id` — see [`relations`](relations.md)) does **not** get an `{Update}`
  setter: the macro cannot see the target entity's field type for a non-PK
  reference, so generating one risked silently binding the wrong Rust type to
  the FK column. Reassigning that kind of relation currently means updating
  the FK column value directly, or replacing the whole row.

## Related

- [`query`](query.md) — the read-side counterpart, `{Entity}::query()`
- [`relations`](relations.md) — what "default reference" vs "custom
  `reference_key`" means for a relation field
