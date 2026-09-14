import { useParams } from "react-router-dom";
import { BroadcastComposer } from "@/components/sub-team-composer";

// Dioxus `TeamSubTeamBroadcastComposePage` (app/ratel/src/features/sub_team/pages/broadcast_compose/component.rs).
export function Component() {
  const { username } = useParams<{ username: string }>();
  return <BroadcastComposer username={username ?? ""} />;
}
