import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { serverErrorText } from "@/components/auth/interop";
import { usePopup } from "@/lib/popup";
import { TEAM_ROLE_ADMIN_PERMISSIONS, USER_TYPE_TEAM, useTeamContext, type TeamCreationPayload } from "@/lib/teams";
import { useCreateTeam } from "@ratel/ts-bridges/hooks";
import { TeamCreationForm } from "./team-creation-form";

// app/ratel/src/features/social/pages/team_arena/create_team_popup/component.rs
// (`ArenaTeamCreationPopup`) — the arena-styled glass panel around
// `TeamCreationForm`, opened from the home Teams dropdown and the team arena
// topbar with `popup.open(..).without_close().with_backdrop_close()`, i.e.
// `popup.open(<ArenaTeamCreationPopup />, { closable: false, backdropClosable: true })`.
//
// On success the team is added to the team context (Admin permissions, the
// server's `created_at`), selected, and the app navigates to `/{username}`.

// Rust hardcodes these outside `translate!` (component.rs:28, 50-53).
const CLOSE_LABEL = "Close";
const LABEL = "New Squad";
const TITLE = "Create Team";
const SUBHEAD = "Spin up a new team and invite collaborators to the arena.";

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
        user_type: USER_TYPE_TEAM,
        permissions: TEAM_ROLE_ADMIN_PERMISSIONS,
        description,
        created_at: response.created_at,
        member_count: 1,
      });
      teamCtx.selectTeam(response.team_pk);
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
        <button className="arena-create-team__close" type="button" aria-label={CLOSE_LABEL} onClick={() => popup.close()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="arena-create-team__label">{LABEL}</span>
        <span className="arena-create-team__title">{TITLE}</span>
        <p className="arena-create-team__subhead">{SUBHEAD}</p>
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
