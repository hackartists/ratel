import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateTeam } from "@ratel/ts-bridges/hooks";
import { useTeamContext } from "@/components/social/use-team-context";
import { TeamCreationForm, type TeamCreationPayload } from "@/components/teams/team-creation-form";
import { usePopup } from "@/lib/popup";
import { serverErrorText } from "@/components/auth/interop";
import { TEAM_ROLE_ADMIN_PERMISSIONS } from "./team-role";

// app/ratel/src/features/social/pages/team_arena/create_team_popup/component.rs
// (`ArenaTeamCreationPopup`): the arena-styled wrapper around `TeamCreationForm`.
// Create → add to the user's teams → close → the new team's home.
export function ArenaTeamCreationPopup() {
  const popup = usePopup();
  const teamCtx = useTeamContext();
  const navigate = useNavigate();
  const createTeam = useCreateTeam();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async ({ profile_url, username, nickname, description }: TeamCreationPayload) => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const response = await createTeam.mutateAsync({ username, nickname, profile_url, description });
      teamCtx.addTeam({
        pk: response.team_pk,
        nickname,
        username,
        profile_url,
        user_type: 2, // UserType::Team
        permissions: TEAM_ROLE_ADMIN_PERMISSIONS,
        description,
        created_at: response.created_at,
        member_count: 1,
      });
      popup.close();
      navigate(`/${username}`);
    } catch (e) {
      setErrorMsg(serverErrorText(e));
    }
    setSubmitting(false);
  };

  return (
    <div className="arena-create-team" data-testid="arena-create-team-popup">
      <div className="arena-create-team__header">
        {/* Rust hardcodes these strings (create_team_popup/component.rs:909,932-936). */}
        <button className="arena-create-team__close" type="button" aria-label="Close" onClick={() => popup.close()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="arena-create-team__label">New Squad</span>
        <span className="arena-create-team__title">Create Team</span>
        <p className="arena-create-team__subhead">Spin up a new team and invite collaborators to the arena.</p>
      </div>

      <div className="arena-create-team__body">
        <TeamCreationForm
          submitting={submitting}
          errorMessage={errorMsg}
          onCancel={() => popup.close()}
          onSubmit={(payload) => void onSubmit(payload)}
        />
      </div>
    </div>
  );
}
