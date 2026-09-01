use std::collections::HashSet;

use crate::common::models::auth::User;
use crate::common::models::notification::Notification;
use crate::common::models::space::{SpaceCommon, SpaceStatusChangeEvent};
use crate::common::types::{NotificationData, SpaceStatus};
use crate::common::*;
use crate::features::auth::UserTeam;
use crate::features::posts::models::{Post, TeamOwner};
use crate::features::spaces::space_common::types::SpaceStatusChangeError;

const EMAIL_CHUNK_SIZE: usize = 50;

/// Handle a space status transition by resolving the audience and creating
/// Notification rows to fan out via the existing SES pipeline.
pub async fn handle_space_status_change(event: SpaceStatusChangeEvent) -> Result<()> {
    tracing::info!(
        space_pk = %event.space_pk,
        old_status = ?event.old_status,
        new_status = ?event.new_status,
        "handle_space_status_change: received event",
    );

    let event_space_pk: Partition = event.space_pk.parse().map_err(|_| {
        crate::error!(
            "handle_space_status_change: invalid space_pk {}",
            event.space_pk
        );
        SpaceStatusChangeError::PostNotFound
    })?;

    // 1. Resolve audience user_pks first — cheap early-exit for no-op transitions.
    let user_pks = match (&event.old_status, &event.new_status) {
        (_, SpaceStatus::Open) => {
            let space = match load_space(&event_space_pk).await? {
                Some(s) => s,
                None => return Ok(()),
            };
            let user_pk: Partition = space.user_pk.parse().unwrap_or_default();
            match &user_pk {
                Partition::Team(_) => resolve_team_member_user_pks(&user_pk).await?,
                _ => return Ok(()),
            }
        }
        (Some(SpaceStatus::Open), SpaceStatus::Ongoing)
        | (Some(SpaceStatus::Ongoing), SpaceStatus::Finished) => {
            resolve_space_participant_user_pks(&event_space_pk).await?
        }
        _ => return Ok(()),
    };

    if user_pks.is_empty() {
        tracing::info!("handle_space_status_change: no recipients, skipping");
        return Ok(());
    }

    // 2. Load space + post for content (title, URL).
    let space = match load_space(&event_space_pk).await? {
        Some(s) => s,
        None => return Ok(()),
    };
    let space_pk = space.partition();
    let post_pk = space_pk.clone().to_post_key()?;
    let post = load_post(&post_pk).await?.ok_or_else(|| {
        tracing::error!("handle_space_status_change: post not found for {}", post_pk);
        SpaceStatusChangeError::PostNotFound
    })?;

    // 3. Resolve emails, deduped.
    let emails = resolve_emails(user_pks.clone()).await?;
    if emails.is_empty() {
        tracing::info!("handle_space_status_change: no emails resolved, skipping");
        return Ok(());
    }

    // 4. Pick copy and CTA URL.
    let (headline, body) = status_change_copy(&event.new_status, &post.title);
    let cta_url = build_space_url(&event_space_pk);

    tracing::info!(
        space_pk = %event.space_pk,
        recipient_count = emails.len(),
        "handle_space_status_change: fanning out notifications",
    );

    // 5. Fan inbox rows per participant. Idempotent on (user, space_pk, new_status).
    let space_id: SpacePartition = space_pk.clone().into();
    let space_title = post.title.clone();
    for user_pk in &user_pks {
        let payload = InboxPayload::SpaceStatusChanged {
            space_id: space_id.clone(),
            space_title: space_title.clone(),
            new_status: event.new_status.clone(),
            cta_url: cta_url.clone(),
        };
        let dedup_source = format!("{}#{:?}", event.space_pk, event.new_status);
        if let Err(e) = crate::common::utils::inbox::create_inbox_row_once(
            user_pk.clone(),
            payload,
            &dedup_source,
        )
        .await
        {
            crate::error!("space-status inbox row failed: {e}");
        }
    }

    // 6. Fan out into Notification rows, EMAIL_CHUNK_SIZE per row.
    for chunk in emails.chunks(EMAIL_CHUNK_SIZE) {
        let notification = Notification::new(NotificationData::SendSpaceStatusUpdate {
            emails: chunk.to_vec(),
            headline: headline.clone(),
            body: body.clone(),
            cta_url: cta_url.clone(),
            space_title: post.title.clone(),
        });
        if let Err(e) = notification.save().await {
            tracing::error!("handle_space_status_change: failed to create notification row: {e}");
            // Continue; don't abort fan-out on a single failed chunk.
        }
    }

    Ok(())
}

async fn load_space(space_pk: &Partition) -> Result<Option<SpaceCommon>> {
    Ok(SpaceCommon::get_by_partition(space_pk).await?)
}

/// Fetch the `Post` backing a space by its (relabeled) `Partition::Feed` key.
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

pub(crate) async fn resolve_team_member_user_pks(team_pk: &Partition) -> Result<Vec<Partition>> {
    let mut user_pks: HashSet<String> = HashSet::new();

    for row in UserTeam::find_by_team(team_pk).await? {
        user_pks.insert(row.user_pk);
    }

    // Always include the team owner.
    if let Partition::Team(id) = team_pk {
        if let Ok(id) = uuid::Uuid::parse_str(id) {
            if let Ok(Some(owner)) = TeamOwner::find_by_team(id).await {
                user_pks.insert(owner.user_pk);
            }
        }
    }

    Ok(user_pks
        .into_iter()
        .filter_map(|s| s.parse::<Partition>().ok())
        .collect())
}

pub(crate) async fn resolve_space_participant_user_pks(
    space_pk: &Partition,
) -> Result<Vec<Partition>> {
    use crate::common::models::space::SpaceParticipant;

    let mut user_pks: HashSet<String> = HashSet::new();
    let rows = SpaceParticipant::find_by_space(space_pk).await?;
    for row in rows {
        user_pks.insert(row.user_pk);
    }

    Ok(user_pks
        .into_iter()
        .filter_map(|s| s.parse::<Partition>().ok())
        .collect())
}

pub(crate) async fn resolve_emails(user_pks: Vec<Partition>) -> Result<Vec<String>> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<String> = Vec::new();

    for pk in user_pks {
        let Partition::User(id) = pk else { continue };
        let Ok(id) = uuid::Uuid::parse_str(&id) else {
            continue;
        };
        let Ok(Some(u)) = User::get_by_id(id).await else {
            continue;
        };
        if u.email.is_empty() {
            continue;
        }
        if seen.insert(u.email.clone()) {
            out.push(u.email);
        }
    }
    Ok(out)
}

fn status_change_copy(new_status: &SpaceStatus, space_title: &str) -> (String, String) {
    match new_status {
        SpaceStatus::Open => (
            format!("{space_title} is now live"),
            "Your team just published this space. You can invite participants and track activity from the dashboard.".to_string(),
        ),
        SpaceStatus::Ongoing => (
            format!("{space_title} is starting now"),
            "The space you joined has started. Head in to participate.".to_string(),
        ),
        SpaceStatus::Finished => (
            format!("{space_title} has ended"),
            "This space is now closed. Thank you for participating — you can still view results on the dashboard.".to_string(),
        ),
        _ => (
            format!("{space_title} status updated"),
            "The space's status has changed.".to_string(),
        ),
    }
}

fn build_space_url(space_pk: &Partition) -> String {
    let id = match space_pk {
        Partition::Space(id) => id.clone(),
        _ => String::new(),
    };
    let endpoint = crate::common::CommonConfig::default().env.web_endpoint();
    format!("{}/spaces/{}", endpoint, id)
}
