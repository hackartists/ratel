import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useCancelChildApplication } from "@ratel/ts-bridges/hooks";
import { getParentRelationshipHandler } from "@ratel/ts-bridges";
import { ChevronRight, Clock, FileText, GraduationCap, House, Info, LogOut, Pencil, X } from "@/components/icons/lucide";
import { useTeamArena } from "@/components/social/team-arena-context";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";

// app/ratel/src/features/sub_team/components/parent_hud_panel/component.rs
// (`ParentHudPanel`) + hooks/use_parent_relationship.rs: the graduation-cap HUD
// button in the team topbar and its slide-out parent-relationship panel.

/** `get_parent_relationship_handler(team_id)`; suspends like the Rust loader. */
function useParentRelationship(teamId: string) {
  const queryClient = useQueryClient();
  const key = ["getParentRelationship", teamId] as const;
  const relationship = useSuspenseQuery({ queryKey: key, queryFn: () => getParentRelationshipHandler(teamId) });
  const cancel = useCancelChildApplication();

  return {
    relationship: relationship.data,
    /** Rust `handle_cancel_application`: no-op without an application id, then restart. */
    cancelApplication: async () => {
      const appId = relationship.data.latest_application_id;
      if (!appId) return;
      try {
        await cancel.mutateAsync({ teamPk: teamId, applicationId: appId });
        await queryClient.invalidateQueries({ queryKey: key });
      } catch (e) {
        console.error("cancel_child_application failed:", e);
      }
    },
  };
}

