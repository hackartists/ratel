import { useNavigate } from "react-router-dom";
import type { SubTeamSummaryResponse } from "@ratel/ts-bridges";
import { ChevronRight, Info } from "@/components/icons/lucide";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";

// app/ratel/src/features/sub_team/pages/management/list_tab.rs (`ListTab`).
export function ListTab() {
  const tr = useSubTeamI18n();
  const { teams, username } = useSubTeamManagement();
  const items = teams.items;

  return (
    <section className="card">
      <div className="card__head">
        <h2 className="card__title">{tr.tabSubTeams}</h2>
        <span className="card__dash" />
        <span className="card__meta">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div className="inline-note">{tr.emptyList}</div>
      ) : (
        <div className="roster">
          {items.map((row) => (
            <SubTeamRow key={row.sub_team_id} row={row} username={username} />
          ))}
        </div>
      )}

      {teams.truncated && (
        <div className="inline-note">
          <Info className="w-3 h-3 [&>path]:stroke-current" />
          Showing first 50 sub-teams
        </div>
      )}
    </section>
  );
}

function SubTeamRow({ row, username }: { row: SubTeamSummaryResponse; username: string }) {
  const navigate = useNavigate();
  const initials = Array.from(row.display_name).slice(0, 2).join("").toUpperCase();

  return (
    <a
      className="roster-row"
      data-testid="sub-team-roster-row"
      onClick={() => {
        // Route::TeamSubTeamDetailPage
        navigate(`/${encodeURIComponent(username)}/sub-teams/${encodeURIComponent(row.sub_team_id)}`);
      }}
    >
      <div className="avatar avatar--teal">{initials}</div>
      <div className="roster-row__body">
        <span className="roster-row__name">{row.display_name}</span>
        <span className="roster-row__handle">{`@${row.username}`}</span>
      </div>
      <div className="roster-row__metrics">
        <span className="roster-row__metric">
          <strong>{row.member_count}</strong>
          {" members"}
        </span>
      </div>
      <span className="roster-row__chev">
        <ChevronRight className="w-4 h-4 [&>path]:stroke-current" />
      </span>
    </a>
  );
}
