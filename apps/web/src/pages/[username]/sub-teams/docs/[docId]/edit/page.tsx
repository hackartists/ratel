import { useParams } from "react-router-dom";
import { DocComposer } from "@/components/sub-team-composer";

// Dioxus `TeamSubTeamDocEditPage` (app/ratel/src/features/sub_team/pages/doc_compose/component.rs).
export function Component() {
  const { username, docId } = useParams<{ username: string; docId: string }>();
  return <DocComposer username={username ?? ""} docId={docId} />;
}
