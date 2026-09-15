import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, House, LogOut, X } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { useFindTeam } from "@ratel/ts-bridges/hooks";
import { useParentRelationship } from "./hooks/use-parent-relationship";

// app/ratel/src/features/sub_team/pages/leave_parent/component.rs
// (`TeamLeaveParentPage`, `/:username/parent/leave`). `:username` is the
// viewer's OWN team — leaving detaches it from its recognized parent.
export function Component() {
  const t = useSubTeamI18n();
  const { username = "" } = useParams<{ username: string }>();

  // This route is declared OUTSIDE SocialLayout in both apps (route.rs:213,
  // route-tree.ts) — no shared wall/team context is mounted here, so Rust
  // also loads the team locally via `find_team_handler`.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;

  const teamData = teamQuery.data;
  const ownDisplay = teamData.nickname || teamData.username;
  const teamId = teamData.pk.replace(/^TEAM#/, "");

  return (
    <>
      <SeoMeta title={t.leaveParentTitle} />
      <LeaveParentForm username={username} ownDisplay={ownDisplay} teamId={teamId} />
    </>
  );
}

function formatYmdUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function initialsOf(display: string): string {
  return display
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
}

function LeaveParentForm({ username, ownDisplay, teamId }: { username: string; ownDisplay: string; teamId: string }) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const parentRel = useParentRelationship(teamId);

  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (!parentRel.ready) return null;

  const rel = parentRel.relationship;
  const isRecognized = rel.status === "RecognizedSubTeam";
  const parentDisplay = rel.parent_team_display_name || rel.parent_team_id || "—";
  const parentUsername = rel.parent_team_username ?? "";
  const parentInitials = initialsOf(parentDisplay);
  const ownInitials = initialsOf(ownDisplay);
  const recognizedMeta = rel.recognized_at !== null && rel.recognized_at > 0 ? formatYmdUtc(rel.recognized_at) : null;
  const parentMetaLine =
    parentUsername !== "" && recognizedMeta !== null
      ? `@${parentUsername} · ${t.leaveParentTieRecognizedSince} ${recognizedMeta} ~`
      : parentUsername !== ""
        ? `@${parentUsername}`
        : recognizedMeta !== null
          ? `${t.leaveParentTieRecognizedSince} ${recognizedMeta} ~`
          : "";

  const ready = confirmed && isRecognized;

  return (
    <div className="sub-team-leave-parent">
      <div className="arena-topbar">
        <div className="arena-topbar__brand">
          <button className="brand-home" aria-label="Back" type="button" onClick={() => navigate(`/${username}`)}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </button>
          <button className="brand-home" aria-label="Home" type="button" onClick={() => navigate("/")}>
            <House className="w-4 h-4 [&>path]:stroke-current" />
          </button>
          <span className="brand-home__divider" />
          <div className="arena-topbar__logo arena-topbar__logo--child">{ownInitials}</div>
          <div className="u-col">
            <span className="arena-topbar__title arena-topbar__title--child">{ownDisplay}</span>
            <span className="arena-topbar__handle">{t.leaveParentPageEyebrow}</span>
          </div>
          <span className="arena-topbar__status arena-topbar__status--caution">{t.leaveParentStatusChip}</span>
        </div>
      </div>

      <div className="page page--narrow">
        <div className="page-header">
          <div className="page-header__main">
            <span className="page-header__eyebrow">
              <LogOut className="w-3 h-3 [&>path]:stroke-current" />
              {t.leaveParentEyebrowCode}
            </span>
            <h1 className="page-header__title page-header__title--child">
              {t.leaveParentHeaderTitlePrefix}
              <strong>{parentDisplay}</strong>
              {t.leaveParentHeaderTitleSuffix}
            </h1>
            <p className="page-header__sub">{t.leaveParentHeaderSub}</p>
          </div>
        </div>

        {!isRecognized && <div className="notice notice--warn">{t.leaveParentNotRecognized}</div>}

        <div className="current-tie">
          <div className="avatar avatar--teal avatar--lg">{ownInitials}</div>
          <div className="tie-line">
            <span className="tie-dot tie-dot--child" />
            <span className="tie-dash" />
            <span>{t.leaveParentTieChildOf}</span>
            <span className="tie-dash" />
            <span className="tie-dot" />
          </div>
          <div className="avatar avatar--lg">{parentInitials}</div>
          <div className="u-col tie-meta">
            <span className="tie-meta__name">{parentDisplay}</span>
            {parentMetaLine !== "" && <span className="tie-meta__sub">{parentMetaLine}</span>}
          </div>
          <span className="pill pill--approved">Active</span>
        </div>

        <div className="leave">
          <div className="leave__head">
            <div className="leave__icon">
              <LogOut className="w-5 h-5 [&>path]:stroke-current" />
            </div>
            <div>
              <h2 className="leave__title">{t.leaveParentTitle}</h2>
              <p className="leave__sub">{t.leaveParentPanelSub}</p>
            </div>
          </div>

          <div className="keep-list">
            <span className="keep-list__title">{t.leaveParentKeepTitle}</span>
            <div className="keep-list__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentKeepTeam}</span>
            </div>
            <div className="keep-list__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentKeepAnnouncements}</span>
            </div>
            <div className="keep-list__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentKeepAdmins}</span>
            </div>
          </div>

          <div className="lose-list">
            <span className="lose-list__title">{t.leaveParentLoseTitle}</span>
            <div className="lose-list__item">
              <X className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentLoseBroadcasts}</span>
            </div>
            <div className="lose-list__item">
              <X className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentLoseDashboard}</span>
            </div>
            <div className="lose-list__item">
              <X className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentLoseBadge}</span>
            </div>
            <div className="lose-list__item">
              <X className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.leaveParentLoseReapply}</span>
            </div>
          </div>

          <div className="field">
            <label className="field__label">{t.leaveParentReason}</label>
            <textarea
              className="field__textarea"
              id="leave-reason"
              data-testid="sub-team-leave-reason-input"
              placeholder={t.leaveParentReasonPlaceholder}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="field__hint">{t.leaveParentReasonHint}</span>
          </div>

          <div className="field">
            <label className="checkbox">
              <input
                type="checkbox"
                id="confirm-check"
                data-testid="sub-team-leave-confirm-check"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="checkbox__box">
                <Check className="w-3 h-3 [&>path]:stroke-current" />
              </span>
              <span className="checkbox__label">{t.leaveParentConfirmCheckbox}</span>
            </label>
          </div>

          <div className="u-flex u-gap-10 u-justify-between leave__actions">
            <button className="btn btn--ghost" type="button" onClick={() => navigate(-1)}>
              {t.cancel}
            </button>
            <button
              className="btn btn--danger"
              id="confirm-btn"
              data-testid="sub-team-leave-confirm-btn"
              type="button"
              disabled={!ready || leaving}
              onClick={() => {
                if (!ready || leaving) return;
                setLeaving(true);
                const trimmed = reason.trim();
                void parentRel
                  .leave({ reason: trimmed === "" ? null : trimmed })
                  .then(() => {
                    navigate(`/${username}`, { replace: true });
                  })
                  .catch(() => {
                    setLeaving(false);
                  });
              }}
            >
              <LogOut className="w-3 h-3 [&>path]:stroke-current" />
              {t.leaveParentConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
