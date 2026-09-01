# Transactions

`Tx::begin()` opens a shared transaction handle on the **process-global pool**
(seed it once with `postgres::set_global_pool(pool)`). If you need a specific
pool instead, `Tx::begin_with(&pool)` is the explicit-pool escape hatch.
`repo.with_tx(&tx)` returns a **clone** of the repository bound to that
transaction — the original `repo` keeps running against the pool, untouched, so
a shared repository can never accidentally join someone else's transaction.
Every method on the tx-bound clone (`insert`/`get`/`find`/`update`/`delete`, and
`find`'s eager hydration) uses exactly the same signature as the pool-backed
repo — there is no `*_with_tx` method variant to remember.

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct Tag {
    pub id: Uuid,
    pub label: String,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    postgres::set_global_pool(pool); // 전역 풀 시딩 (일차 API) — 이후 arg 없이 쓴다
    let tag_repo = Tag::repository();

    // 명시적 rollback — tx 안에서는 커밋 전에도 자신이 쓴 행을 본다 (read-your-writes).
    let tx = Tx::begin().await?;
    let tx_tags = tag_repo.with_tx(&tx);
    let draft = tx_tags
        .insert(&Tag { id: Uuid::nil(), label: "draft-only".into() })
        .await?;
    assert!(tx_tags.get(draft.id).await?.is_some());
    tx.rollback().await?;
    assert!(tag_repo.get(draft.id).await?.is_none()); // rollback 후에는 pool 에서도 안 보인다

    // 커밋.
    let tx2 = Tx::begin().await?;
    let tx_tags2 = tag_repo.with_tx(&tx2);
    let kept = tx_tags2
        .insert(&Tag { id: Uuid::nil(), label: "kept".into() })
        .await?;
    tx2.commit().await?;
    assert!(tag_repo.get(kept.id).await?.is_some());
    Ok(())
}
```

## `drop` without commit/rollback = rollback

If a `Tx` is dropped without calling `commit()`/`rollback()`, its `Drop` impl
takes the shared transaction out of its slot immediately and lets sqlx's own
`Transaction::drop` queue the rollback — best-effort (a "best-effort" caveat
only matters under an extreme lock race where `Tx::drop`'s `try_lock` fails;
the rollback still lands when the last clone of the shared handle drops).
After that point, every repo still bound to that `Tx` returns
`Error::TxClosed`, and the pool-backed original sees the rollback took effect:

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
}

#[tokio::main]
async fn main() -> postgres::Result<()> {
    let pool = postgres::sqlx::postgres::PgPoolOptions::new()
        .connect("postgres://postgres@localhost:5432/postgres")
        .await?;
    // 명시적 풀 escape hatch: PostgresRepository::new(pool) + Tx::begin_with(&pool).
    // 전역 풀을 안 심어도 되는, 특정 풀에 묶인 repo/tx 를 만드는 경로다.
    let repo = postgres::PostgresRepository::<User>::new(pool);
    let id = Uuid::now_v7();

    let tx = Tx::begin_with(repo.pool()).await?;
    let tx_repo = repo.with_tx(&tx);
    tx_repo.delete(id).await?;
    assert!(tx_repo.get(id).await?.is_none()); // tx 안에서는 지워짐 (read-your-writes)

    drop(tx); // commit/rollback 없이 drop → 즉시 rollback
    assert!(matches!(tx_repo.get(id).await, Err(postgres::Error::TxClosed)));
    assert!(repo.get(id).await?.is_some()); // 원본 repo(pool)에선 롤백되어 살아있다
    Ok(())
}
```

## Sharing one `Tx` across entities

Because `with_tx` is a plain method on `PostgresRepository<T>` for any `T`,
multiple entities' repositories can join the **same** transaction — a common
need when an insert on one table must be atomic with an insert on another:

```rust,no_run
use postgres::prelude::*;
use postgres::uuid::Uuid;

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct User {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Default, Clone, PostgresEntity)]
pub struct Post {
    pub id: Uuid,
    #[postgres(many_to_one)]
    pub user: User,
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

    let tx = Tx::begin().await?;
    let users = user_repo.with_tx(&tx); // tx 에 바인딩된 클론
    let posts = post_repo.with_tx(&tx); // 같은 tx 에 합류

    let user = users
        .insert(&User { id: Uuid::nil(), name: "hackartist".into() })
        .await?;
    posts
        .insert(&Post { id: Uuid::nil(), user, title: "hello".into() })
        .await?;
    tx.commit().await?; // 두 insert 가 원자적으로 확정된다
    Ok(())
}
```

## Related

- [`getting-started`](getting-started.md) / [`entity`](entity.md) — the basic CRUD this wraps
- [`schema`](schema.md) — startup DDL/version 적용은 요청 처리용 `Tx`보다 먼저 실행
