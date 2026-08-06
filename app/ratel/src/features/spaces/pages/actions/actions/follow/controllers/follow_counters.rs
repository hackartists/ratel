//! Atomic follower/following counter bumps shared by `follow_user` /
//! `unfollow_user`.
//!
//! Postgres migration note: the old DynamoDB flow bumped `User.followers_count`
//! / `Team.followers` / `User.followings_count` via `updater().increase_*()` /
//! `decrease_*()` conditional-update items inside the same `transact_write_items`
//! call as the `UserFollow` row writes. `User` and `Team` are both Postgres
//! tables now (same DB as `UserFollow`), so the bump is a plain atomic
//! `UPDATE … SET c = c + $delta` run on the caller's shared [`postgres::Tx`] —
//! preserving the original all-or-nothing atomicity without a cross-store
//! transaction.

#[cfg(feature = "server")]
use crate::common::types::Partition;
#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::actions::follow::types::SpaceFollowError;

/// Bump the `followers` counter on the `User` or `Team` row a follow target
/// resolves to.
#[cfg(feature = "server")]
pub async fn bump_target_followers_tx(
    tx: &postgres::Tx,
    target_pk: &Partition,
    delta: i64,
) -> crate::common::Result<()> {
    match target_pk {
        Partition::User(id) => bump_user_column_tx(tx, id, "followers_count", delta).await,
        Partition::Team(id) => bump_team_followers_tx(tx, id, delta).await,
        _ => Err(SpaceFollowError::InvalidTarget.into()),
    }
}

/// Bump the `followings_count` counter on the follower actor's `User` row
/// (the actor is always a logged-in user in this flow).
#[cfg(feature = "server")]
pub async fn bump_user_followings_tx(
    tx: &postgres::Tx,
    follower_pk: &Partition,
    delta: i64,
) -> crate::common::Result<()> {
    match follower_pk {
        Partition::User(id) => bump_user_column_tx(tx, id, "followings_count", delta).await,
        _ => Err(SpaceFollowError::InvalidTarget.into()),
    }
}

#[cfg(feature = "server")]
async fn bump_user_column_tx(
    tx: &postgres::Tx,
    user_id: &str,
    column: &'static str,
    delta: i64,
) -> crate::common::Result<()> {
    use postgres::sqlx::{Postgres, QueryBuilder};
    use postgres::{PostgresEntity, Value};

    let uuid = uuid::Uuid::parse_str(user_id).map_err(|_| SpaceFollowError::InvalidTarget)?;
    let table = crate::common::models::auth::User::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!(
        "UPDATE \"{table}\" SET \"{column}\" = \"{column}\" + "
    ));
    Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE \"id\" = ");
    Value::from(uuid).push_bind(&mut qb);
    crate::common::models::auth::User::repository()
        .with_tx(tx)
        .db()
        .execute(qb)
        .await
        .map_err(crate::common::Error::from)?;
    Ok(())
}

#[cfg(feature = "server")]
async fn bump_team_followers_tx(
    tx: &postgres::Tx,
    team_id: &str,
    delta: i64,
) -> crate::common::Result<()> {
    use postgres::sqlx::{Postgres, QueryBuilder};
    use postgres::{PostgresEntity, Value};

    let uuid = uuid::Uuid::parse_str(team_id).map_err(|_| SpaceFollowError::InvalidTarget)?;
    let table = crate::features::posts::models::Team::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!(
        "UPDATE \"{table}\" SET \"followers\" = \"followers\" + "
    ));
    Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE \"id\" = ");
    Value::from(uuid).push_bind(&mut qb);
    crate::features::posts::models::Team::repository()
        .with_tx(tx)
        .db()
        .execute(qb)
        .await
        .map_err(crate::common::Error::from)?;
    Ok(())
}
