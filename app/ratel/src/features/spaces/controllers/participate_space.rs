use crate::common::models::auth::{OptionalUser, User};
use crate::common::models::space::SpaceCommon;
use crate::common::utils::time::get_now_timestamp_millis;
use crate::common::SpaceVisibility;
use crate::features::activity::types::AuthorPartition;
#[cfg(feature = "server")]
use crate::features::activity::models::SpaceScore;
#[cfg(feature = "server")]
use crate::features::posts::models::Post;
use crate::features::posts::types::TeamGroupPermission;
use crate::features::spaces::models::{PanelAttribute, SpaceParticipant};
#[cfg(feature = "server")]
use crate::features::spaces::models::{SpacePanelParticipant, SpacePanelQuota};
use crate::features::spaces::*;
use crate::spaces::InvitationStatus;
#[cfg(feature = "server")]
use crate::spaces::SpaceInvitationMember;
#[cfg(feature = "server")]
use postgres::PostgresEntity;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ParticipateSpaceResponse {
    pub username: String,
    pub display_name: String,
    pub profile_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct ParticipateSpaceRequest {
    /// Whether the user explicitly consented to having their required
    /// attributes verified for this space (the "I understand and
    /// agree…" checkbox in the join layover).
    #[serde(default)]
    pub informed_agreed: bool,
}

#[post("/api/spaces/{space_id}/participate", user: OptionalUser)]
pub async fn participate_space(
    space_id: SpacePartition,
    body: ParticipateSpaceRequest,
) -> Result<ParticipateSpaceResponse> {
    let agreed = Some(body.informed_agreed);
    let config = crate::features::spaces::config::get();
    let dynamo = config.common.dynamodb();
    let now = get_now_timestamp_millis();

    let space_pk_partition: Partition = space_id.clone().into();
    let space = SpaceCommon::get_by_partition(&space_pk_partition).await?;
    let space = space.ok_or_else(|| Error::NotFound("Space Not Found".to_string()))?;
    let space_pk = space.partition();
    if !space.is_participation_open() {
        return Err(Error::ParticipationNotOpen);
    }

    let post_pk = space_pk.clone().to_post_key()?;
    let post = load_post(&post_pk).await?;
    let post = post.ok_or_else(|| Error::NotFound("Post Not Found".to_string()))?;

    let user: Option<User> = user.into();
    let user = user.ok_or(Error::NoSessionFound)?;
    let user_pk = user.pk();

    // Sub-team broadcast audience members (parent + recognized
    // sub-teams) are auto-invited — same bypass used by `get_space` and
    // the `SpaceUserRole` extractor so all three gates agree.
    let is_broadcast_audience =
        crate::features::sub_team::services::broadcast_access::is_broadcast_audience(
            dynamo, &post, &user_pk,
        )
        .await;

    let invitation_allowed = if space.visibility != SpaceVisibility::Public {
        if is_broadcast_audience {
            true
        } else {
            let member = SpaceInvitationMember::get_for(&space_pk, &user_pk).await?;
            matches!(
                member.as_ref().map(|member| member.status),
                Some(InvitationStatus::Invited) | Some(InvitationStatus::Accepted)
            )
        }
    } else {
        false
    };

    let permissions = post.get_permissions(dynamo, Some(user.clone())).await?;
    if !invitation_allowed && !permissions.contains(TeamGroupPermission::SpaceRead) {
        return Err(Error::NoPermission);
    }

    #[cfg(feature = "server")]
    check_if_satisfying_panel_attribute(&space, dynamo, &user).await?;

    let participant = SpaceParticipant::get_participant(&space_pk, &user_pk).await?;
    if participant.is_some() {
        return Err(Error::AlreadyParticipating);
    }

    let author = AuthorPartition::from(user_pk.clone());
    // SpaceScore is Postgres-backed — fetch the existing row by natural key.
    let existing_score = SpaceScore::get_for(&space_id, &author).await?;

    // Broadcast audience members fall through to the fresh-participate
    // path below, which creates both `SpaceParticipant` and an `Accepted`
    // `SpaceInvitationMember` row in one transaction — same effect as
    // an explicit invitation, no extra branch needed here.
    if space.visibility != SpaceVisibility::Public && !is_broadcast_audience {
        let member = SpaceInvitationMember::get_for(&space_pk, &user_pk).await?;
        let Some(member) = member else {
            return Err(Error::NoPermission);
        };
        match member.status {
            InvitationStatus::Invited => {}
            InvitationStatus::Pending => return Err(Error::NoPermission),
            InvitationStatus::Accepted | InvitationStatus::Declined => {
                let participant = SpaceParticipant::get_participant(&space_pk, &user_pk).await?;
                if participant.is_none() {
                    let mut sp = if space.anonymous_participation {
                        SpaceParticipant::new(space_pk.clone(), user_pk.clone())
                    } else {
                        SpaceParticipant::new_non_anonymous(space_pk.clone(), user.clone())
                    };
                    sp.informed_agreed = agreed;

                    create_participant_tx(&sp, &space_pk, now, None).await?;

                    // SpaceScore lives in Postgres now — persist it separately
                    // (outside the participant transaction) on first
                    // participation.
                    if existing_score.is_none() {
                        SpaceScore::new(
                            space_id.clone(),
                            author.clone(),
                            sp.display_name.clone(),
                            sp.profile_url.clone(),
                        )
                        .save()
                        .await?;
                    }

                    return Ok(ParticipateSpaceResponse {
                        username: sp.username,
                        display_name: sp.display_name,
                        profile_url: sp.profile_url,
                    });
                } else {
                    return Err(Error::AlreadyParticipating);
                }
            }
        }
    }

    let mut sp = if space.anonymous_participation {
        SpaceParticipant::new(space_pk.clone(), user_pk.clone())
    } else {
        SpaceParticipant::new_non_anonymous(space_pk.clone(), user.clone())
    };
    sp.informed_agreed = agreed;

    let mut invitation = SpaceInvitationMember::new(space_pk.clone(), user.clone());
    invitation.status = InvitationStatus::Accepted;

    create_participant_tx(&sp, &space_pk, now, Some(&invitation)).await?;

    // SpaceScore lives in Postgres now — persist it separately (outside the
    // participant transaction) on first participation.
    if existing_score.is_none() {
        SpaceScore::new(
            space_id,
            author,
            sp.display_name.clone(),
            sp.profile_url.clone(),
        )
        .save()
        .await?;
    }

    Ok(ParticipateSpaceResponse {
        username: sp.username,
        display_name: sp.display_name,
        profile_url: sp.profile_url,
    })
}

/// Fetch the `Post` backing a space by its (relabeled) `Partition::Feed`
/// key. `Post` is Postgres-backed now and keyed by its feed UUID.
#[cfg(feature = "server")]
async fn load_post(post_pk: &Partition) -> Result<Option<Post>> {
    let id = match post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    };
    match id {
        Some(id) => Ok(Post::get_by_feed_id(id).await?),
        None => Ok(None),
    }
}

