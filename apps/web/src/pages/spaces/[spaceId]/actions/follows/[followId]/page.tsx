import { useSuspenseQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getFollow } from "@ratel/ts-bridges";
import { isActionLocked } from "@/components/space-actions/access";
import {
  ActionEditModeContext,
  SettingsSwitchButton,
  useActionEditModeState,
} from "@/components/space-actions/settings-switch-button";
import { isSpaceAdmin, useSpaceContext } from "@/components/space/space-context";
import { FollowCreatorPage } from "./components/follow-creator-page";
import { FollowViewerPage } from "./components/follow-viewer-page";

// app/ratel/src/features/spaces/pages/actions/actions/follow/views/main/mod.rs
// (`FollowActionPage`): creators configure the action until it starts (or with
// edit mode on); admins always get the configuration view; everyone else gets
// the viewer.
export function Component() {
  const { spaceId = "", followId = "" } = useParams();
  const { space, role: persistedRole, currentRole: role } = useSpaceContext();
  const isAdmin = isSpaceAdmin(persistedRole);
  const action = useSuspenseQuery({
    queryKey: ["getFollow", spaceId, followId],
    queryFn: () => getFollow(spaceId, followId),
  }).data;
  const locked = isActionLocked(space.status, action.status);

  const editMode = useActionEditModeState(isAdmin);
  const showCreatorView = isAdmin || !locked || editMode.editMode;

  const content =
    (role === "Creator" && showCreatorView) || isAdmin ? (
      <FollowCreatorPage spaceId={spaceId} followId={followId} />
    ) : (
      <FollowViewerPage spaceId={spaceId} followId={followId} />
    );

  return (
    <ActionEditModeContext.Provider value={editMode}>
      <div
        className={
          showCreatorView
            ? "flex flex-col flex-1 w-full min-h-0"
            : "flex flex-col flex-1 mx-auto w-full min-h-0 max-w-desktop"
        }
      >
        {!showCreatorView && <SettingsSwitchButton />}
        {content}
      </div>
    </ActionEditModeContext.Provider>
  );
}
