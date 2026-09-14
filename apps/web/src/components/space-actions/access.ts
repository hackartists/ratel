import type { SpaceActionStatus, SpaceStatus, SpaceUserRole } from "@ratel/ts-bridges";

// app/ratel/src/features/spaces/pages/actions/mod.rs — action lock and
// execution rules shared by every action page.

/** `is_action_locked`: the space has ended, or the action is running/finished. */
export function isActionLocked(
  spaceStatus: SpaceStatus | null | undefined,
  actionStatus: SpaceActionStatus | null | undefined,
): boolean {
  if (spaceStatus === "Processing" || spaceStatus === "Finished") return true;
  return actionStatus === "Ongoing" || actionStatus === "Finish";
}

/** `can_execute_space_action`. */
export function canExecuteSpaceAction(
  role: SpaceUserRole,
  prerequisite: boolean,
  spaceStatus: SpaceStatus | null | undefined,
  actionStatus: SpaceActionStatus | null | undefined,
  dependenciesMet: boolean,
  joinAnytime: boolean,
): boolean {
  let roleOk: boolean;
  switch (role) {
    case "Creator":
      roleOk = true;
      break;
    case "Candidate":
      roleOk = prerequisite;
      break;
    case "Participant":
      roleOk = !prerequisite;
      break;
    case "Viewer":
      roleOk = false;
      break;
  }

  let statusOk: boolean;
  switch (role) {
    case "Creator":
      statusOk = !(spaceStatus === "Processing" || spaceStatus === "Finished");
      break;
    case "Candidate": {
      const spaceOk = spaceStatus === "Open" || (joinAnytime && spaceStatus === "Ongoing");
      // Candidates only reach prerequisite actions (enforced by roleOk), and
      // those must be runnable regardless of the action's Designing/Ongoing
      // state — completing them is what clears Candidate → Participant.
      statusOk = spaceOk && (prerequisite || actionStatus === "Ongoing");
      break;
    }
    case "Participant":
      statusOk = spaceStatus === "Ongoing" && actionStatus === "Ongoing";
      break;
    case "Viewer":
      statusOk = false;
      break;
  }

  return roleOk && statusOk && dependenciesMet;
}