/// Atomically create a `SpaceParticipant` row, bump `SpaceCommon.participants`,
/// and (when `invitation` is `Some`) upsert the invitation row to `Accepted` —
/// all inside one Postgres transaction. Replaces the original DynamoDB
/// `transact_write_items!` call.
#[cfg(feature = "server")]
async fn create_participant_tx(
    sp: &SpaceParticipant,
    space_pk: &Partition,
    now: i64,
    invitation: Option<&SpaceInvitationMember>,
) -> Result<()> {
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;

    if let Err(e) = SpaceParticipant::repository().with_tx(&tx).insert(sp).await {
        let _ = tx.rollback().await;
        return Err(crate::common::Error::from(e));
    }

    if let Err(e) = increase_space_participants_tx(&tx, space_pk, 1, now).await {
        let _ = tx.rollback().await;
        return Err(e);
    }

    if let Some(invitation) = invitation {
        if let Err(e) = SpaceInvitationMember::repository()
            .with_tx(&tx)
            .upsert_on(&["space_pk", "user_pk"], invitation)
            .await
        {
            let _ = tx.rollback().await;
            return Err(crate::common::Error::from(e));
        }
    }

    tx.commit().await.map_err(crate::common::Error::from)?;
    Ok(())
}

/// Atomic `participants += delta`, `updated_at = now` for one space, bound to
/// `tx`. Mirrors the original in-transaction DynamoDB `ADD participants`.
#[cfg(feature = "server")]
async fn increase_space_participants_tx(
    tx: &postgres::Tx,
    space_pk: &Partition,
    delta: i64,
    now: i64,
) -> Result<()> {
    use postgres::Value;
    use postgres::sqlx::{Postgres, QueryBuilder};

    let repo = SpaceCommon::repository().with_tx(tx);
    let table = SpaceCommon::table_name();

    let mut qb = QueryBuilder::<Postgres>::new(format!(
        "UPDATE \"{table}\" SET participants = participants + "
    ));
    Value::from(delta).push_bind(&mut qb);
    qb.push(", updated_at = ");
    Value::from(now).push_bind(&mut qb);
    qb.push(" WHERE space_pk = ");
    Value::from(space_pk.to_string()).push_bind(&mut qb);

    repo.db().execute(qb).await.map_err(|e| {
        crate::error!("participate_space: failed to increase space participants: {e}");
        crate::common::Error::from(e)
    })?;
    Ok(())
}

