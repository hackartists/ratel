#![cfg(feature = "server")]

//! Postgres-migration helpers shared by the follow/unfollow controllers.
//!
//! The DynamoDB implementation bumped `User.followers_count` /
//! `followings_count` and `Team.followers` atomically via a `transact_write_items`
//! `ADD` update, in the same transaction as the two `UserFollow` edge-row
//! writes/deletes. Postgres replaces the whole transaction with a
//! [`postgres::Tx`] shared across `UserFollow`, `User`, and `Team` — the
//! per-column bump is `SET col = col + $delta` (never read-modify-write),
//! preserving the same atomicity and concurrency semantics.
//!
//! `User` and `Team` are owned by other feature clusters (`auth`, `posts`), so
//! this module only calls their public `PostgresEntity` surface
//! (`table_name()`, `repository()`) — it does not modify those models.

use uuid::Uuid;

/// `UPDATE "<table>" SET "<column>" = "<column>" + $delta WHERE "id" = $id`,
/// executed via the given (already tx-bound) [`postgres::Db`].
async fn bump_column(
    db: &postgres::Db,
    table: &str,
    id: Uuid,
    column: &str,
    delta: i64,
) -> crate::common::Result<()> {
    use postgres::sqlx::{Postgres, QueryBuilder};
    let mut qb = QueryBuilder::<Postgres>::new(format!(
        "UPDATE \"{table}\" SET \"{column}\" = \"{column}\" + "
    ));
    postgres::Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE \"id\" = ");
    postgres::Value::from(id).push_bind(&mut qb);
    db.execute(qb).await.map_err(crate::common::Error::from)?;
    Ok(())
}

/// Bump a user's `followers_count` or `followings_count` column inside `tx`.
pub async fn bump_user_counter_tx(
    tx: &postgres::Tx,
    user_id: Uuid,
    column: &str,
    delta: i64,
) -> crate::common::Result<()> {
    use postgres::PostgresEntity;
    let repo = crate::common::models::auth::User::repository().with_tx(tx);
    bump_column(
        repo.db(),
        &crate::common::models::auth::User::table_name(),
        user_id,
        column,
        delta,
    )
    .await
}

/// Bump a team's `followers` column inside `tx`.
pub async fn bump_team_counter_tx(
    tx: &postgres::Tx,
    team_id: Uuid,
    column: &str,
    delta: i64,
) -> crate::common::Result<()> {
    use postgres::PostgresEntity;
    let repo = crate::features::posts::models::Team::repository().with_tx(tx);
    bump_column(
        repo.db(),
        &crate::features::posts::models::Team::table_name(),
        team_id,
        column,
        delta,
    )
    .await
}
