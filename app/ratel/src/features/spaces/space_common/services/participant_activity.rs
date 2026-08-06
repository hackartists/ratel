use crate::common::*;
use crate::common::models::space::{PARTICIPANT_KIND, SpaceParticipant};
use crate::common::utils::time::get_now_timestamp_millis;

/// Best-effort: failures must not block the user's underlying action.
///
/// Postgres migration: `SpaceParticipant` is Postgres-backed now, so this is
/// a plain atomic `UPDATE … WHERE` instead of a DynamoDB partial `UpdateItem`
/// — `_cli` is unused but kept for external caller compatibility. Unlike the
/// old bare `UpdateItem` (which could silently upsert a partial row for a
/// non-participant, e.g. an admin), `UPDATE … WHERE` is a true no-op when no
/// row matches.
pub async fn bump_participant_activity(
    _cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
    user_pk: &Partition,
) {
    use postgres::PostgresEntity;
    use postgres::Value;
    use postgres::sqlx::{Postgres, QueryBuilder};

    let now = get_now_timestamp_millis();
    let table = SpaceParticipant::table_name();

    let mut qb =
        QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET last_activity_at = "));
    Value::from(now).push_bind(&mut qb);
    qb.push(" WHERE space_pk = ");
    Value::from(space_pk.to_string()).push_bind(&mut qb);
    qb.push(" AND user_pk = ");
    Value::from(user_pk.to_string()).push_bind(&mut qb);
    qb.push(" AND kind = ");
    Value::from(PARTICIPANT_KIND.to_string()).push_bind(&mut qb);

    if let Err(e) = SpaceParticipant::repository().db().execute(qb).await {
        crate::error!(
            "bump_participant_activity failed (space={}, user={}): {e}",
            space_pk,
            user_pk
        );
    }
}
