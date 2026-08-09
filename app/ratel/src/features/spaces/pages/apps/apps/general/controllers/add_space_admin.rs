use crate::common::models::space::SpaceAdmin;
use crate::features::spaces::pages::apps::apps::general::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AddSpaceAdminRequest {
    /// Either a username or an email address. The handler decides which
    /// lookup to perform based on the presence of `@`.
    pub target: String,
}

#[post("/api/spaces/{space_id}/admins", role: SpaceUserRole)]
pub async fn add_space_admin(space_id: SpacePartition, body: AddSpaceAdminRequest) -> Result<()> {
    use crate::common::models::auth::User;

    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let space_pk: Partition = space_id.into();

    // Load space to check owner
    use crate::common::models::space::SpaceCommon;
    let space = SpaceCommon::get_by_partition(&space_pk)
        .await?
        .ok_or(Error::SpaceNotFound)?;

    // Look the user up by email if the input contains `@`, otherwise by
    // username. The Administrators panel allows admins to add new admins
    // by either identifier.
    let identifier = body.target.trim();
    let user = if identifier.contains('@') {
        let email = identifier.to_ascii_lowercase();
        User::find_by_email(&email)
            .await?
            .filter(|u| u.email.eq_ignore_ascii_case(&email))
            .ok_or(Error::NotFound("User not found".to_string()))?
    } else {
        User::find_by_username(identifier)
            .await?
            .filter(|u| u.username == identifier)
            .ok_or(Error::NotFound("User not found".to_string()))?
    };

    let user_pk = user.pk();

    // Prevent adding the space owner as a Space Admin (they already have Creator role)
    if space.user_pk == user_pk.to_string() {
        return Ok(());
    }

    // Check if already a Space Admin
    if SpaceAdmin::get_admin(&space_pk, &user_pk).await?.is_some() {
        return Ok(());
    }

    let space_admin = SpaceAdmin::new(
        space_pk.clone(),
        user_pk.clone(),
        user.display_name.clone(),
        user.username.clone(),
        user.profile_url.clone(),
    );

    space_admin.save().await?;

    // Also create SpaceParticipant if not already present (so the space appears in the user's MySpace list)
    use crate::common::models::space::SpaceParticipant;
    if SpaceParticipant::get_participant(&space_pk, &user_pk)
        .await?
        .is_none()
    {
        let participant = SpaceParticipant::new_non_anonymous(space_pk.clone(), user);
        participant.save().await?;

        adjust_space_participants(&space_pk, 1).await?;
    }

    Ok(())
}

/// Atomically increments/decrements the `participants` counter on the
/// `space_commons` row for `space_pk` (mirrors the old DynamoDB
/// `SpaceCommon::updater(..).increase_participants(delta)`).
#[cfg(feature = "server")]
pub(crate) async fn adjust_space_participants(space_pk: &Partition, delta: i64) -> Result<()> {
    use crate::common::models::space::SpaceCommon;
    use postgres::PostgresEntity;
    use postgres::sqlx::{Postgres, QueryBuilder};

    let table = SpaceCommon::table_name();
    let mut qb = QueryBuilder::<Postgres>::new(format!(
        "UPDATE \"{table}\" SET participants = participants + "
    ));
    postgres::Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE space_pk = ");
    postgres::Value::from(space_pk.to_string()).push_bind(&mut qb);

    SpaceCommon::repository()
        .db()
        .execute(qb)
        .await
        .map_err(crate::common::Error::from)?;

    Ok(())
}
