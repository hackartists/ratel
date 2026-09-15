import { useParams } from "react-router-dom";
import { useSpaceRole } from "@/components/space/space-context";
import { MeetEditorView } from "./components/meet-editor-view";
import { MeetViewerView } from "./components/meet-viewer-view";
import { MeetProvider, useMeetProvider } from "./hooks/use-meet";

// app/ratel/src/features/spaces/pages/actions/actions/meet/components/meet_page/component.rs
// (`MeetActionPage`): creators (current role) edit, everyone else views.
export function Component() {
  const { spaceId = "", meetId = "" } = useParams();
  const controller = useMeetProvider(spaceId, meetId);
  const currentRole = useSpaceRole();
  const isAdmin = currentRole === "Creator";

  return <MeetProvider value={controller}>{isAdmin ? <MeetEditorView /> : <MeetViewerView />}</MeetProvider>;
}