#[cfg(feature = "server")]
fn is_collective_panel(panel: &SpacePanelQuota) -> bool {
    let attrs = crate::features::spaces::controllers::panel_requirements::panel_attributes(panel);
    attrs
        .iter()
        .all(|attr| matches!(attr, PanelAttribute::CollectiveAttribute(_)))
}

#[cfg(feature = "server")]
async fn check_if_satisfying_panel_attribute(
    space: &SpaceCommon,
    cli: &aws_sdk_dynamodb::Client,
    user: &User,
) -> Result<()> {
    use crate::features::spaces::models::UserAttributesExt;

    let space_pk = space.partition();
    let user_pk = user.pk();

    let panel_quota =
        crate::features::spaces::controllers::panel_requirements::list_panel_quotas(cli, &space_pk)
            .await?;

    if panel_quota.is_empty() {
        return Ok(());
    }

    let user_attributes = user.get_attributes().await?;
    let age: Option<u8> = user_attributes.age().and_then(|v| u8::try_from(v).ok());
    // `VerifiedAttributes.gender` is the bare snake_case string ("male" /
    // "female") on Postgres — parse it back to the typed enum
    // `panel_matches_user` expects, same as serde would.
    let gender = match user_attributes.gender.as_deref() {
        Some("male") => Some(crate::common::attribute::Gender::Male),
        Some("female") => Some(crate::common::attribute::Gender::Female),
        _ => None,
    };
    let has_university = user_attributes
        .university
        .as_ref()
        .map(|value| !value.is_empty())
        .unwrap_or(false);

    let (_, conditional_panels): (Vec<_>, Vec<_>) =
        panel_quota.into_iter().partition(is_collective_panel);

    // Collective panels collect self-declared demographics during or after
    // participation — no pre-existing attributes are required.  Only
    // conditional (verifiable) panels need the user to already satisfy them.

    if conditional_panels.is_empty() {
        if space.quota > 0 {
            if space.remains <= 0 {
                return Err(Error::FullQuota);
            }

            let participant = SpacePanelParticipant::get_for(&space_pk, &user_pk).await?;
            if participant.is_none() {
                let participants = SpacePanelParticipant::new(space_pk.clone(), user.clone());
                create_panel_participant_tx(&participants, &space_pk, None).await?;
            }
        }
        return Ok(());
    }

    if space.remains <= 0 {
        return Err(Error::FullQuota);
    }

    for q in conditional_panels {
        if q.remains <= 0 {
            continue;
        }

        if crate::features::spaces::controllers::panel_requirements::panel_matches_user(
            age,
            gender,
            has_university,
            &q,
        ) {
            let participant = SpacePanelParticipant::get_for(&space_pk, &user_pk).await?;

            if participant.is_none() {
                let participants = SpacePanelParticipant::new(space_pk.clone(), user.clone());
                create_panel_participant_tx(&participants, &space_pk, Some(&q)).await?;
            }

            return Ok(());
        }
    }

    Err(Error::LackOfVerifiedAttributes)
}

