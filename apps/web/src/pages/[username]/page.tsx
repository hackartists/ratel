import { useWallContext } from "@/components/social/wall-context";
import { TeamHome } from "./components/team-home/team-home";
import { UserHome } from "./components/user-home/user-home";

// app/ratel/src/features/social/pages/index/mod.rs (`SocialIndex`, `/:username`):
// the user wall home or the team home, by wall kind.
export function Component() {
  const ctx = useWallContext();
  return (
    <>
      {ctx.isUser ? <UserHome username={ctx.username} /> : ctx.isTeam ? <TeamHome username={ctx.username} /> : null}
    </>
  );
}