/** chrono `%Y-%m-%d` of epoch-ms, UTC. */
function formatYmd(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function ParentHudPanel() {
  const tr = useSubTeamI18n();
  const navigate = useNavigate();
  const arena = useTeamArena();
  const { relationship: rel, cancelApplication } = useParentRelationship(arena.teamId);
  const [open, setOpen] = useState(false);

  const ownUsername = arena.username;
  const isAdmin = arena.isAdmin;
  const status = rel.status;

  if (!isAdmin && status !== "RecognizedSubTeam") return null;

  const badgeState = status === "RecognizedSubTeam" ? "recognized" : status === "PendingSubTeam" ? "pending" : "none";
  // Rust hardcodes the fallback name (component.rs:71).
  const parentName = rel.parent_team_display_name ?? "Parent team";
  const parentUsername = rel.parent_team_username ?? "";
  const parentInitials = parentName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => Array.from(w)[0] ?? "")
    .join("")
    .toUpperCase();
  const recognizedMeta = rel.recognized_at !== null && rel.recognized_at > 0 ? formatYmd(rel.recognized_at) : null;

  return (
    <div className="parent-panel-wrap">
      <button
        className="hud-btn hud-btn--parent"
        data-testid="sub-team-hud-parent-btn"
        data-state={badgeState}
        aria-label={tr.parentIcon}
        aria-expanded={open ? "true" : "false"}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        <GraduationCap className="w-5 h-5 [&>path]:stroke-current" />
      </button>
      {/* Rust hardcodes the dialog/close labels (component.rs:115,123). */}
      <div className="parent-panel" data-open={open ? "true" : "false"} role="dialog" aria-label="Parent team">
        <div className="parent-panel__head">
          <span className="parent-panel__title">
            <GraduationCap className="w-3 h-3 [&>path]:stroke-current" />
            {tr.parentPanelTitle}
          </span>
          <button className="parent-panel__close" aria-label="Close" type="button" onClick={() => setOpen(false)}>
            <X className="w-3 h-3 [&>path]:stroke-current" />
          </button>
        </div>

        {status === "RecognizedSubTeam" ? (
          <div className="parent-state-block" data-active="true">
            <div className="parent-card">
              <div className="parent-card__avatar">{parentInitials}</div>
              <div className="parent-card__body">
                <div className="parent-card__name">{parentName}</div>
                <div className="parent-card__meta">
                  {recognizedMeta !== null
                    ? `@${parentUsername} · ${tr.parentCardMetaRecognizedSince} ${recognizedMeta} ~`
                    : `@${parentUsername}`}
                </div>
              </div>
              <span className="parent-card__status parent-card__status--recognized">{tr.parentCardStatusActive}</span>
            </div>
            <div className="pp-info">
              {tr.parentRecognizedInfoPrefix}
              <strong>{parentName}</strong>
              {tr.parentRecognizedInfoSuffix}
            </div>
            <div className="pp-actions">
              <a
                className="pp-action"
                onClick={() => {
                  // Full-page navigation, like Rust (component.rs:167-191).
                  if (parentUsername) window.location.assign(`/${parentUsername}/`);
                }}
              >
                <span className="pp-action__icon">
                  <House className="w-3 h-3 [&>path]:stroke-current" />
                </span>
                <span className="pp-action__body">
                  <span className="pp-action__title">{tr.parentActionOpenHomeTitle}</span>
                  <span className="pp-action__sub">{tr.parentActionOpenHomeSub}</span>
                </span>
                <span className="pp-action__chev">
                  <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                </span>
              </a>
              <a
                className="pp-action"
                onClick={() => {
                  if (parentUsername) navigate(`/${parentUsername}/bylaws`);
                }}
              >
                <span className="pp-action__icon">
                  <FileText className="w-3 h-3 [&>path]:stroke-current" />
                </span>
                <span className="pp-action__body">
                  <span className="pp-action__title">{tr.parentActionViewBylawsTitle}</span>
                  <span className="pp-action__sub">{tr.parentActionViewBylawsSub}</span>
                </span>
                <span className="pp-action__chev">
                  <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                </span>
              </a>
              {isAdmin && (
                <a className="pp-action pp-action--danger" onClick={() => navigate(`/${ownUsername}/parent/leave`)}>
                  <span className="pp-action__icon">
                    <LogOut className="w-3 h-3 [&>path]:stroke-current" />
                  </span>
                  <span className="pp-action__body">
                    <span className="pp-action__title">{tr.parentActionLeaveTitle}</span>
                    <span className="pp-action__sub">{tr.parentActionLeaveSub}</span>
                  </span>
                  <span className="pp-action__chev">
                    <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                  </span>
                </a>
              )}
            </div>
          </div>
        ) : status === "PendingSubTeam" ? (
          <div className="parent-state-block" data-active="true">
            <div className="parent-card" data-variant="pending">
              <div className="parent-card__avatar">{parentInitials}</div>
              <div className="parent-card__body">
                <div className="parent-card__name">{parentName}</div>
                <div className="parent-card__meta">{parentUsername !== "" && `@${parentUsername}`}</div>
              </div>
              <span className="parent-card__status parent-card__status--pending">{tr.parentCardStatusPending}</span>
            </div>
            <div className="pp-info pp-info--amber">{tr.parentPendingInfo}</div>
            <div className="pp-actions">
              <a
                className="pp-action pp-action--primary"
                onClick={() => {
                  if (parentUsername) navigate(`/${parentUsername}/sub-teams/application`);
                }}
              >
                <span className="pp-action__icon">
                  <Clock className="w-3 h-3 [&>path]:stroke-current" />
                </span>
                <span className="pp-action__body">
                  <span className="pp-action__title">{tr.parentActionViewApplicationTitle}</span>
                  <span className="pp-action__sub">{tr.parentActionViewApplicationSub}</span>
                </span>
                <span className="pp-action__chev">
                  <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                </span>
              </a>
              {isAdmin && (
                <>
                  <a
                    className="pp-action"
                    onClick={() => {
                      if (parentUsername) navigate(`/${parentUsername}/sub-teams/apply`);
                    }}
                  >
                    <span className="pp-action__icon">
                      <Pencil className="w-3 h-3 [&>path]:stroke-current" />
                    </span>
                    <span className="pp-action__body">
                      <span className="pp-action__title">{tr.parentActionEditApplicationTitle}</span>
                      <span className="pp-action__sub">{tr.parentActionEditApplicationSub}</span>
                    </span>
                    <span className="pp-action__chev">
                      <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                    </span>
                  </a>
                  <a
                    className="pp-action pp-action--danger"
                    onClick={() => {
                      void cancelApplication();
                      setOpen(false);
                    }}
                  >
                    <span className="pp-action__icon">
                      <X className="w-3 h-3 [&>path]:stroke-current" />
                    </span>
                    <span className="pp-action__body">
                      <span className="pp-action__title">{tr.parentActionCancelApplicationTitle}</span>
                      <span className="pp-action__sub">{tr.parentActionCancelApplicationSub}</span>
                    </span>
                    <span className="pp-action__chev">
                      <ChevronRight className="w-3 h-3 [&>path]:stroke-current" />
                    </span>
                  </a>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="parent-state-block" data-active="true">
            <div className="pp-empty">
              <div className="pp-empty__icon">
                <Info className="w-4 h-4 [&>path]:stroke-current" />
              </div>
              <div className="pp-empty__title">{tr.parentStandaloneTitle}</div>
              <div className="pp-empty__desc">{tr.parentStandaloneDesc}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
