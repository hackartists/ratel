// app/ratel/src/features/spaces/pages/index/action_pages/discussion/component.rs
// (`SpaceDiscussionCommentPage`) — deep-link variant: `commentId` drives the
// scroll-to + sheet-expand effect in `DiscussionArenaPage`. A path param
// (not query/fragment) because the SPA route table strips both on some
// client transitions, same reasoning as the Dioxus original.
import { useParams } from "react-router-dom";
import { DiscussionArenaPage } from "@/components/space/discussion-arena/discussion-arena";

export function Component() {
  const { spaceId = "", discussionId = "", commentId = "" } = useParams();
  return <DiscussionArenaPage spaceId={spaceId} discussionId={discussionId} targetCommentId={commentId} />;
}
