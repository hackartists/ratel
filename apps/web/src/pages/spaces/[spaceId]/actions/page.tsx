import { useParams } from "react-router-dom";
import { useSpaceRole } from "@/components/space/space-context";
import { CreatorActionPage } from "./components/creator-action-page";
import { ParticipantActionPage } from "./components/participant-action-page";
import { ViewerActionPage } from "./components/viewer-action-page";

// app/ratel/src/features/spaces/pages/actions/views/main/mod.rs
// (`SpaceActionsPage`, `/spaces/:spaceId/actions`): dispatches on the viewer's
// current space role.
export function Component() {
  const { spaceId = "" } = useParams();
  const currentRole = useSpaceRole(); // shared SpaceContextProvider (space-layout)

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
