import { createElement } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Clock, FileText, Plus, Star } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { useFindTeam, useListTeamBylaws } from "@ratel/ts-bridges/hooks";
import { BylawCard } from "./components/bylaw-card";

const CATEGORY_BYLAWS = "Bylaws";

// app/ratel/src/features/sub_team/pages/bylaws/component.rs (`TeamBylawsPage`,
// `/:username/bylaws`) — public bylaws reader. Source is the PARENT team's
// bylaws when `:username` is a recognized sub-team, otherwise the team's own.
export function Component() {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const { username = "" } = useParams<{ username: string }>();

  // This route is declared OUTSIDE SocialLayout in both apps (route.rs:217,
  // route-tree.ts) — no shared wall/team context is mounted here, so Rust
  // also loads the team locally via `find_team_handler`.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;
  const teamData = teamQuery.data;

  const teamDisplay = teamData.nickname || teamData.username;
  const teamHandle = teamData.username;
  const teamInitials = teamDisplay.slice(0, 3).toUpperCase();
  const hasParent = !!teamData.parent_team_id && teamData.parent_team_id !== "";
  const isAdmin = teamData.role === "owner" || teamData.role === "admin";

  // `parent_team_id` is stored bare (Team.id, no "TEAM#" prefix) — only
  // `pk` (the raw partition key) needs the prefix stripped.
  const bylawsOwnerTeamId =
    hasParent && teamData.parent_username ? teamData.parent_team_id ?? "" : teamData.pk.replace(/^TEAM#/, "");

  const canAddBylaw = isAdmin && !hasParent;

  return (
    <>
      <SeoMeta title={t.bylawsTitle} />
      <BylawsBody
        username={username}
        teamDisplay={teamDisplay}
        teamHandle={teamHandle}
        teamInitials={teamInitials}
        bylawsOwnerTeamId={bylawsOwnerTeamId}
        canAddBylaw={canAddBylaw}
        onBack={() => navigate(-1)}
      />
    </>
  );
}

function BylawsBody({
  username,
  teamDisplay,
  teamHandle,
  teamInitials,
  bylawsOwnerTeamId,
  canAddBylaw,
  onBack,
}: {
  username: string;
  teamDisplay: string;
  teamHandle: string;
  teamInitials: string;
  bylawsOwnerTeamId: string;
  canAddBylaw: boolean;
  onBack: () => void;
}) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const bylawsQuery = useListTeamBylaws(bylawsOwnerTeamId, CATEGORY_BYLAWS);
  if (bylawsQuery.data === undefined) return null;

  const bylawsDocs = bylawsQuery.data.items;
  const bylawsCount = bylawsDocs.length;
  const bylawsCountLabel = t.bylawsSectionCountItems({ n: bylawsCount });

  return (
    <div className="sub-team-bylaws">
      <div className="arena-topbar">
        <div className="arena-topbar__brand">
          <div className="brand-home" aria-label="Back" onClick={onBack}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <span className="brand-home__divider" />
          <div className="arena-topbar__logo arena-topbar__logo--child">{teamInitials}</div>
          <div className="u-col">
            <span className="arena-topbar__title">{teamDisplay}</span>
            <span className="arena-topbar__handle">@{teamHandle}</span>
          </div>
          <span className="arena-topbar__status arena-topbar__status--active">{t.bylawsStatusChip}</span>
        </div>
        <div className="arena-topbar__actions">
          <button className="hud-btn" aria-label="History">
            <Clock className="w-3 h-3 [&>circle]:stroke-current [&>polyline]:stroke-current" />
          </button>
        </div>
      </div>

      <div className="page page--wide">
        <div className="page-header">
          <div className="page-header__main">
            <span className="page-header__eyebrow">
              <FileText className="w-3 h-3 [&>path]:stroke-current" />
              {t.bylawsPageEyebrowFr}
            </span>
            <h1 className="page-header__title">
              <strong>{t.bylawsPageTitleStrong}</strong>
              {t.bylawsPageTitleRest}
            </h1>
            <p className="page-header__sub">{t.bylawsPageSub}</p>
          </div>
        </div>

        <section className="bylaws-section">
          <div className="group-header">
            <div className="group-header__icon group-header__icon--parent">
              <Star className="w-4 h-4 [&>path]:stroke-current" />
            </div>
            <h2 className="group-header__title">{t.bylawsSectionTeamRegulations}</h2>
            <span className="group-header__count">{bylawsCountLabel}</span>
          </div>
          <div className="bylaws-grid">
            {bylawsDocs.map((doc, i) => (
              <BylawCard key={doc.id} index={i} doc={doc} parent={true} />
            ))}
            {canAddBylaw && (
              <div
                className="bylaw-add"
                data-role="parent"
                data-testid="sub-team-bylaws-add-bylaw"
                onClick={() => navigate(`/${username}/bylaws/compose/${CATEGORY_BYLAWS}`)}
              >
                <Plus className="w-5 h-5 [&>path]:stroke-current" />
                {t.bylawsAddTeam}
              </div>
            )}
          </div>
          {bylawsDocs.length === 0 && !canAddBylaw && (
            <div className="">
              {t.bylawsEmpty}
              {/* Ported verbatim from Rust's `empty-state {}` — an undeclared custom
                  element, seemingly dead/placeholder code in the source page. Using
                  `createElement` since `<empty-state>` isn't a known JSX intrinsic. */}
              {createElement("empty-state")}
              {","}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
