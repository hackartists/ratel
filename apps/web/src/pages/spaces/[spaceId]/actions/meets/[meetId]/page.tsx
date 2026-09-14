import { useParams } from "react-router-dom";
import { useActionSpaceRole } from "@/components/space-actions/space-data";
import { MeetEditorView } from "./components/meet-editor-view";
import { MeetViewerView } from "./components/meet-viewer-view";
import { MeetProvider, useMeetProvider } from "./hooks/use-meet";

// app/ratel/src/features/spaces/pages/actions/actions/meet/components/meet_page/component.rs
// (`MeetActionPage`): creators (current role) edit, everyone else views.
export function Component() {
  const { spaceId = "", meetId = "" } = useParams();
  const controller = useMeetProvider(spaceId, meetId);
  const { currentRole } = useActionSpaceRole(spaceId); // space-context: use_space_role()
  const isAdmin = currentRole === "Creator";

  return <MeetProvider value={controller}>{isAdmin ? <MeetEditorView /> : <MeetViewerView />}</MeetProvider>;
}
