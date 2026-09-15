import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverErrorText } from "@/components/auth/interop";
import { usePopup } from "@/lib/popup";
import { useTeamContext, type TeamCreationPayload } from "@/lib/teams";
import { TeamCreationForm } from "./team-creation-form";

// app/ratel/src/components/team_creation_popup/mod.rs (`TeamCreationPopup`) —
// the plain popup variant, opened from `ProfileDropdown`: `TeamContext::create_team`,
// select the new team, close the popup and go to `/{username}`.

export function TeamCreationPopup() {
  const popup = usePopup();
  const teamCtx = useTeamContext();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (payload: TeamCreationPayload) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const team = await teamCtx.createTeam(payload);
      teamCtx.selectTeam(team.pk);
      popup.close();
      navigate(`/${team.username}`);
    } catch (e) {
      setErrorMsg(serverErrorText(e));
    }
    setSubmitting(false);
  };

  return (
    <TeamCreationForm
      submitting={submitting}
      errorMessage={errorMsg}
      onCancel={() => popup.close()}
      onSubmit={(payload) => void onSubmit(payload)}
    />
  );
}
