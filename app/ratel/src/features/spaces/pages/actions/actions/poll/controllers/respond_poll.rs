use crate::common::models::space::{SpaceCommon, SpaceUser};
use crate::features::spaces::pages::actions::actions::poll::*;
use crate::features::spaces::pages::actions::models::SpaceAction;
#[cfg(feature = "server")]
#[allow(unused_imports)]
use rmcp::schemars;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "server", derive(rmcp::schemars::JsonSchema))]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct RespondPollRequest {
    pub answers: Vec<Answer>,
    /// When set, the server uses this client-side ABE ciphertext for the
    /// canister upload instead of encrypting on the server. The plaintext
    /// `answers` are still recorded in DynamoDB for analytics.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_ciphertext_json: Option<String>,
    /// Voter tag matching `client_ciphertext_json`. Required when
    /// `client_ciphertext_json` is provided.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub client_voter_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[cfg_attr(feature = "ts-bridge", derive(ts_rs::TS), ts(export, export_to = "types/"))]
pub struct RespondPollResponse {}

#[cfg(feature = "server")]
#[derive(Debug, Clone, Serialize)]
struct PollMetadata {
    poll_sk: String,
    submitted_at_ms: i64,
}

#[cfg(feature = "server")]
fn age_to_respondent_age(age: u32) -> crate::common::attribute::Age {
    use crate::common::attribute::Age;

    match age {
        0..=17 => Age::Range {
            inclusive_min: 0,
            inclusive_max: 17,
        },
        18..=29 => Age::Range {
            inclusive_min: 18,
            inclusive_max: 29,
        },
        30..=39 => Age::Range {
            inclusive_min: 30,
            inclusive_max: 39,
        },
        40..=49 => Age::Range {
            inclusive_min: 40,
            inclusive_max: 49,
        },
        50..=59 => Age::Range {
            inclusive_min: 50,
            inclusive_max: 59,
        },
        60..=69 => Age::Range {
            inclusive_min: 60,
            inclusive_max: 69,
        },
        _ => Age::Range {
            inclusive_min: 70,
            inclusive_max: 100,
        },
    }
}

#[cfg(feature = "server")]
fn respondent_from_panel_attributes(
    attributes: &[crate::features::spaces::models::PanelAttribute],
    verified_attributes: &crate::common::models::did::VerifiedAttributes,
) -> Option<RespondentAttr> {
    use crate::features::spaces::models::{
        CollectiveAttribute, PanelAttribute, VerifiableAttribute,
    };

    let mut respondent = RespondentAttr::default();

    for attribute in attributes {
        match attribute {
            PanelAttribute::CollectiveAttribute(CollectiveAttribute::University) => {
                respondent.school = verified_attributes
                    .university
                    .clone()
                    .filter(|value| !value.is_empty());
            }
            PanelAttribute::CollectiveAttribute(CollectiveAttribute::Age) => {
                respondent.age = verified_attributes.age().map(age_to_respondent_age);
            }
            PanelAttribute::CollectiveAttribute(CollectiveAttribute::Gender) => {
                // Postgres migration: `VerifiedAttributes.gender` is the bare
                // snake_case string ("male" / "female") — parse it back the
                // same way serde would.
                respondent.gender = match verified_attributes.gender.as_deref() {
                    Some("male") => Some(crate::common::attribute::Gender::Male),
                    Some("female") => Some(crate::common::attribute::Gender::Female),
                    _ => None,
                };
            }
            PanelAttribute::VerifiableAttribute(VerifiableAttribute::Age(age)) => {
                respondent.age = Some(*age);
            }
            PanelAttribute::VerifiableAttribute(VerifiableAttribute::Gender(gender)) => {
                respondent.gender = Some(*gender);
            }
            _ => {}
        }
    }

    if respondent.is_empty() {
        None
    } else {
        Some(respondent)
    }
}

#[cfg(feature = "server")]
async fn get_respondent_from_panels(
    cli: &aws_sdk_dynamodb::Client,
    space_pk: &Partition,
    user_pk: &Partition,
) -> Result<Option<RespondentAttr>> {
    let verified_attributes = crate::common::models::did::VerifiedAttributes::get_by_user(user_pk)
        .await?
        .unwrap_or_default();
    let matched_attributes =
        crate::features::spaces::controllers::panel_requirements::matched_panel_attributes(
            cli,
            space_pk,
            &verified_attributes,
        )
        .await?;

    Ok(respondent_from_panel_attributes(
        &matched_attributes,
        &verified_attributes,
    ))
}

#[mcp_tool(
    name = "respond_poll",
    description = "Submit answers to a poll. Requires participant role and space in Ongoing status."
)]
#[post("/api/spaces/{space_pk}/polls/{poll_sk}/respond", role: SpaceUserRole, member: SpaceUser, space: SpaceCommon, user: crate::features::auth::User)]
pub async fn respond_poll(
    #[mcp(description = "Space partition key")] space_pk: SpacePartition,
    #[mcp(description = "Poll sort key (e.g. 'SpacePoll#<uuid>')")] poll_sk: SpacePollEntityType,
    #[mcp(
        description = "Poll answers. Each answer: {\"answer_type\": \"single_choice\", \"answer\": <index>} or {\"answer_type\": \"multiple_choice\", \"answer\": [<indices>]}"
    )]
    req: RespondPollRequest,
) -> Result<RespondPollResponse> {
    let common_config = crate::common::CommonConfig::default();
    let cli = common_config.dynamodb();
    let space_partition = space_pk.clone();
    let space_id = space_pk.clone();
    let space_pk: Partition = space_pk.into();
    let poll_sk_entity: EntityType = poll_sk.clone().into();

    let poll = SpacePoll::get_one(&space_id, &poll_sk)
        .await?
        .ok_or(Error::NotFound("Poll not found".into()))?;

    let space_action = SpaceAction::get_one(&space_id, &poll_sk.0)
        .await?
        .ok_or(Error::SpaceActionNotFound)?;

    let deps_met = crate::features::spaces::pages::actions::services::dependency::dependencies_met(
        &space,
        &space_action,
        &member.pk,
    )
    .await?;

    if !crate::features::spaces::pages::actions::can_execute_space_action(
        role,
        space_action.prerequisite,
        space.status,
        space_action.status.as_ref(),
        deps_met,
        space.join_anytime,
    ) {
        return Err(SpacePollError::PollNotInProgress.into());
    }

    if !validate_answers(poll.questions.0.clone(), req.answers.clone()) {
        return Err(SpacePollError::AnswerMismatch.into());
    }

    let existing =
        SpacePollUserAnswer::find_one(&space_pk, &poll_sk_entity, &member.pk).await?;

    if existing.is_some() && !poll.response_editable {
        return Err(SpacePollError::EditNotAllowed.into());
    }

    if poll.canister_upload_enabled {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        use crate::features::spaces::pages::actions::services::vote_crypto::VOTE_CRYPTO_SERVICE;
        let crypto = VOTE_CRYPTO_SERVICE
            .as_ref()
            .ok_or(SpacePollError::VoteVerificationFailed)?;

        let (ciphertext_json, voter_tag) = match (&req.client_ciphertext_json, &req.client_voter_tag) {
            (Some(ct), Some(tag)) => {
                let expected_tag = crypto.build_voter_tag(&poll_sk_entity, &member.pk)?;
                if expected_tag != *tag {
                    crate::error!(
                        "client voter_tag mismatch: expected {expected_tag}, got {tag}"
                    );
                    return Err(SpacePollError::VoteVerificationFailed.into());
                }
                (ct.clone(), tag.clone())
            }
            _ => {
                let metadata = PollMetadata {
                    poll_sk: poll_sk_entity.to_string(),
                    submitted_at_ms: now,
                };
                let envelope =
                    crypto.encrypt(&poll_sk_entity, &member.pk, &req.answers, Some(&metadata))?;
                (envelope.ciphertext_json, envelope.voter_tag)
            }
        };

        use sha2::Digest;
        let ciphertext_hash = hex::encode(sha2::Sha256::digest(ciphertext_json.as_bytes()));

        let selections: Vec<ratel_canister::types::QuestionSelection> = req
            .answers
            .iter()
            .enumerate()
            .flat_map(|(q_idx, answer)| {
                answer.to_option_indices().into_iter().map(move |opt_idx| {
                    ratel_canister::types::QuestionSelection {
                        question_index: q_idx as u32,
                        option_index: opt_idx,
                    }
                })
            })
            .collect();
        let ballot = ratel_canister::types::VoteBallot {
            ciphertext_hash,
            ciphertext_blob: ciphertext_json.into_bytes(),
            submitted_at_ms: now,
            selections,
        };
        let canister = common_config.canister();
        canister
            .upsert_vote(&poll_sk_entity.to_string(), &voter_tag, ballot)
            .await?;
    }

    // Postgres record (was DynamoDB)
    if let Some(mut existing_answer) = existing {
        let now = crate::common::utils::time::get_now_timestamp_millis();
        existing_answer.answers = PollUserAnswers(req.answers);
        existing_answer.created_at = now;
        existing_answer.save().await?;
    } else {
        let respondent = get_respondent_from_panels(cli, &space_pk, &member.pk).await?;
        let answer_record = SpacePollUserAnswer::new(
            space_pk.clone(),
            poll_sk_entity.clone(),
            req.answers,
            respondent,
            member.clone(),
        );
        answer_record.save().await?;
        // Phase 5: emit so the outbox poller dispatches "PollXpRecord"
        // (handle_poll_xp) — the Postgres analogue of the old EventBridge path.
        crate::common::events::outbox::EventOutbox::emit_insert(
            crate::common::events::outbox::topic::POLL_USER_ANSWER,
            &answer_record,
        )
        .await
        .ok();

        SpacePoll::bump_response_count(poll.id, 1).await?;

        let _ = crate::features::spaces::space_common::models::aggregate::DashboardAggregate::inc_poll_responses(
            &space_pk, 1,
        )
        .await;

        // Reward payout + XP recording run on EventBridge via SPACE_POLL_USER_ANSWER#
        // INSERT → handle_poll_xp. See features/activity/services/handle_xp_event.rs.
    }

    crate::features::spaces::space_common::services::bump_participant_activity(
        cli, &space_pk, &member.pk,
    )
    .await;

    Ok(RespondPollResponse {})
}
