import { useParams } from "react-router-dom";
import {
  ActionEditModeContext,
  SettingsSwitchButton,
  useActionEditModeState,
} from "@/components/space-actions/settings-switch-button";
import { useActionSpace, useActionSpaceRole } from "@/components/space-actions/space-data";
import { isActionLocked } from "@/components/space-actions/access";
import { PollCreatorPage } from "./components/poll-creator-page";
import { PollResponseView } from "./components/poll-response-view";
import { PollProvider, usePollProvider } from "./hooks/use-poll";

// app/ratel/src/features/spaces/pages/actions/actions/poll/views/main/mod.rs
// (`PollActionPage`): creators configure the action until it starts (or with
// edit mode on) or as an admin; participants/candidates get the gamified
// response flow (overview + encrypted-vote UI); everyone else (and the
// creator once locked) gets the plain response/results view.
export function Component() {
  const { spaceId = "", pollId = "" } = useParams();
  const controller = usePollProvider(spaceId, pollId);
  const { currentRole, isAdmin } = useActionSpaceRole(spaceId); // space-context: use_space_role() / space_ctx.role()
  const space = useActionSpace(spaceId); // space-context: use_space()
  const locked = isActionLocked(space.status, controller.poll.space_action.status);

  const editMode = useActionEditModeState(isAdmin);
  const showCreatorView = isAdmin || !locked || editMode.editMode;

  let content;
  if ((currentRole === "Creator" && showCreatorView) || isAdmin) {
    content = <PollCreatorPage />;
  } else if (currentRole === "Creator") {
    content = <PollResponseView canRespond variant="content" />;
  } else if (currentRole === "Participant" || currentRole === "Candidate") {
    content = <PollResponseView canRespond variant="read" />;
  } else {
    // PollViewerPage wraps PollContent in an extra div (viewer/mod.rs).
    content = (
      <div className="flex flex-col w-full">
        <PollResponseView canRespond={false} variant="content" />
      </div>
    );
  }

  return (
    <PollProvider value={controller}>
      <ActionEditModeContext.Provider value={editMode}>
        <div className={showCreatorView ? "flex flex-col flex-1 w-full min-h-0" : "flex flex-col flex-1 w-full h-full min-h-0"}>
          {!showCreatorView && <SettingsSwitchButton spaceId={spaceId} />}
          {content}
        </div>
      </ActionEditModeContext.Provider>
    </PollProvider>
  );
}
