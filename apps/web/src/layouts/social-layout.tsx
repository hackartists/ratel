import { useParams } from "react-router-dom";
import { TeamArenaLayout } from "@/components/social/team-arena/team-arena-layout";
import { UserLayout } from "@/components/social/user-layout/user-layout";
import { WallProvider, useWallContext } from "@/components/social/wall-context";

// app/ratel/src/features/social/layout.rs (`SocialLayout`): resolves the
// `:username` wall (`get_wall_by_username`), then renders the user layout
// (sidebar + scroll area) or the team arena layout around the page outlet.
// Every page below reads the wall with `useWallContext()`; team pages also get
// `useTeamArena()`.
//
// Keyed by username: the Rust layout keeps the first wall's context when the
// router swaps `:username` in place (see the FIXME in
// features/sub_team/components/parent_hud_panel/component.rs:167-177); a
// remount resolves the new wall instead.
export function Component() {
  const { username = "" } = useParams<{ username: string }>();
  return (
    <WallProvider key={username} username={username}>
      <SocialLayoutBody />
    </WallProvider>
  );
}

function SocialLayoutBody() {
  const ctx = useWallContext();
  return <>{ctx.isUser ? <UserLayout username={ctx.username} /> : ctx.isTeam ? <TeamArenaLayout /> : null}</>;
}
