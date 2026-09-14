import { useParams } from "react-router-dom";
import { useActionSpaceRole } from "@/components/space-actions/space-data";
import { CreatorActionPage } from "./components/creator-action-page";
import { ParticipantActionPage } from "./components/participant-action-page";
import { ViewerActionPage } from "./components/viewer-action-page";

// app/ratel/src/features/spaces/pages/actions/views/main/mod.rs
// (`SpaceActionsPage`, `/spaces/:spaceId/actions`): dispatches on the viewer's
// current space role.
export function Component() {
  const { spaceId = "" } = useParams();
  const { currentRole } = useActionSpaceRole(spaceId); // space-context: use_space_role()

  switch (currentRole) {
    case "Creator":
      return <CreatorActionPage spaceId={spaceId} />;
    case "Participant":
      return <ParticipantActionPage spaceId={spaceId} />;
    case "Candidate":
    case "Viewer":
      return <ViewerActionPage spaceId={spaceId} />;
  }
}
