import { useWallContext } from "@/components/social/wall-context";
import { TeamMembership } from "./components/team-membership";
import { UserMembership } from "./components/user-membership";

// app/ratel/src/features/social/pages/membership/mod.rs (`SocialMembership`,
// `/:username/memberships`) — dispatches to the user or team membership view.
// `SocialLayout` provides the wall context.
export function Component() {
  const { username, isUser, isTeam } = useWallContext();

  if (isUser) return <UserMembership />;
  if (isTeam) return <TeamMembership username={username} />;
  return null;
}
