import { useWallContext } from "@/components/social/wall-context";
import { TeamSettingsHome } from "./components/team-settings";
import { UserSettingsHome } from "./components/user-settings";

// app/ratel/src/features/social/pages/setting/mod.rs (`SocialSetting`,
// `/:username/settings`): the user or the team settings, by the wall type.
export function Component() {
  const { username, isUser, isTeam } = useWallContext();

  if (isUser) return <UserSettingsHome />;
  if (isTeam) return <TeamSettingsHome username={username} />;
  return null;
}
