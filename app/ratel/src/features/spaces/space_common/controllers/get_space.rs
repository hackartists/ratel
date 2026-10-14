use crate::common::models::space::{SpaceCommon, SpaceParticipant};
use crate::common::models::{OptionalUser, User};
use crate::common::*;
use crate::features::posts::models::Post;
use crate::features::posts::types::{BoosterType, SpaceType, TeamGroupPermission};
#[cfg(feature = "server")]
use crate::spaces::{InvitationStatus, SpaceInvitationMember};

#[mcp_tool(
    name = "get_space",
    description = "Get space details by ID, including status, visibility, participation info."
)]
#[get("/api/spaces/{space_id}", user: OptionalUser)]
pub async fn get_space(
    #[mcp(description = "Space partition key (e.g. 'SPACE#<uuid>' or '<uuid>')")]
    space_id: SpacePartition,
) -> Result<SpaceResponse> {
    let config = crate::features::spaces::space_common::config::get();
    let dynamo = config.common.dynamodb();

    let space_id_partition = space_id.clone();
    let space_pk_partition: Partition = space_id.into();
    let space = SpaceCommon::get_by_partition(&space_pk_partition).await?;
    let space = space.ok_or_else(|| Error::NotFound("Space Not Found".to_string()))?;
    let space_pk = space.partition();

    let post_pk = space_pk.clone().to_post_key()?;
    let post_uuid = match &post_pk {
        Partition::Feed(id) => uuid::Uuid::parse_str(id).ok(),
        _ => None,
    };
    let post = match post_uuid {
        Some(id) => Post::get_by_feed_id(id).await?,
        None => None,
    };
    let post = post.ok_or_else(|| Error::NotFound("Post Not Found".to_string()))?;
    let user: Option<User> = user.into();

    // Sub-team broadcast / direct-message Posts override Space visibility:
    // even if the attached Space is `Public`, audience is restricted to the
    // broadcast's audience. The extension method is a no-op for ordinary
    // posts. Defined in `sub_team::services::broadcast_access`.
    use crate::features::sub_team::services::broadcast_access::PostBroadcastAccessExt;
    let user_pk = user.as_ref().map(|u| u.pk());
    post.assert_broadcast_access(dynamo, user_pk.as_ref())
        .await?;

    let permissions = post.get_permissions(dynamo, user.clone()).await?;
    let liked = if let Some(ref user) = user {
        post.is_liked(&user.pk()).await?
    } else {
        false
    };

    let is_participation_open = space.is_participation_open();

    // Admins/Creators are not participants of their own space — they
    // own/manage it. `SpaceParticipant` rows for them are either absent
    // (team-owned spaces created via `publish_announcement_handler`) or
    // irrelevant to the response (the "Join" CTA / participant identity
    // fields would never apply). Reusing the already-loaded
    // `permissions.contains(SpaceEdit)` signal — true for individual
    // creators (`get_permissions` returns `all()` on `user.pk ==
    // post.user_pk`) and for team admins/owners (via
    // `Team::get_user_role`) — lets us skip the read entirely with no
    // extra DDB round-trip.
    //
    // This also sidesteps a latent bug in `bump_participant_activity`:
    // when an admin triggers e.g. `create_discussion`, the helper issues
    // a bare `UpdateItem` against the (admin's) non-existent
    // SpaceParticipant key. DynamoDB upserts a partial row containing
    // only the keys + `last_activity_at`, and the next `SpaceParticipant::get`
    // here would deserialize-fail with `missing field 'created_at'`,
    // surfacing as "Something went wrong" on the space arena. With this
    // skip, the admin path never reads back the (potentially partial)
    // row, so the symptom is contained even before the bump helper is
    // tightened.
    let is_admin = permissions.contains(TeamGroupPermission::SpaceEdit);

    let (user_participant, can_participate) = if let Some(ref user) = user {
        if is_admin {
            (None, false)
        } else {
            let user_pk = user.pk();
            let participant = SpaceParticipant::get_participant(&space_pk, &user_pk).await?;
            let invited = if space.visibility != SpaceVisibility::Public {
                let invitation = SpaceInvitationMember::get_for(&space_pk, &user_pk).await?;
                let explicit = matches!(
                    invitation.as_ref().map(|member| member.status),
                    Some(InvitationStatus::Invited) | Some(InvitationStatus::Accepted)
                );
                explicit
                    || crate::features::sub_team::services::broadcast_access::is_broadcast_audience(
                        dynamo, &post, &user_pk,
                    )
                    .await
            } else {
                true
            };
            let can_participate = participant.is_none() && is_participation_open && invited;
            (participant, can_participate)
        }
    } else {
        (None, false)
    };

    let (participated, participant_display_name, participant_profile_url, participant_username) =
        if let Some(participant) = user_participant {
            (
                true,
                Some(participant.display_name),
                Some(participant.profile_url),
                Some(participant.username),
            )
        } else {
            (false, None, None, None)
        };

    // Check if any action has prerequisite flag
    let has_prerequisite = {
        use crate::features::spaces::pages::actions::models::SpaceAction;
        let actions = SpaceAction::list_by_space(&space_id_partition)
            .await
            .unwrap_or_default();
        actions.iter().any(|a| a.prerequisite)
    };

    // A space "collects personal information" iff one of its polls carries a
    // `PrivacyConsent` question. The frontend uses this to default the
    // sign-in modal to the phone tab (that question type always collects a
    // verified phone number), rather than duplicating poll-question lookup
    // logic client-side.
    let has_privacy_consent_question = {
        use crate::features::spaces::pages::actions::actions::poll::models::SpacePoll;
        use crate::features::spaces::pages::actions::actions::poll::types::Question;
        let polls = SpacePoll::list_by_space(&space_id_partition)
            .await
            .unwrap_or_default();
        polls
            .iter()
            .any(|poll| poll.questions.iter().any(|q| matches!(q, Question::PrivacyConsent(_))))
    };

    Ok(SpaceResponse {
        id: space_pk.clone().into(),
        post_id: post_pk.into(),
        sk: EntityType::SpaceCommon,
        title: post.title,
        content: if space.content.is_empty() {
            strip_color_styles(&post.body.0.to_html())
        } else {
            space.content
        },
        created_at: space.created_at,
        updated_at: space.updated_at,
        urls: post.urls.into(),
        space_type: post.space_type.unwrap_or_default(),
        features: vec![],
        status: space.status,
        permissions: permissions.into(),
        author_type: post.author_type.into(),
        author_display_name: post.author_display_name,
        author_username: post.author_username,
        author_profile_url: post.author_profile_url,
        certified: false,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        liked,
        reports: space.reports,
        rewards: space.rewards,
        visibility: space.visibility,
        publish_state: space.publish_state,
        booster: post.booster.unwrap_or_default(),
        files: None,
        anonymous_participation: space.anonymous_participation,
        join_anytime: space.join_anytime,
        sampling_enabled: space.sampling_enabled,
        sampling_recruit_open: space.sampling_recruit_open,
        can_participate,
        participants: space.participants,
        participated,
        participant_display_name,
        participant_profile_url,
        participant_username,
        remains: space.remains,
        quota: space.quota,
        is_report: false,
        logo: space.logo,
        has_prerequisite,
        has_privacy_consent_question,
        started_at: space.started_at,
        greeting: space.greeting,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct SpaceResponse {
    pub id: SpacePartition,
    pub post_id: FeedPartition,
    pub sk: EntityType,
    pub title: String,
    pub content: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub urls: Vec<String>,
    pub space_type: SpaceType,
    pub features: Vec<String>,
    pub status: Option<SpaceStatus>,
    pub permissions: i64,
    pub author_type: UserType,
    pub author_display_name: String,
    pub author_username: String,
    pub author_profile_url: String,
    pub certified: bool,
    pub likes: i64,
    pub comments: i64,
    pub shares: i64,
    pub liked: bool,
    pub reports: i64,
    pub rewards: Option<i64>,
    pub visibility: SpaceVisibility,
    pub publish_state: SpacePublishState,
    pub booster: BoosterType,
    pub files: Option<Vec<File>>,
    pub anonymous_participation: bool,
    #[serde(default)]
    pub join_anytime: bool,
    /// Whether the Sampling app is installed; the space then moves
    /// `Open → Sampling → Ongoing` instead of `Open → Ongoing`.
    #[serde(default)]
    pub sampling_enabled: bool,
    /// Whether new participants may still join while the space is in
    /// `Sampling`.
    #[serde(default)]
    pub sampling_recruit_open: bool,
    pub can_participate: bool,
    pub participants: i64,
    pub participated: bool,
    pub participant_display_name: Option<String>,
    pub participant_profile_url: Option<String>,
    pub participant_username: Option<String>,
    pub remains: i64,
    pub quota: i64,
    pub is_report: bool,
    #[serde(default)]
    pub logo: String,
    #[serde(default)]
    pub has_prerequisite: bool,
    #[serde(default)]
    pub has_privacy_consent_question: bool,
    pub started_at: Option<i64>,
    /// Waiting-screen greeting (HTML) shown to Candidates who finished the
    /// prerequisites. Empty when the admin has not written one.
    #[serde(default)]
    pub greeting: String,
}

/// Removes inline `color:` declarations so rich text authored in one theme
/// stays readable in the other.
#[cfg(feature = "server")]
pub(crate) fn strip_color_styles(html: &str) -> String {
    let re = regex::Regex::new(r"(?i)\s*color\s*:\s*[^;]+;?").unwrap();
    re.replace_all(html, "").to_string()
}

impl SpaceResponse {
    pub fn description(&self) -> String {
        let re = regex::Regex::new(r"<[^>]*>").unwrap();
        let content = re.replace_all(&self.content, "");

        content.to_string()
    }
}
