import { useParams } from "react-router-dom";
import { AdminPage } from "./components/admin-page";
import { ViewerPage } from "./components/viewer-page";
import { isTeamOwner, useTeamDao } from "./hooks/use-team-dao";

// app/ratel/src/features/social/pages/dao/views/mod.rs (`Home`, route
// `TeamDao` = `/:username/dao`). The team owner gets the admin page; everyone
// else — and a failed load — gets the viewer notice. The page reads neither
// `use_wall_context()` nor `use_team_arena()`.
export function Component() {
  const username = useParams().username ?? "";
  const context = useTeamDao(username);

  if (context !== null && isTeamOwner(context.role)) {
    // `key`: a different team starts from its own `team_state`.
    return <AdminPage key={username} username={username} context={context} />;
  }
  return <ViewerPage username={username} />;
}
