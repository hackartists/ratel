import { useWallContext } from "@/components/social/wall-context";
import { TeamDrafts } from "./components/team-drafts";
import { UserDrafts } from "./components/user-drafts";

// app/ratel/src/features/social/pages/draft/mod.rs (`SocialDraft`, `/:username/drafts`):
// the user drafts arena or the team drafts page, by wall kind.
export function Component() {
  const ctx = useWallContext();
  return <>{ctx.isUser ? <UserDrafts /> : ctx.isTeam ? <TeamDrafts username={ctx.username} /> : null}</>;
}
