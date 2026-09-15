import { useParams } from "react-router-dom";
import { DocComposer } from "@/components/sub-team-composer";

// Dioxus `TeamSubTeamBylawsComposePage` (app/ratel/src/features/sub_team/pages/doc_compose/component.rs).
export function Component() {
  const { username, category } = useParams<{ username: string; category: string }>();
  return <DocComposer username={username ?? ""} category={category} />;
}
