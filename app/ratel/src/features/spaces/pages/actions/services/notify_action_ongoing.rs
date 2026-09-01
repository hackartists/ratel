use crate::common::*;
use crate::common::models::notification::Notification;
use crate::common::models::space::SpaceCommon;
use crate::features::posts::models::Post;
use crate::features::spaces::pages::actions::models::SpaceAction;
use crate::features::spaces::space_common::services::space_status_change_notification::{
    resolve_emails, resolve_space_participant_user_pks,
};
use dioxus_translate::{Language, Translate};

const EMAIL_CHUNK_SIZE: usize = 50;

/// Fan out an inbox + email notification to every `SpaceParticipant` of a
/// space when one of its actions transitions `Designing → Ongoing`.
///
/// This is invoked from the DynamoDB Stream pipeline (Lambda + local-dev
/// poller). The trigger condition (old=DESIGNING, new=ONGOING) is enforced
/// upstream by the EventBridge Pipe filter; here we only re-verify the
/// parent space is `Ongoing` (the audience is meaningful only then).
pub async fn notify_action_ongoing(action: SpaceAction) -> Result<()> {
    tracing::info!(
        space_id = %action.space_id,
        action_id = %action.action_id,
        "notify_action_ongoing: received event",
    );

    let space_id: SpacePartition = SpacePartition(action.space_id.clone());
    let space_pk: Partition = space_id.clone().into();
    let action_id = action.action_id.clone();

    // Guard: parent space must be Ongoing — no audience otherwise.
    let space = match SpaceCommon::get_by_partition(&space_pk).await? {
        Some(s) => s,
        None => return Ok(()),
    };
    if space.status != Some(SpaceStatus::Ongoing) {
        tracing::info!(
            space_pk = %space_pk,
            status = ?space.status,
            "notify_action_ongoing: parent space not Ongoing, skipping",
        );
        return Ok(());
    }

    let user_pks = resolve_space_participant_user_pks(&space_pk).await?;
    if user_pks.is_empty() {
        tracing::info!("notify_action_ongoing: no participants, skipping");
        return Ok(());
    }

    // Load post for the space title used in inbox + email copy.
    let post_pk = space_pk.clone().to_post_key()?;
    let post_id = match &post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    };
    let space_title = match post_id {
        Some(id) => match Post::get_by_feed_id(id).await? {
            Some(p) => p.title,
            None => {
                tracing::error!("notify_action_ongoing: post not found for {}", post_pk);
                return Ok(());
            }
        },
        None => {
            tracing::error!("notify_action_ongoing: invalid post key {}", post_pk);
            return Ok(());
        }
    };

    let cta_url = action.get_cta_url();

    tracing::info!(
        space_pk = %space_pk,
        action_id = %action_id,
        recipient_count = user_pks.len(),
        "notify_action_ongoing: fanning out notifications",
    );

    // 1. Fan inbox rows. Idempotent on (user, kind, "{space_pk}:{action_id}")
    //    via InboxDedupMarker (7-day lock) — defends against retries / double-fires.
    let dedup_source = format!("{}:{}", space_pk, action_id);
    for user_pk in &user_pks {
        let payload = InboxPayload::SpaceActionOngoing {
            space_id: space_id.clone(),
            space_title: space_title.clone(),
            action_id: action_id.clone(),
            action_type: action.space_action_type.clone(),
            action_title: action.title.clone(),
            cta_url: cta_url.clone(),
        };
        if let Err(e) = crate::common::utils::inbox::create_inbox_row_once(
            user_pk.clone(),
            payload,
            &dedup_source,
        )
        .await
        {
            crate::error!("notify_action_ongoing inbox row failed: {e}");
        }
    }

    // 2. Resolve emails + fan out via Notification rows (50 per row).
    let emails = resolve_emails(user_pks).await?;
    if emails.is_empty() {
        tracing::info!("notify_action_ongoing: no emails resolved, skipping email fan-out");
        return Ok(());
    }

    let action_type_label = action.space_action_type.translate(&Language::En).to_string();

    for chunk in emails.chunks(EMAIL_CHUNK_SIZE) {
        let n = Notification::new(NotificationData::SpaceActionOngoing {
            emails: chunk.to_vec(),
            space_title: space_title.clone(),
            action_title: action.title.clone(),
            action_type_label: action_type_label.clone(),
            cta_url: cta_url.clone(),
        });
        if let Err(e) = n.create().await {
            tracing::error!(
                "notify_action_ongoing: failed to create Notification row: {e}"
            );
            // Continue — don't abort fan-out on a single failed chunk.
        }
    }

    Ok(())
}
