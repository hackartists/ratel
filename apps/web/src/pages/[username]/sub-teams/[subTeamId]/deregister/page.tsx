import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, Info, LogOut, TriangleAlert } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { useFindTeam } from "@ratel/ts-bridges/hooks";
import { useSubTeamDeregister } from "./hooks/use-sub-team-deregister";

// app/ratel/src/features/sub_team/pages/deregister/component.rs
// (`TeamSubTeamDeregisterPage`, `/:username/sub-teams/:subTeamId/deregister`).
// `:username` is the PARENT (admin) team; `:subTeamId` the child being unlinked.
export function Component() {
  const t = useSubTeamI18n();
  const { username = "", subTeamId = "" } = useParams<{ username: string; subTeamId: string }>();

  // This route is declared OUTSIDE SocialLayout in both apps (route.rs:215,
  // route-tree.ts) — no shared wall/team context is mounted here, so Rust
  // also loads the team locally via `find_team_handler`.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;

  const teamData = teamQuery.data;
  const parentDisplayName = teamData.nickname || teamData.username;
  const parentUsername = teamData.username;
  const teamId = teamData.pk.replace(/^TEAM#/, "");

  return (
    <>
      <SeoMeta title={t.deregisterTitle} />
      <DeregisterForm
        subTeamId={subTeamId}
        parentDisplayName={parentDisplayName}
        parentUsername={parentUsername}
        teamId={teamId}
      />
    </>
  );
}

function formatYmdUtc(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function DeregisterForm({
  subTeamId,
  parentDisplayName,
  parentUsername,
  teamId,
}: {
  subTeamId: string;
  parentDisplayName: string;
  parentUsername: string;
  teamId: string;
}) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const ctx = useSubTeamDeregister(teamId, subTeamId, parentUsername);
  const [confirmed, setConfirmed] = useState(false);

  if (!ctx.ready) return null;

  const detail = ctx.detail;
  const subTeamDisplay = detail.display_name;
  const subTeamUsername = detail.username;
  const recognizedAt = detail.recognized_at;

  const subTeamInitials = subTeamDisplay
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
  const recognizedLabel = recognizedAt > 0 ? formatYmdUtc(recognizedAt) : "";

  const reasonTrimmed = ctx.reason.trim();
  const previewEmpty = reasonTrimmed === "";
  const previewText = previewEmpty ? t.deregisterNotifPreviewEmpty : reasonTrimmed;
  const ready = confirmed && reasonTrimmed !== "";
  const parentInitials = parentDisplayName.slice(0, 2).toUpperCase();

  return (
    <div className="sub-team-deregister">
      <div className="arena-topbar">
        <div className="arena-topbar__brand">
          <button type="button" className="brand-home" aria-label="Back" onClick={() => navigate(-1)}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </button>
          <span className="brand-home__divider" />
          <div className="arena-topbar__logo arena-topbar__logo--parent">{parentInitials}</div>
          <div className="u-col">
            <span className="arena-topbar__title arena-topbar__title--parent">{parentDisplayName}</span>
            <span className="arena-topbar__handle">{t.deregisterEyebrow}</span>
          </div>
          <span className="arena-topbar__status arena-topbar__status--danger">{t.deregisterStatusChip}</span>
        </div>
      </div>

      <div className="page page--narrow">
        <div className="context">
          <div className="avatar avatar--purple avatar--lg">{subTeamInitials}</div>
          <div className="context__body">
            <span className="context__name">{subTeamDisplay}</span>
            {subTeamUsername !== "" && (
              <span className="context__handle">
                {recognizedLabel === "" ? `@${subTeamUsername}` : `@${subTeamUsername} · ${recognizedLabel} ~`}
              </span>
            )}
          </div>
          <span className="pill pill--approved">Recognized</span>
        </div>

        <div className="dereg">
          <div className="dereg__head">
            <div className="dereg__icon">
              <TriangleAlert className="w-5 h-5 [&>path]:stroke-current" />
            </div>
            <div>
              <h1 className="dereg__title">
                {t.deregisterHeaderTitlePrefix}
                <strong>{subTeamDisplay}</strong>
                {t.deregisterHeaderTitleSuffix}
              </h1>
              <p className="dereg__sub">{t.deregisterHeaderSub}</p>
            </div>
          </div>

          <div className="consequences">
            <span className="consequences__title">{t.deregisterConsequencesTitle}</span>
            <div className="consequences__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.deregisterConsequenceUnlink}</span>
            </div>
            <div className="consequences__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.deregisterConsequenceNotify}</span>
            </div>
            <div className="consequences__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.deregisterConsequenceDemote}</span>
            </div>
            <div className="consequences__item">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.deregisterConsequenceContent}</span>
            </div>
            <div className="consequences__item consequences__item--warn">
              <Info className="w-3 h-3 [&>path]:stroke-current" />
              <span>{t.deregisterConsequenceReapply}</span>
            </div>
          </div>

          <div className="field">
            <label className="field__label">
              {t.deregisterReason} <span className="req">*</span>
            </label>
            <textarea
              className="field__textarea"
              id="dereg-reason"
              data-testid="sub-team-deregister-reason-input"
              placeholder={t.deregisterReasonPlaceholder}
              value={ctx.reason}
              onChange={(e) => ctx.setReason(e.target.value)}
            />
            <span className="field__hint">{t.deregisterReasonHint}</span>
          </div>

          <div className="notif-preview">
            <span className="notif-preview__label">{t.deregisterNotifPreviewLabel}</span>
            <div className="notif-preview__body">
              <div className="notif-preview__avatar">{parentInitials}</div>
              <div className="notif-preview__content">
                <div className="notif-preview__title">
                  <em>{parentDisplayName}</em>
                  {t.deregisterNotifPreviewTitleSuffix}
                </div>
                <div className={previewEmpty ? "notif-preview__text notif-preview__text--placeholder" : "notif-preview__text"}>
                  {previewText}
                </div>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="checkbox">
              <input
                type="checkbox"
                id="confirm-check"
                data-testid="sub-team-deregister-confirm-check"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span className="checkbox__box">
                <Check className="w-3 h-3 [&>path]:stroke-current" />
              </span>
              <span className="checkbox__label">
                {t.deregisterConfirmCheck}
                <small className="checkbox__hint">{t.deregisterConfirmCheckHint}</small>
              </span>
            </label>
          </div>

          <div className="u-flex u-gap-10 u-justify-between dereg__actions">
            <div className="btn btn--ghost" role="button" onClick={() => navigate(-1)}>
              {t.cancel}
            </div>
            <button
              className="btn btn--danger"
              id="confirm-btn"
              data-testid="sub-team-deregister-confirm-btn"
              type="button"
              disabled={!ready}
              onClick={() => {
                if (!ready) return;
                ctx.deregister(reasonTrimmed);
              }}
            >
              <LogOut className="w-3 h-3 [&>path]:stroke-current" />
              {t.deregisterConfirm}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
