// app/ratel/src/features/spaces/pages/actions/access.rs — who may run a space action.
import type { SpaceActionStatus, SpaceStatus, SpaceUserRole } from "@ratel/ts-bridges";

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
  joinAnytime: boolean,
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
      const spaceOk = spaceStatus === "Open" || (joinAnytime && spaceStatus === "Ongoing");
      statusOk = spaceOk && (prerequisite || actionStatus === "Ongoing");
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
