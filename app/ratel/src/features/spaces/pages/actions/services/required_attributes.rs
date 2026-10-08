#[cfg(feature = "server")]
use crate::features::spaces::pages::actions::*;

/// Checks the action's Required Attributes gate — a set of rules independent
/// of (and AND-combined with) `depends_on`. Each rule references a Poll
/// action's single-choice question by index and a list of allowed answer
/// values; the rule is satisfied when the user's recorded answer to that
/// question matches one of the allowed values (OR within a rule). A
/// participant who never answered the referenced poll fails the rule.
#[cfg(feature = "server")]
pub async fn required_attributes_met(
    space: &crate::common::models::space::SpaceCommon,
    action: &crate::features::spaces::pages::actions::models::SpaceAction,
    user_pk: &Partition,
) -> crate::common::Result<bool> {
    use crate::SpacePollEntityType;
    use crate::features::spaces::pages::actions::actions::poll::{
        Answer, SpacePoll, SpacePollUserAnswer,
    };

    if action.required_attributes.is_empty() {
        return Ok(true);
    }

    let space_id: SpacePartition = match space.partition() {
        Partition::Space(id) => SpacePartition(id),
        _ => return Ok(false),
    };

    for rule in action.required_attributes.0.iter() {
        let poll_id = SpacePollEntityType(rule.poll_action_id.clone());

        let poll = match SpacePoll::get_one(&space_id, &poll_id).await? {
            Some(p) => p,
            None => return Ok(false),
        };

        let space_pk: Partition = space_id.clone().into();
        let poll_sk: EntityType = poll_id.clone().into();
        let answer = match SpacePollUserAnswer::find_one(&space_pk, &poll_sk, user_pk).await? {
            Some(a) => a,
            None => return Ok(false),
        };

        let answered_index = match answer.answers.0.get(rule.question_index) {
            Some(Answer::SingleChoice {
                answer: Some(idx), ..
            }) => *idx,
            _ => return Ok(false),
        };

        let answered_value = match poll.questions.0.get(rule.question_index) {
            Some(
                crate::features::spaces::pages::actions::actions::poll::Question::SingleChoice(q),
            ) => match q.options.get(answered_index as usize) {
                Some(v) => v.clone(),
                None => return Ok(false),
            },
            _ => return Ok(false),
        };

        if !rule.allowed_values.iter().any(|v| v == &answered_value) {
            return Ok(false);
        }
    }

    Ok(true)
}
