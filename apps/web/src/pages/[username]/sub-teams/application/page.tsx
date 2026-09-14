import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SubTeamApplicationResponse, SubTeamApplicationStatus } from "@ratel/ts-bridges";
import { Check, ChevronLeft, Clock, Lock, Pencil, RotateCcw, X } from "@/components/icons/lucide";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { useFindTeam } from "@ratel/ts-bridges/hooks";
import { useSubTeamApplicationStatus } from "./hooks/use-sub-team-application-status";

// app/ratel/src/features/sub_team/pages/application_status/component.rs
// (`TeamSubTeamApplicationStatusPage`, `/:username/sub-teams/application`).
export function Component() {
  const t = useSubTeamI18n();
  const { username = "" } = useParams<{ username: string }>();

  // team-context: no shared team context yet — loaded locally per page.
  const teamQuery = useFindTeam(username);
  if (teamQuery.data === undefined) return null;

  const teamData = teamQuery.data;
  const teamDisplay = teamData.nickname || teamData.username;
  const teamId = teamData.pk.replace(/^TEAM#/, "");

  return (
    <>
      <SeoMeta title={t.statusPageTitle} />
      <StatusBody username={username} teamDisplay={teamDisplay} parentTeamId={teamId} />
    </>
  );
}

function formatYmdUtc(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function heroCopy(status: SubTeamApplicationStatus, t: ReturnType<typeof useSubTeamI18n>) {
  switch (status) {
    case "Returned":
      return { eyebrow: t.statusHeroReturnedEyebrow, title: t.statusHeroReturnedTitle, sub: t.statusHeroReturnedSub };
    case "Approved":
      return { eyebrow: t.statusHeroApprovedEyebrow, title: t.statusHeroApprovedTitle, sub: t.statusHeroApprovedSub };
    case "Rejected":
      return { eyebrow: t.statusHeroRejectedEyebrow, title: t.statusHeroRejectedTitle, sub: t.statusHeroRejectedSub };
    default:
      return { eyebrow: t.statusHeroPendingEyebrow, title: t.statusHeroPendingTitle, sub: t.statusHeroPendingSub };
  }
}

function statusVariant(status: SubTeamApplicationStatus): string {
  switch (status) {
    case "Returned":
      return "returned";
    case "Approved":
      return "approved";
    case "Rejected":
      return "rejected";
    default:
      return "pending";
  }
}

function pillClassFor(status: SubTeamApplicationStatus): string {
  switch (status) {
    case "Returned":
      return "pill--returned";
    case "Approved":
      return "pill--approved";
    case "Rejected":
      return "pill--rejected";
    default:
      return "pill--pending";
  }
}

function topbarStatusChip(status: SubTeamApplicationStatus): { cls: string; label: string } {
  switch (status) {
    case "Returned":
      return { cls: "arena-topbar__status arena-topbar__status--returned", label: "Returned" };
    case "Approved":
      return { cls: "arena-topbar__status arena-topbar__status--approved", label: "Approved" };
    case "Rejected":
      return { cls: "arena-topbar__status arena-topbar__status--rejected", label: "Rejected" };
    default:
      return { cls: "arena-topbar__status arena-topbar__status--pending", label: "Pending" };
  }
}

function feedbackHeading(status: SubTeamApplicationStatus, t: ReturnType<typeof useSubTeamI18n>): string {
  switch (status) {
    case "Returned":
      return t.statusFeedbackReturnedHeading;
    case "Approved":
      return t.statusFeedbackApprovedHeading;
    case "Rejected":
      return t.statusFeedbackRejectedHeading;
    default:
      return "";
  }
}

function HeroIcon({ status }: { status: SubTeamApplicationStatus }) {
  switch (status) {
    case "Returned":
      return <RotateCcw className="w-7 h-7 [&>path]:stroke-current" />;
    case "Approved":
      return <Check className="w-7 h-7 [&>path]:stroke-current" />;
    case "Rejected":
      return <X className="w-7 h-7 [&>path]:stroke-current" />;
    default:
      return <Clock className="w-7 h-7 [&>path]:stroke-current" />;
  }
}

function formatRelativeWhen(status: SubTeamApplicationStatus, app: SubTeamApplicationResponse): string {
  const ms = status === "Approved" || status === "Rejected" ? app.decided_at ?? app.updated_at : app.submitted_at ?? app.created_at;
  if (ms <= 0) return "";
  return formatYmdUtc(ms);
}

function buildSnapshotRows(app: SubTeamApplicationResponse): Array<[string, string]> {
  const snapshot = [...app.form_snapshot].sort((a, b) => {
    if (a.locked !== b.locked) return a.locked ? -1 : 1;
    return a.order - b.order;
  });
  return snapshot.map((field) => {
    const raw = app.form_values[field.field_id];
    let value = "";
    if (typeof raw === "string") value = raw;
    else if (typeof raw === "number" || typeof raw === "boolean") value = String(raw);
    else if (Array.isArray(raw)) value = raw.filter((v) => typeof v === "string").join(", ");
    return [field.label, value] as [string, string];
  });
}

function StatusBody({ username, teamDisplay, parentTeamId }: { username: string; teamDisplay: string; parentTeamId: string }) {
  const t = useSubTeamI18n();
  const navigate = useNavigate();
  const { application } = useSubTeamApplicationStatus(parentTeamId);
  const latest = application;

  const initials = teamDisplay.slice(0, 2).toUpperCase();

  let body: ReactNode;
  if (latest) {
    const variant = statusVariant(latest.status);
    const hero = heroCopy(latest.status, t);
    const whenText = formatRelativeWhen(latest.status, latest);
    const fieldCount = latest.form_snapshot.length;
    const decisionReason = latest.decision_reason ?? "";
    const showFeedback =
      latest.status === "Approved"
        ? decisionReason.trim() !== ""
        : latest.status === "Returned" || latest.status === "Rejected";
    const heading = feedbackHeading(latest.status, t);
    const feedbackIsRejected = latest.status === "Rejected";
    const parentDisplay = latest.parent_team_display_name || latest.parent_team_id.slice(0, 8);
    const parentInitials = parentDisplay
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w.charAt(0))
      .join("")
      .toUpperCase();
    const showEdit = latest.status === "Returned";
    const pillClass = pillClassFor(latest.status);
    const topbarLabel = topbarStatusChip(latest.status).label;
    const snapshotRows = buildSnapshotRows(latest);
    const feedbackClass = feedbackIsRejected ? "feedback feedback--rejected" : "feedback";

    body = (
      <>
        <div className="status-hero" data-v={variant}>
          <div className="status-hero__icon">
            <HeroIcon status={latest.status} />
          </div>
          <div>
            <span className="status-hero__eyebrow">
              {hero.eyebrow} · {whenText}
            </span>
            <h2 className="status-hero__title">{hero.title}</h2>
            <p className="status-hero__sub">{hero.sub}</p>
          </div>
          <div className="u-col status-hero__meta">
            <span className={`pill ${pillClass}`}>{topbarLabel}</span>
            <span className="status-hero__meta-foot">
              {t.statusFormVersionMeta} · {fieldCount} {t.statusFieldsCountSuffix}
            </span>
          </div>
        </div>

        {showFeedback && (
          <section className="card">
            <div className="card__head">
              <h3 className="card__title" data-feedback-variant={variant}>
                {heading}
              </h3>
              <span className="card__dash" />
            </div>
            <div className={feedbackClass}>
              <div className="avatar feedback__avatar">{parentInitials}</div>
              <div className="feedback__body">
                <div className="feedback__head">
                  <span className="feedback__author">{parentDisplay}</span>
                </div>
                <div className="feedback__title">{heading}</div>
                <div className="feedback__text">{decisionReason}</div>
              </div>
            </div>
            <div className="action-row">
              {showEdit && (
                <button
                  className="btn btn--primary"
                  type="button"
                  onClick={() => navigate(`/${username}/sub-teams/apply`)}
                >
                  <Pencil className="w-3 h-3 [&>path]:stroke-current" />
                  {t.statusEditAndResubmit}
                </button>
              )}
            </div>
          </section>
        )}

        <section className="card">
          <div className="card__head">
            <h3 className="card__title card__title--snapshot">{t.statusSnapshotHeading}</h3>
            <span className="card__dash" />
            <span className="card__meta">
              {t.statusFormVersionMeta} · {fieldCount} {t.statusFieldsCountSuffix}
            </span>
          </div>
          <div className="snapshot">
            {snapshotRows.length === 0 && <div className="empty-row">{t.statusNoApplications}</div>}
            {snapshotRows.map(([key, value]) => (
              <div key={key} className="snapshot__row">
                <span className="snapshot__key">{key}</span>
                <span className="snapshot__value">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="notice notice--teal">
          <div className="notice__icon">
            <Lock className="w-4 h-4 [&>path]:stroke-current" />
          </div>
          <div className="notice__body">
            <span className="notice__title">{t.statusFormPinTitle}</span>
            <span className="notice__text">{t.statusFormPinText}</span>
          </div>
        </div>
      </>
    );
  } else {
    body = <div className="empty-row">{t.statusNoApplications}</div>;
  }

  return (
    <div className="sub-team-application-status">
      <div className="arena-topbar">
        <div className="arena-topbar__brand">
          <button className="brand-home" aria-label="Back" type="button" onClick={() => navigate(`/${username}`)}>
            <ChevronLeft className="w-4 h-4 [&>path]:stroke-current" />
          </button>
          <span className="brand-home__divider" />
          <div className="arena-topbar__logo arena-topbar__logo--child">{initials}</div>
          <div className="u-col">
            <span className="arena-topbar__title arena-topbar__title--child">{teamDisplay}</span>
            <span className="arena-topbar__handle">{t.statusPageEyebrow}</span>
          </div>
          {latest && (
            // Rust: `span { class: "arena-topbar__status {cls}", ... }` where `cls` is
            // ITSELF already "arena-topbar__status arena-topbar__status--<variant>" —
            // ported verbatim (including the duplicated class token) for DOM parity.
            <span className={`arena-topbar__status ${topbarStatusChip(latest.status).cls}`}>
              {topbarStatusChip(latest.status).label}
            </span>
          )}
        </div>
      </div>

      <div className="page page--narrow">
        <div className="page-header">
          <div className="page-header__main">
            <span className="page-header__eyebrow">
              <Clock className="w-3 h-3 [&>path]:stroke-current" />
              {t.statusPageEyebrow}
            </span>
            <h1 className="page-header__title page-header__title--child">
              {teamDisplay}
              <strong> · {t.applicationStatus}</strong>
            </h1>
          </div>
        </div>

        {body}
      </div>
    </div>
  );
}
