// app/ratel/src/features/spaces/pages/index/action_pages/discussion/component.rs
// (`SpaceDiscussionPage`) — the standalone discussion route (no arena
// overlay provider; `DiscussionArenaPage` falls back to route navigation
// for "Back", see `useOptionalActionOverlay()` there).
import { useParams } from "react-router-dom";
import { DiscussionArenaPage } from "@/components/space/discussion-arena/discussion-arena";

export function Component() {
  const { spaceId = "", discussionId = "" } = useParams();
  return <DiscussionArenaPage spaceId={spaceId} discussionId={discussionId} />;
}
