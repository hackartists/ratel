import { useRef, useState, type ReactNode } from "react";
import { Check } from "@/components/icons/lucide";
import { useRouteUsername } from "@/components/social/use-wall-context";
import { SeoMeta } from "@/components/ui/seo-meta";
import { useSubTeamI18n, type SubTeamI18n } from "@/i18n/generated/features/sub_team/sub-team.i18n";
import { dataBool } from "@/lib/dom";
import { BroadcastTab } from "./components/broadcast-tab";
import { DocsTab } from "./components/docs-tab";
import { FormTab } from "./components/form-tab";
import { ListTab } from "./components/list-tab";
import { QueueTab } from "./components/queue-tab";
import { RequirementsTab } from "./components/requirements-tab";
import { diffDays, formatYmd } from "./hooks/format";
import { useDomProp } from "./hooks/use-dom-value";
import {
  SubTeamManagementProvider,
  useSubTeamManagementProvider,
} from "./hooks/use-sub-team-management";

// app/ratel/src/features/sub_team/pages/management/component.rs
// (`TeamSubTeamManagementPage`, `/:username/sub-teams/manage`, inside
// SocialLayout). Autosave chip, activation hero, KPI row, tab nav and the
// active tab's panel.

type ManagementTab = "Requirements" | "Documents" | "Roster" | "Queue" | "Broadcast";

const KPI_STYLE = {
  padding: "14px 18px",
  borderRadius: "12px",
  background: "var(--sub-team-glass)",
  border: "1px solid var(--sub-team-border)",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  minWidth: 0,
} as const;

const KPI_LABEL_STYLE = {
  fontSize: "9px",
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--sub-team-dim)",
} as const;

