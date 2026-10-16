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
const SMS_CHUNK_SIZE: usize = 50;

/// Single-part Korean SMS limit, measured in EUC-KR bytes.
const SMS_MAX_BYTES: usize = 90;

/// Lower bound on the title budget so the SMS stays recognizable even when
/// the fixed copy plus the link already consume the whole single-part limit.
const SMS_MIN_TITLE_BYTES: usize = 20;

const SMS_ELLIPSIS: &str = "…";

/// Contact points for one notification fan-out: users with a real mailbox
/// receive email, phone-only signups (placeholder email) receive SMS.
#[derive(Debug, Default, Clone, PartialEq)]
pub(crate) struct Recipients {
    pub emails: Vec<String>,
    pub phones: Vec<String>,
}

/// Handle a space status transition by resolving the audience and creating
/// Notification rows to fan out via the existing SES / SNS pipeline.
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
        | (Some(SpaceStatus::Open), SpaceStatus::Sampling)
        | (Some(SpaceStatus::Ongoing), SpaceStatus::Finished) => {
            resolve_space_participant_user_pks(&event_space_pk).await?
        }
        (Some(SpaceStatus::Sampling), SpaceStatus::Ongoing) => {
            let space = match load_space(&event_space_pk).await? {
                Some(s) => s,
                None => return Ok(()),
            };
            if space.sampling_enabled && !space.join_anytime {
                resolve_entered_sample_user_pks(&space).await?
            } else {
                resolve_space_participant_user_pks(&event_space_pk).await?
            }
        }
        _ => return Ok(()),
    };

    if user_pks.is_empty() {
        tracing::info!("handle_space_status_change: no recipients, skipping");
        return Ok(());
    }

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

    let recipients = resolve_recipients(user_pks.clone()).await?;

    let (headline, body) = status_change_copy(&event.new_status, &post.title);
    let cta_url = build_space_url(&event_space_pk);

    tracing::info!(
        space_pk = %event.space_pk,
        email_count = recipients.emails.len(),
        phone_count = recipients.phones.len(),
        "handle_space_status_change: fanning out notifications",
    );

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

    for chunk in recipients.emails.chunks(EMAIL_CHUNK_SIZE) {
        let notification = Notification::new(NotificationData::SendSpaceStatusUpdate {
            emails: chunk.to_vec(),
            headline: headline.clone(),
            body: body.clone(),
            cta_url: cta_url.clone(),
            space_title: post.title.clone(),
        });
        if let Err(e) = notification.save().await {
            tracing::error!("handle_space_status_change: failed to create notification row: {e}");
        }
    }

    if let Some(message) = status_change_sms(&event.new_status, &post.title, &cta_url) {
        for chunk in recipients.phones.chunks(SMS_CHUNK_SIZE) {
            let notification = Notification::new(NotificationData::SendSpaceStatusSms {
                phones: chunk.to_vec(),
                message: message.clone(),
            });
            if let Err(e) = notification.save().await {
                tracing::error!(
                    "handle_space_status_change: failed to create sms notification row: {e}"
                );
            }
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

/// Users who entered the sample of a Sampling space — the only audience of
/// the start notice when late joining is off.
pub(crate) async fn resolve_entered_sample_user_pks(space: &SpaceCommon) -> Result<Vec<Partition>> {
    use crate::features::spaces::pages::apps::apps::sampling::services::sampling_space_id;
    use crate::features::spaces::pages::apps::apps::sampling::{
        SamplingMemberStatus, SpaceSamplingMember,
    };

    Ok(SpaceSamplingMember::list_by_space(&sampling_space_id(space))
        .await?
        .into_iter()
        .filter(|m| m.status == SamplingMemberStatus::Entered)
        .filter_map(|m| m.user_pk.parse::<Partition>().ok())
        .collect())
}

/// Deliverable email addresses for `user_pks`; placeholder addresses minted
/// for phone / telegram / wallet signups are excluded.
pub(crate) async fn resolve_emails(user_pks: Vec<Partition>) -> Result<Vec<String>> {
    Ok(resolve_recipients(user_pks).await?.emails)
}

pub(crate) async fn resolve_recipients(user_pks: Vec<Partition>) -> Result<Recipients> {
    let mut contacts: Vec<(String, Option<String>)> = Vec::new();

    for pk in user_pks {
        let Partition::User(id) = pk else { continue };
        let Ok(id) = uuid::Uuid::parse_str(&id) else {
            continue;
        };
        let Ok(Some(u)) = User::get_by_id(id).await else {
            continue;
        };
        contacts.push((u.email, u.phone));
    }
    Ok(split_recipients(contacts))
}

/// Whether `email` is a synthetic address such as `{username}@phone.placeholder`.
pub(crate) fn is_placeholder_email(email: &str) -> bool {
    email
        .rsplit_once('@')
        .map(|(_, domain)| domain.to_ascii_lowercase().ends_with(".placeholder"))
        .unwrap_or(false)
}

/// Route each `(email, phone)` pair to exactly one channel: a real email wins;
/// otherwise a placeholder-email user with a phone number gets SMS. Both
/// lists are deduplicated, preserving first-seen order.
pub(crate) fn split_recipients(
    contacts: impl IntoIterator<Item = (String, Option<String>)>,
) -> Recipients {
    let mut seen_emails: HashSet<String> = HashSet::new();
    let mut seen_phones: HashSet<String> = HashSet::new();
    let mut out = Recipients::default();

    for (email, phone) in contacts {
        let email = email.trim();
        if email.is_empty() {
            continue;
        }
        if !is_placeholder_email(email) {
            if seen_emails.insert(email.to_string()) {
                out.emails.push(email.to_string());
            }
            continue;
        }
        let Some(phone) = phone.as_deref().map(str::trim).filter(|p| !p.is_empty()) else {
            continue;
        };
        if seen_phones.insert(phone.to_string()) {
            out.phones.push(phone.to_string());
        }
    }
    out
}

/// Short Korean SMS for status changes that ask participants to act.
/// Only `Ongoing` and `Sampling` produce a message.
pub(crate) fn status_change_sms(
    new_status: &SpaceStatus,
    space_title: &str,
    cta_url: &str,
) -> Option<String> {
    let suffix = match new_status {
        SpaceStatus::Ongoing => "시작됐어요",
        SpaceStatus::Sampling => "샘플링이 시작됐어요",
        _ => return None,
    };
    let fixed = euc_kr_len("[Ratel]   ") + euc_kr_len(suffix) + euc_kr_len(cta_url);
    let budget = SMS_MAX_BYTES
        .saturating_sub(fixed)
        .max(SMS_MIN_TITLE_BYTES);
    let title = truncate_euc_kr(space_title.trim(), budget);
    Some(format!("[Ratel] {title} {suffix} {cta_url}"))
}

/// Byte length of `s` in EUC-KR, counting every non-ASCII character as two
/// bytes (characters outside EUC-KR force a Unicode SMS, so this stays a
/// conservative estimate).
pub(crate) fn euc_kr_len(s: &str) -> usize {
    s.chars().map(euc_kr_char_len).sum()
}

fn euc_kr_char_len(c: char) -> usize {
    if c.is_ascii() { 1 } else { 2 }
}

/// Truncate `s` on a character boundary so its EUC-KR length fits in
/// `max_bytes`, appending an ellipsis when anything was cut.
pub(crate) fn truncate_euc_kr(s: &str, max_bytes: usize) -> String {
    if euc_kr_len(s) <= max_bytes {
        return s.to_string();
    }
    let limit = max_bytes.saturating_sub(euc_kr_len(SMS_ELLIPSIS));
    let mut used = 0;
    let mut out = String::new();
    for c in s.chars() {
        let w = euc_kr_char_len(c);
        if used + w > limit {
            break;
        }
        used += w;
        out.push(c);
    }
    let trimmed = out.trim_end();
    if trimmed.is_empty() {
        return String::new();
    }
    format!("{trimmed}{SMS_ELLIPSIS}")
}

fn status_change_copy(new_status: &SpaceStatus, space_title: &str) -> (String, String) {
    match new_status {
        SpaceStatus::Open => (
            format!("{space_title} is now live"),
            "Your team just published this space. You can invite participants and track activity from the dashboard.".to_string(),
        ),
        SpaceStatus::Sampling => (
            format!("{space_title} is now sampling"),
            "Sampling has started for the space you joined. Head in to check whether you can enter.".to_string(),
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

#[cfg(test)]
mod tests {
    use super::*;

    fn contact(email: &str, phone: Option<&str>) -> (String, Option<String>) {
        (email.to_string(), phone.map(str::to_string))
    }

    #[test]
    fn placeholder_email_detection() {
        assert!(is_placeholder_email("alice@phone.placeholder"));
        assert!(is_placeholder_email("bob@telegram.placeholder"));
        assert!(is_placeholder_email("abcd1234@wallet.placeholder"));
        assert!(is_placeholder_email("carol@PHONE.PLACEHOLDER"));
        assert!(!is_placeholder_email("dave@example.com"));
        assert!(!is_placeholder_email("placeholder@example.com"));
        assert!(!is_placeholder_email("no-at-sign.placeholder"));
        assert!(!is_placeholder_email(""));
    }

    #[test]
    fn split_routes_real_email_to_email_only() {
        let r = split_recipients(vec![contact("a@example.com", Some("+821011112222"))]);
        assert_eq!(r.emails, vec!["a@example.com".to_string()]);
        assert!(r.phones.is_empty());
    }

    #[test]
    fn split_routes_placeholder_with_phone_to_sms() {
        let r = split_recipients(vec![
            contact("u1@phone.placeholder", Some("+821011112222")),
            contact("u2@telegram.placeholder", Some("+821033334444")),
        ]);
        assert!(r.emails.is_empty());
        assert_eq!(
            r.phones,
            vec!["+821011112222".to_string(), "+821033334444".to_string()]
        );
    }

    #[test]
    fn split_drops_unreachable_and_dedupes() {
        let r = split_recipients(vec![
            contact("", Some("+821000000000")),
            contact("w@wallet.placeholder", None),
            contact("t@telegram.placeholder", Some("  ")),
            contact("a@example.com", None),
            contact("a@example.com", None),
            contact("p1@phone.placeholder", Some("+821055556666")),
            contact("p2@phone.placeholder", Some("+821055556666")),
        ]);
        assert_eq!(r.emails, vec!["a@example.com".to_string()]);
        assert_eq!(r.phones, vec!["+821055556666".to_string()]);
    }

    #[test]
    fn euc_kr_length_counts_hangul_as_two_bytes() {
        assert_eq!(euc_kr_len("abc"), 3);
        assert_eq!(euc_kr_len("가나다"), 6);
        assert_eq!(euc_kr_len("[Ratel] 회의"), 12);
    }

    #[test]
    fn truncate_keeps_short_text_intact() {
        assert_eq!(truncate_euc_kr("짧은 제목", 20), "짧은 제목");
    }

    #[test]
    fn truncate_cuts_on_char_boundary() {
        let out = truncate_euc_kr("가나다라마바사", 9);
        assert_eq!(out, "가나다…");
        assert!(euc_kr_len(&out) <= 9);

        let out = truncate_euc_kr("a가b나c다", 6);
        assert_eq!(out, "a가b…");
        assert!(euc_kr_len(&out) <= 6);
    }

    #[test]
    fn truncate_handles_tiny_budget() {
        assert_eq!(truncate_euc_kr("가나다", 2), "");
        assert_eq!(truncate_euc_kr("가나다", 0), "");
    }

    #[test]
    fn sms_only_for_ongoing_and_sampling() {
        let url = "https://x.io/s/1";
        assert!(status_change_sms(&SpaceStatus::Open, "t", url).is_none());
        assert!(status_change_sms(&SpaceStatus::Finished, "t", url).is_none());
        assert_eq!(
            status_change_sms(&SpaceStatus::Ongoing, "토론회", url).unwrap(),
            "[Ratel] 토론회 시작됐어요 https://x.io/s/1"
        );
        assert_eq!(
            status_change_sms(&SpaceStatus::Sampling, "토론회", url).unwrap(),
            "[Ratel] 토론회 샘플링이 시작됐어요 https://x.io/s/1"
        );
    }

    #[test]
    fn sms_fits_single_part_limit_when_link_is_short() {
        let url = "https://x.io/s/1";
        let title = "아주 긴 스페이스 제목입니다 정말로 길고 길어서 단문 문자에 다 들어가지 않습니다";
        for status in [SpaceStatus::Ongoing, SpaceStatus::Sampling] {
            let msg = status_change_sms(&status, title, url).unwrap();
            assert!(euc_kr_len(&msg) <= SMS_MAX_BYTES, "{msg} = {}", euc_kr_len(&msg));
            assert!(msg.contains('…'));
            assert!(msg.ends_with(url));
        }
    }

    #[test]
    fn sms_keeps_minimum_title_when_link_is_long() {
        let url = format!("https://ratel.foundation/spaces/{}", uuid::Uuid::nil());
        let title = "가".repeat(40);
        let msg = status_change_sms(&SpaceStatus::Sampling, &title, &url).unwrap();
        let expected_title = format!("{}…", "가".repeat(9));
        assert!(msg.contains(&expected_title), "{msg}");
        assert!(msg.ends_with(&url));
    }
}
