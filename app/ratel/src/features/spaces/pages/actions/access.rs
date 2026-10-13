use crate::common::*;
use crate::features::spaces::pages::actions::types::SpaceActionStatus;

pub fn is_action_locked(
    space_status: Option<SpaceStatus>,
    action_status: Option<&SpaceActionStatus>,
) -> bool {
    if matches!(
        space_status,
        Some(SpaceStatus::Processing | SpaceStatus::Finished)
    ) {
        return true;
    }
    matches!(
        action_status,
        Some(SpaceActionStatus::Ongoing | SpaceActionStatus::Finish)
    )
}

/// Whether `role` may run an action right now.
///
/// `participation_open` must be `SpaceCommon::is_participation_open()` for
/// the space; it decides whether Candidates may still run prerequisite
/// actions (Open, Sampling with recruiting allowed, or Ongoing with
/// `join_anytime`).
///
/// Creators (space admins) bypass `dependencies_met`,
/// `required_attributes_met` and the action's own status; they are only
/// blocked once the space itself is Processing or Finished.
pub fn can_execute_space_action(
    role: SpaceUserRole,
    prerequisite: bool,
    space_status: Option<SpaceStatus>,
    action_status: Option<&SpaceActionStatus>,
    dependencies_met: bool,
    required_attributes_met: bool,
    participation_open: bool,
) -> bool {
    let role_ok = match role {
        SpaceUserRole::Creator => true,
        SpaceUserRole::Candidate => prerequisite,
        SpaceUserRole::Participant => !prerequisite,
        SpaceUserRole::Viewer => false,
    };

    let status_ok = match role {
        SpaceUserRole::Creator => !matches!(
            space_status,
            Some(SpaceStatus::Processing | SpaceStatus::Finished)
        ),
        SpaceUserRole::Candidate => {
            // Candidates only reach prerequisite actions (enforced by role_ok),
            // and those must be runnable regardless of the action's Designing/
            // Ongoing state — completing them is what clears Candidate → Participant.
            participation_open && (prerequisite || matches!(action_status, Some(SpaceActionStatus::Ongoing)))
        }
        SpaceUserRole::Participant => {
            matches!(space_status, Some(SpaceStatus::Ongoing))
                && matches!(action_status, Some(SpaceActionStatus::Ongoing))
        }
        SpaceUserRole::Viewer => false,
    };

    if matches!(role, SpaceUserRole::Creator) {
        return role_ok && status_ok;
    }

    role_ok && status_ok && dependencies_met && required_attributes_met
}

#[cfg(test)]
mod tests {
    use super::*;

    fn candidate(status: SpaceStatus, participation_open: bool) -> bool {
        can_execute_space_action(
            SpaceUserRole::Candidate,
            true,
            Some(status),
            Some(&SpaceActionStatus::Designing),
            true,
            true,
            participation_open,
        )
    }

    #[test]
    fn candidate_runs_prerequisite_while_sampling_recruits() {
        assert!(candidate(SpaceStatus::Sampling, true));
    }

    #[test]
    fn candidate_blocked_when_sampling_does_not_recruit() {
        assert!(!candidate(SpaceStatus::Sampling, false));
    }

    #[test]
    fn participant_cannot_act_during_sampling() {
        assert!(!can_execute_space_action(
            SpaceUserRole::Participant,
            false,
            Some(SpaceStatus::Sampling),
            Some(&SpaceActionStatus::Ongoing),
            true,
            true,
            false,
        ));
    }

    fn creator(
        space_status: SpaceStatus,
        action_status: Option<&SpaceActionStatus>,
        dependencies_met: bool,
        required_attributes_met: bool,
    ) -> bool {
        can_execute_space_action(
            SpaceUserRole::Creator,
            false,
            Some(space_status),
            action_status,
            dependencies_met,
            required_attributes_met,
            false,
        )
    }

    #[test]
    fn creator_bypasses_unmet_dependencies() {
        assert!(creator(
            SpaceStatus::Ongoing,
            Some(&SpaceActionStatus::Ongoing),
            false,
            true,
        ));
    }

    #[test]
    fn creator_bypasses_unmet_required_attributes() {
        assert!(creator(
            SpaceStatus::Ongoing,
            Some(&SpaceActionStatus::Ongoing),
            true,
            false,
        ));
    }

    #[test]
    fn creator_runs_designing_action() {
        assert!(creator(
            SpaceStatus::Ongoing,
            Some(&SpaceActionStatus::Designing),
            false,
            false,
        ));
        assert!(creator(SpaceStatus::Designing, None, false, false));
    }

    #[test]
    fn creator_blocked_once_space_is_processing_or_finished() {
        assert!(!creator(
            SpaceStatus::Processing,
            Some(&SpaceActionStatus::Ongoing),
            true,
            true,
        ));
        assert!(!creator(
            SpaceStatus::Finished,
            Some(&SpaceActionStatus::Ongoing),
            true,
            true,
        ));
    }

    #[test]
    fn participant_still_blocked_by_unmet_dependencies() {
        assert!(!can_execute_space_action(
            SpaceUserRole::Participant,
            false,
            Some(SpaceStatus::Ongoing),
            Some(&SpaceActionStatus::Ongoing),
            false,
            true,
            false,
        ));
    }
}
