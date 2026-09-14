import { useWallContext } from "@/components/social/wall-context";
import { TeamRewards } from "./components/team-rewards";
import { UserRewards } from "./components/user-rewards";

// app/ratel/src/features/social/pages/reward/mod.rs (`SocialReward`): the
// `/:username/rewards` route under SocialLayout, dispatching on the wall kind.
export function Component() {
  const { username, isUser, isTeam } = useWallContext();

  if (isUser) return <UserRewards username={username} />;
  if (isTeam) return <TeamRewards username={username} />;
  return null;
}