/// Atomically create a `SpacePanelParticipant` row, decrement
/// `SpaceCommon.remains`, and (when `quota` is `Some`) decrement that panel
/// bucket's `remains` too — all inside one Postgres transaction. Replaces the
/// original DynamoDB `transact_write!` call.
#[cfg(feature = "server")]
async fn create_panel_participant_tx(
    participant: &SpacePanelParticipant,
    space_pk: &Partition,
    quota: Option<&SpacePanelQuota>,
) -> Result<()> {
    let tx = postgres::Tx::begin()
        .await
        .map_err(crate::common::Error::from)?;

    if let Err(e) = SpacePanelParticipant::repository()
        .with_tx(&tx)
        .insert(participant)
        .await
    {
        let _ = tx.rollback().await;
        return Err(crate::common::Error::from(e));
    }

    if let Err(e) = decrease_space_remains_tx(&tx, space_pk, 1).await {
        let _ = tx.rollback().await;
        return Err(e);
    }

    if let Some(quota) = quota {
        if let Err(e) = decrease_panel_quota_remains_tx(&tx, quota, 1).await {
            let _ = tx.rollback().await;
            return Err(e);
        }
    }

    tx.commit().await.map_err(crate::common::Error::from)?;
    Ok(())
}

/// Atomic `remains -= delta` on `SpaceCommon`, bound to `tx`.
#[cfg(feature = "server")]
async fn decrease_space_remains_tx(
    tx: &postgres::Tx,
    space_pk: &Partition,
    delta: i64,
) -> Result<()> {
    use postgres::Value;
    use postgres::sqlx::{Postgres, QueryBuilder};

    let repo = SpaceCommon::repository().with_tx(tx);
    let table = SpaceCommon::table_name();

    let mut qb =
        QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET remains = remains - "));
    Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE space_pk = ");
    Value::from(space_pk.to_string()).push_bind(&mut qb);

    repo.db().execute(qb).await.map_err(|e| {
        crate::error!("participate_space: failed to decrease space remains: {e}");
        crate::common::Error::from(e)
    })?;
    Ok(())
}

/// Atomic `remains -= delta` on one `SpacePanelQuota` bucket, bound to `tx`.
#[cfg(feature = "server")]
async fn decrease_panel_quota_remains_tx(
    tx: &postgres::Tx,
    quota: &SpacePanelQuota,
    delta: i64,
) -> Result<()> {
    use postgres::Value;
    use postgres::sqlx::{Postgres, QueryBuilder};

    let repo = SpacePanelQuota::repository().with_tx(tx);
    let table = SpacePanelQuota::table_name();

    let mut qb =
        QueryBuilder::<Postgres>::new(format!("UPDATE \"{table}\" SET remains = remains - "));
    Value::from(delta).push_bind(&mut qb);
    qb.push(" WHERE space_id = ");
    Value::from(quota.space_id.clone()).push_bind(&mut qb);
    qb.push(" AND attribute_label = ");
    Value::from(quota.attribute_label.clone()).push_bind(&mut qb);
    qb.push(" AND attribute_value = ");
    Value::from(quota.attribute_value.clone()).push_bind(&mut qb);

    repo.db().execute(qb).await.map_err(|e| {
        crate::error!("participate_space: failed to decrease panel quota remains: {e}");
        crate::common::Error::from(e)
    })?;
    Ok(())
}
