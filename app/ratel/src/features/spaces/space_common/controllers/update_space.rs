#[cfg(feature = "server")]
use crate::common::models::space::SpaceCommon;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;
#[cfg(feature = "server")]
use crate::common::SpaceUserRole;
#[cfg(feature = "server")]
use crate::features::posts::models::Post;
#[cfg(feature = "server")]
use crate::features::posts::types::PostStatus;
#[cfg(feature = "server")]
use crate::features::spaces::space_common::models::SpaceInvitationMember;
#[cfg(feature = "server")]
use crate::features::spaces::pages::apps::apps::sampling::{
    SpaceSamplingCell, SpaceSamplingConfig, SpaceSamplingError,
};
use crate::features::spaces::space_common::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[serde(untagged)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub enum UpdateSpaceRequest {
    Publish {
        publish: bool,
        visibility: SpaceVisibility,
    },
    Content {
        content: String,
    },
    Title {
        title: String,
    },
    Visibility {
        visibility: SpaceVisibility,
    },
    Anonymous {
        anonymous_participation: bool,
    },
    JoinAnytime {
        join_anytime: bool,
    },
    ChangeVisibility {
        change_visibility: bool,
    },
    Start {
        start: bool,
    },
    Finish {
        finished: bool,
    },
    /// Moves a Sampling-enabled space from `Open` to `Sampling`. Declared
    /// before `StartTime`, whose all-optional fields would otherwise match
    /// `{"sampling": true}` under `untagged`.
    Sampling {
        sampling: bool,
    },
    Quota {
        quotas: i64,
    },
    Logo {
        logo: String,
    },
    /// Waiting-screen greeting (HTML). Declared before `StartTime`, whose
    /// all-optional fields would otherwise match `{"greeting": "..."}` under
    /// `untagged`.
    Greeting {
        greeting: String,
    },
    StartTime {
        started_at: Option<i64>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct UpdateSpaceResponse {
    pub pk: Partition,
    pub sk: EntityType,
    pub created_at: i64,
    pub updated_at: i64,
    pub status: Option<SpaceStatus>,
    pub publish_state: SpacePublishState,
    pub visibility: SpaceVisibility,
    pub content: String,
    pub anonymous_participation: bool,
    #[serde(default)]
    pub join_anytime: bool,
    pub quota: i64,
    pub remains: i64,
    #[serde(default)]
    pub logo: String,
    pub started_at: Option<i64>,
    #[serde(default)]
    pub greeting: String,
}

#[cfg(feature = "server")]
impl From<SpaceCommon> for UpdateSpaceResponse {
    fn from(s: SpaceCommon) -> Self {
        Self {
            pk: s.partition(),
            sk: EntityType::SpaceCommon,
            created_at: s.created_at,
            updated_at: s.updated_at,
            status: s.status,
            publish_state: s.publish_state,
            visibility: s.visibility,
            content: s.content,
            anonymous_participation: s.anonymous_participation,
            join_anytime: s.join_anytime,
            quota: s.quota,
            remains: s.remains,
            logo: s.logo,
            started_at: s.started_at,
            greeting: s.greeting,
        }
    }
}

#[mcp_tool(name = "update_space", description = "Update a space (publish, change visibility, content, title, start, finish, quota, etc.). Requires creator role.")]
#[patch("/api/spaces/{space_id}", role: SpaceUserRole, space: SpaceCommon)]
pub async fn update_space(
    #[mcp(description = "Space partition key")]
    space_id: SpacePartition,
    #[mcp(description = "Update data as JSON. Supported variants: {\"visibility\": \"Public\"}, {\"anonymous_participation\": true}, {\"join_anytime\": true}, {\"start\": true}, {\"finished\": true}, {\"sampling\": true} (Open → Sampling, Sampling app only), {\"quotas\": 100}, {\"title\": \"...\"}, {\"content\": \"...\"}, {\"publish\": true, \"visibility\": \"Public\"}, {\"logo\": \"url\"}, {\"greeting\": \"<p>...</p>\"} (HTML, only before the space starts)")]
    req: UpdateSpaceRequest,
) -> Result<UpdateSpaceResponse> {
    if role != SpaceUserRole::Creator {
        return Err(Error::NoPermission);
    }

    let conf = ServerConfig::default();
    let dynamo = conf.dynamodb();

    let space_pk: Partition = space_id.into();

    let now = chrono::Utc::now().timestamp_millis();
    let mut should_send_invitation = false;
    let mut updated_space = space.clone();
    updated_space.updated_at = now;
    let mut status_transition: Option<(Option<SpaceStatus>, SpaceStatus)> = None;
    let mut begin_sampling: Option<(SpaceSamplingConfig, Vec<SpaceSamplingCell>)> = None;

    match req {
        UpdateSpaceRequest::Publish {
            publish,
            visibility,
        } => {
            let post_pk = space_pk.clone().to_post_key()?;

            if !publish {
                return Err(SpaceError::StartNowNotSupported.into());
            }

            let mut post = load_post(&post_pk).await?;
            post.updated_at = now;
            post.space_visibility = Some(visibility.clone().into());
            post.visibility = Some(visibility.clone().into());
            post.status = PostStatus::Published;
            post.save().await?;

            should_send_invitation = true;

            updated_space.publish_state = SpacePublishState::Published;
            updated_space.status = Some(SpaceStatus::Open);
            updated_space.visibility = visibility;
            status_transition = Some((space.status.clone(), SpaceStatus::Open));
        }
        UpdateSpaceRequest::Visibility { visibility } => {
            let post_pk = space_pk.clone().to_post_key()?;
            let mut post = load_post(&post_pk).await?;
            post.updated_at = now;
            post.space_visibility = Some(visibility.clone().into());
            post.visibility = Some(visibility.clone().into());
            post.save().await?;

            updated_space.visibility = visibility;
        }
        UpdateSpaceRequest::Content { content } => {
            let post_pk = space_pk.clone().to_post_key()?;
            let mut post = load_post(&post_pk).await?;
            post.updated_at = now;
            post.body = ContentBody::html(content.clone()).into();
            post.save().await?;

            updated_space.content = content;
        }
        UpdateSpaceRequest::Title { title } => {
            let post_pk = space_pk.clone().to_post_key()?;
            let mut post = load_post(&post_pk).await?;
            post.updated_at = now;
            post.title = title;
            post.save().await?;
        }
        UpdateSpaceRequest::Start { start } => {
            use crate::features::spaces::space_common::models::SpaceEmailVerification;

            if updated_space.sampling_enabled && updated_space.status == Some(SpaceStatus::Open) {
                return Err(SpaceSamplingError::SamplingRequired.into());
            }
            let from = if updated_space.sampling_enabled {
                SpaceStatus::Sampling
            } else {
                SpaceStatus::Open
            };
            if updated_space.status != Some(from.clone()) || !start {
                return Err(SpaceError::StartNowNotSupported.into());
            }

            updated_space.status = Some(SpaceStatus::Ongoing);

            let _ = SpaceEmailVerification::expire_verifications(space_pk.clone()).await?;
            status_transition = Some((Some(from), SpaceStatus::Ongoing));
        }
        UpdateSpaceRequest::Sampling { sampling } => {
            use crate::features::spaces::pages::apps::apps::sampling::services::{
                sampling_space_id, validate_ready,
            };

            if !sampling {
                return Err(SpaceError::StartNowNotSupported.into());
            }
            if !updated_space.sampling_enabled {
                return Err(SpaceSamplingError::NotEnabled.into());
            }
            if updated_space.status != Some(SpaceStatus::Open) {
                return Err(SpaceSamplingError::InvalidTransition.into());
            }
            let sid = sampling_space_id(&updated_space);
            let config = SpaceSamplingConfig::get_for(&sid)
                .await?
                .ok_or(SpaceSamplingError::NotConfigured)?;
            let cells = validate_ready(&sid, &config).await?;

            updated_space.status = Some(SpaceStatus::Sampling);
            status_transition = Some((Some(SpaceStatus::Open), SpaceStatus::Sampling));
            begin_sampling = Some((config, cells));
        }
        UpdateSpaceRequest::Finish { finished } => {
            if updated_space.status != Some(SpaceStatus::Ongoing) {
                return Err(SpaceError::FinishNowNotSupported.into());
            }

            if !finished {
                return Err(SpaceError::FinishNowNotSupported.into());
            }

            updated_space.status = Some(SpaceStatus::Finished);
            status_transition = Some((Some(SpaceStatus::Ongoing), SpaceStatus::Finished));
        }
        UpdateSpaceRequest::Anonymous {
            anonymous_participation,
        } => {
            updated_space.anonymous_participation = anonymous_participation;
        }
        UpdateSpaceRequest::JoinAnytime { join_anytime } => {
            updated_space.join_anytime = join_anytime;
        }
        UpdateSpaceRequest::ChangeVisibility { .. } => {
            tracing::error!("ChangeVisibility is deprecated");
            return Err(SpaceError::UpdateFailed.into());
        }
        UpdateSpaceRequest::Logo { logo } => {
            updated_space.logo = logo;
        }
        UpdateSpaceRequest::Greeting { greeting } => {
            if !updated_space.is_greeting_editable() {
                return Err(SpaceError::GreetingLocked.into());
            }
            updated_space.greeting = strip_color_styles(&greeting);
        }
        UpdateSpaceRequest::StartTime { started_at } => {
            // Mirrors the pre-migration `su.with_started_at(ts)` guard: a
            // `None` payload leaves the persisted `started_at` untouched
            // rather than clearing it.
            if let Some(ts) = started_at {
                updated_space.started_at = Some(ts);
            }
        }
        UpdateSpaceRequest::Quota { quotas } => {
            let remains = updated_space.remains + (quotas - updated_space.quota);

            if remains < 0 {
                return Err(SpaceError::InvalidPanelQuota.into());
            }

            updated_space.quota = quotas;
            updated_space.remains = remains;
        }
    }

    // Postgres migration (Phase 5): commit the space write, the status-change
    // audit row, and the outbox event in ONE transaction — the transactional
    // outbox. Either all three commit or none do, so the participant-
    // notification event can never be lost relative to the status change.
    {
        use crate::common::events::outbox::{EventOutbox, topic};
        use crate::common::models::space::SpaceStatusChangeEvent;
        let tx = postgres::Tx::begin().await.map_err(crate::common::Error::from)?;
        updated_space = SpaceCommon::repository()
            .with_tx(&tx)
            .upsert_on(&["space_pk"], &updated_space)
            .await
            .map_err(crate::common::Error::from)?;
        // Phase 5: emit the space write so the outbox poller dispatches the
        // SPACE_COMMON rules (SpacePublished, PopularSpaceUpdate) — atomic with
        // the write. The dispatcher re-checks each rule's field conditions
        // (status / participants), so emitting on every update is safe.
        EventOutbox::emit_insert_tx(&tx, topic::SPACE_COMMON, &updated_space).await?;
        if let Some((config, cells)) = &begin_sampling {
            crate::features::spaces::pages::apps::apps::sampling::services::begin_sampling_tx(
                &tx, config, cells, now,
            )
            .await?;
        }
        if let Some((old_status, new_status)) = status_transition {
            let event = SpaceStatusChangeEvent::new(space_pk.clone(), old_status, new_status);
            SpaceStatusChangeEvent::repository()
                .with_tx(&tx)
                .insert(&event)
                .await
                .map_err(crate::common::Error::from)?;
            EventOutbox::emit_insert_tx(&tx, topic::SPACE_STATUS_CHANGE, &event).await?;
        }
        tx.commit().await.map_err(crate::common::Error::from)?;
    }

    if should_send_invitation {
        let post_pk = space_pk.clone().to_post_key()?;
        let post = load_post(&post_pk).await?;

        SpaceInvitationMember::send_email(&updated_space, post.title).await?;
    }

    crate::features::spaces::space_common::services::upsert_hot_space(dynamo, &space_pk).await;

    Ok(UpdateSpaceResponse::from(updated_space))
}

/// Fetch the `Post` backing a space by its (relabeled) `Partition::Feed`
/// key. Replaces the old DynamoDB point-read — `Post` is Postgres-backed now
/// and keyed by its feed UUID.
#[cfg(feature = "server")]
async fn load_post(post_pk: &Partition) -> Result<Post> {
    let id = match post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).map_err(|_| SpaceError::UpdateFailed)?,
        _ => return Err(SpaceError::UpdateFailed.into()),
    };
    Post::get_by_feed_id(id).await?.ok_or_else(|| {
        crate::error!("update_space: failed to load backing post");
        SpaceError::UpdateFailed.into()
    })
}
