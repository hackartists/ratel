import { useRouteUsername, useWallContext } from "@/components/social/use-wall-context";
import { TeamSettingsHome } from "./components/team-settings";
import { UserSettingsHome } from "./components/user-settings";

// app/ratel/src/features/social/pages/setting/mod.rs (`SocialSetting`,
// `/:username/settings`): the user or the team settings, by the wall type.
export function Component() {
  const username = useRouteUsername();
  // wall-context: `use_wall_context()` — provided by SocialLayout in Rust.
  const wall = useWallContext(username);

  if (wall.isUser) return <UserSettingsHome />;
  if (wall.isTeam) return <TeamSettingsHome username={username} />;
  return null;
}
