// app/ratel/src/features/spaces/pages/actions/access.rs — who may run a space action.
import type { SpaceActionStatus, SpaceResponse, SpaceStatus, SpaceUserRole } from "@ratel/ts-bridges";

/** Rust `is_action_locked`. */
export function isActionLocked(spaceStatus: SpaceStatus | null, actionStatus: SpaceActionStatus | null): boolean {
  if (spaceStatus === "Processing" || spaceStatus === "Finished") return true;
  return actionStatus === "Ongoing" || actionStatus === "Finish";
}

/** Rust `can_execute_space_action`. */
export function canExecuteSpaceAction(
  role: SpaceUserRole,
  prerequisite: boolean,
  spaceStatus: SpaceStatus | null,
  actionStatus: SpaceActionStatus | null,
  dependenciesMet: boolean,
  participationOpen: boolean,
): boolean {
  let roleOk: boolean;
  let statusOk: boolean;
  switch (role) {
    case "Creator":
      roleOk = true;
      statusOk = !(spaceStatus === "Processing" || spaceStatus === "Finished");
      break;
    case "Candidate": {
      roleOk = prerequisite;
      statusOk = participationOpen && (prerequisite || actionStatus === "Ongoing");
      break;
    }
    case "Participant":
      roleOk = !prerequisite;
      statusOk = spaceStatus === "Ongoing" && actionStatus === "Ongoing";
      break;
    default:
      roleOk = false;
      statusOk = false;
  }
  return roleOk && statusOk && dependenciesMet;
}

/**
 * Rust `SpaceCommon::is_participation_open`: whether new participants may
 * join and Candidates may still run prerequisite actions. `Open` always
 * recruits, `Sampling` only when the Sampling app allows recruiting during
 * sampling, `Ongoing` when late joining is on.
 */
export function isParticipationOpen(space: Pick<SpaceResponse, "status" | "join_anytime" | "sampling_recruit_open">): boolean {
  switch (space.status) {
    case "Open":
      return true;
    case "Sampling":
      return space.sampling_recruit_open;
    case "Ongoing":
      return space.join_anytime;
    default:
      return false;
  }
}