export function Component() {
  const username = useRouteUsername();
  const tr = useSubTeamI18n();
  const ctrl = useSubTeamManagementProvider(username);
  const { team, settings, handleUpdateSettings, teams, queue, announcements } = ctrl;

  const isOn = settings.is_parent_eligible;
  const recognizedCount = teams.items.length;
  const pendingCount = queue.items.length;
  const publishedAts = announcements.items
    .filter((a) => a.status === "Published")
    .map((a) => a.published_at)
    .filter((t): t is number => t !== null);
  const lastBroadcastAt = publishedAts.length > 0 ? Math.max(...publishedAts) : null;
  const lastBroadcastLabel =
    lastBroadcastAt !== null && lastBroadcastAt > 0 ? formatLastBroadcast(lastBroadcastAt, tr) : tr.kpiNoBroadcast;

  const [activeTab, setActiveTab] = useState<ManagementTab>("Requirements");

  const toggleRef = useRef<HTMLInputElement>(null);
  useDomProp(toggleRef, "checked", isOn);

  // Team without a parent (상위팀) → Bylaws; with a parent (하위팀) → ClubBylaws.
  const docsCategory = team.parent_team_id !== null && team.parent_team_id !== "" ? "ClubBylaws" : "Bylaws";
  const teamDisplayName = team.nickname === "" ? team.username : team.nickname;

  return (
    <SubTeamManagementProvider value={ctrl}>
      <SeoMeta title={tr.tabRequirements} />

      <div className="sub-team-management">
        <div className="page page--wide" id="page-root" data-activated={dataBool(isOn)}>
          <div className="u-flex u-justify-end">
            <span className="autosave-chip">
              <Check className="w-3 h-3 [&>path]:stroke-current" />
              {tr.settingsAutosaved}
            </span>
          </div>

          <section className="activation" id="activation" data-on={dataBool(isOn)}>
            <div className="activation__icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2l2.09 4.23 4.66.68-3.38 3.29.8 4.64L12 12.67l-4.17 2.17.8-4.64L5.25 6.91l4.66-.68L12 2z" />
                <circle cx="6" cy="19" r="3" />
                <circle cx="18" cy="19" r="3" />
                <path d="M9 19h6" />
              </svg>
            </div>
            <div>
              <div className="activation__label" id="activation-label">
                {isOn ? tr.activationLabelOn : tr.activationLabelOff}
              </div>
              <div className="activation__title">{isOn ? tr.activationTitleOn : tr.activationTitleOff}</div>
              <p className="activation__desc">{tr.activationDesc}</p>
            </div>
            <label className="switch activation__switch" data-testid="sub-team-settings-eligibility-switch">
              <input
                ref={toggleRef}
                type="checkbox"
                id="activation-toggle"
                defaultChecked={isOn}
                onChange={(e) =>
                  handleUpdateSettings({
                    is_parent_eligible: e.currentTarget.checked,
                    min_sub_team_members: null,
                    min_sub_team_age_days: null,
                  })
                }
              />
              <span className="switch__track" />
            </label>
          </section>

          <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "12px" }}>
            <div className="kpi" style={KPI_STYLE}>
              <span className="kpi__label" style={KPI_LABEL_STYLE}>
                {tr.kpiRecognized}
              </span>
              <span
                className="kpi__value kpi__value--gold"
                style={{
                  fontSize: "22px",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  background: "linear-gradient(135deg,var(--sub-team-gold),#ffd24a)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {recognizedCount}
              </span>
            </div>
            <div className="kpi" style={KPI_STYLE}>
              <span className="kpi__label" style={KPI_LABEL_STYLE}>
                {tr.kpiPending}
              </span>
              <span
                className="kpi__value kpi__value--amber"
                style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--sub-team-amber)" }}
              >
                {pendingCount}
              </span>
              {pendingCount > 0 && (
                <span
                  className="kpi__delta kpi__delta--amber"
                  style={{ fontSize: "10px", letterSpacing: "0.08em", color: "var(--sub-team-amber)" }}
                >
                  {tr.kpiPendingReview}
                </span>
              )}
            </div>
            <div className="kpi" style={KPI_STYLE}>
              <span className="kpi__label" style={KPI_LABEL_STYLE}>
                {tr.kpiLastBroadcast}
              </span>
              <span
                className="kpi__value kpi__value--purple"
                style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "0.02em", color: "var(--sub-team-purple)" }}
              >
                {lastBroadcastLabel}
              </span>
            </div>
          </div>

          <nav className="tabs-nav" role="tablist">
            <TabButton
              label={tr.tabRequirements}
              active={activeTab === "Requirements"}
              testid="sub-team-tab-requirements"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              }
              onClick={() => setActiveTab("Requirements")}
            />
            <TabButton
              label={tr.tabDocuments}
              active={activeTab === "Documents"}
              testid="sub-team-tab-documents"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="13" y2="17" />
                </svg>
              }
              onClick={() => setActiveTab("Documents")}
            />
            <TabButton
              label={tr.tabSubTeams}
              active={activeTab === "Roster"}
              testid="sub-team-tab-roster"
              badge={<span className="tabs-nav__badge">{recognizedCount}</span>}
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              }
              onClick={() => setActiveTab("Roster")}
            />
            <TabButton
              label={tr.tabQueue}
              active={activeTab === "Queue"}
              testid="sub-team-tab-queue"
              badge={
                <span className={pendingCount > 0 ? "tabs-nav__badge tabs-nav__badge--amber" : "tabs-nav__badge"}>
                  {pendingCount}
                </span>
              }
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              }
              onClick={() => setActiveTab("Queue")}
            />
            <TabButton
              label={tr.tabBroadcast}
              active={activeTab === "Broadcast"}
              testid="sub-team-tab-broadcast"
              icon={
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11l18-8v18l-18-8v-2z" />
                </svg>
              }
              onClick={() => setActiveTab("Broadcast")}
            />
          </nav>

          <div className="tab-panel" data-tab="requirements" data-active={dataBool(activeTab === "Requirements")}>
            {activeTab === "Requirements" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <RequirementsTab />
                <FormTab />
              </div>
            )}
          </div>
          <div className="tab-panel" data-tab="documents" data-active={dataBool(activeTab === "Documents")}>
            {activeTab === "Documents" && <DocsTab category={docsCategory} />}
          </div>
          <div className="tab-panel" data-tab="roster" data-active={dataBool(activeTab === "Roster")}>
            {activeTab === "Roster" && <ListTab />}
          </div>
          <div className="tab-panel" data-tab="queue" data-active={dataBool(activeTab === "Queue")}>
            {activeTab === "Queue" && <QueueTab />}
          </div>
          <div className="tab-panel" data-tab="broadcast" data-active={dataBool(activeTab === "Broadcast")}>
            {activeTab === "Broadcast" && <BroadcastTab teamDisplayName={teamDisplayName} />}
          </div>
        </div>
      </div>
    </SubTeamManagementProvider>
  );
}

function TabButton({
  label,
  active,
  testid,
  icon,
  badge,
  onClick,
}: {
  label: string;
  active: boolean;
  testid: string;
  icon: ReactNode;
  badge?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="tabs-nav__btn" role="tab" aria-selected={dataBool(active)} data-testid={testid} onClick={onClick}>
      {icon}
      {label}
      {badge}
    </button>
  );
}

/** `format_last_broadcast` — Today / Yesterday / N days ago, else YYYY-MM-DD. */
function formatLastBroadcast(tsMs: number, tr: SubTeamI18n): string {
  const d = diffDays(tsMs);
  if (d === 0) return tr.broadcastTimeToday;
  if (d === 1) return tr.broadcastTimeYesterday;
  if (d <= 6) return tr.broadcastTimeDaysAgo({ n: d });
  return formatYmd(tsMs);
}
