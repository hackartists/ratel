import { useRef } from "react";
import { useSubTeamI18n } from "@/pages/[username]/sub-teams/sub-team.i18n";
import { parseI32 } from "../hooks/format";
import { useDomProp, useNativeChange } from "../hooks/use-dom-value";
import { useSubTeamManagement } from "../hooks/use-sub-team-management";

// app/ratel/src/features/sub_team/pages/management/requirements_tab.rs (`RequirementsTab`).
export function RequirementsTab() {
  const tr = useSubTeamI18n();
  const { settings, handleUpdateSettings } = useSubTeamManagement();

  const minMembers = settings.min_sub_team_members;
  const minAgeDays = settings.min_sub_team_age_days;

  const membersRef = useRef<HTMLInputElement>(null);
  useDomProp(membersRef, "value", String(minMembers));
  useNativeChange(membersRef, (el) => {
    const n = parseI32(el.value);
    if (n !== null) {
      handleUpdateSettings({
        is_parent_eligible: null,
        min_sub_team_members: Math.max(n, 0),
        min_sub_team_age_days: null,
      });
    }
  });

  const daysRef = useRef<HTMLInputElement>(null);
  useDomProp(daysRef, "value", String(minAgeDays));
  useNativeChange(daysRef, (el) => {
    const n = parseI32(el.value);
    if (n !== null) {
      handleUpdateSettings({
        is_parent_eligible: null,
        min_sub_team_members: null,
        min_sub_team_age_days: Math.min(Math.max(n, 0), 365),
      });
    }
  });

  return (
    <section className="card" id="requirements">
      <div className="card__head">
        <h2 className="card__title">{tr.reqCardTitle}</h2>
        <span className="card__dash" />
        <span className="card__meta">{tr.reqCardMeta}</span>
      </div>

      <div className="req-grid">
        <div className="req-card">
          <div className="req-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="req-card__body">
            <div className="req-card__title">{tr.reqMinMembersTitle}</div>
            <div className="req-card__desc">{tr.reqMinMembersDesc}</div>
          </div>
          <div className="req-card__input-wrap">
            <button
              className="req-card__stepper"
              onClick={() =>
                handleUpdateSettings({
                  is_parent_eligible: null,
                  min_sub_team_members: Math.max(minMembers - 1, 0),
                  min_sub_team_age_days: null,
                })
              }
            >
              −
            </button>
            <input
              ref={membersRef}
              className="req-card__value"
              type="number"
              id="min-members"
              data-testid="sub-team-settings-min-members-input"
              defaultValue={String(minMembers)}
              min="0"
              max="99"
            />
            <button
              className="req-card__stepper"
              onClick={() =>
                handleUpdateSettings({
                  is_parent_eligible: null,
                  min_sub_team_members: minMembers + 1,
                  min_sub_team_age_days: null,
                })
              }
            >
              +
            </button>
          </div>
        </div>

        <div className="req-card">
          <div
            className="req-card__icon"
            style={{
              background: "rgba(110,237,216,0.06)",
              borderColor: "rgba(110,237,216,0.22)",
              color: "var(--sub-team-teal)",
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div className="req-card__body">
            <div className="req-card__title" style={{ color: "var(--sub-team-teal)" }}>
              {tr.reqMinDaysTitle}
            </div>
            <div className="req-card__desc">{tr.reqMinDaysDesc}</div>
          </div>
          <div className="req-card__input-wrap">
            <button
              className="req-card__stepper"
              onClick={() =>
                handleUpdateSettings({
                  is_parent_eligible: null,
                  min_sub_team_members: null,
                  min_sub_team_age_days: Math.max(minAgeDays - 1, 0),
                })
              }
            >
              −
            </button>
            <input
              ref={daysRef}
              className="req-card__value"
              type="number"
              id="min-days"
              data-testid="sub-team-settings-min-days-input"
              defaultValue={String(minAgeDays)}
              min="0"
              max="365"
            />
            <button
              className="req-card__stepper"
              onClick={() =>
                handleUpdateSettings({
                  is_parent_eligible: null,
                  min_sub_team_members: null,
                  min_sub_team_age_days: Math.min(minAgeDays + 1, 365),
                })
              }
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="inline-note" style={{ marginTop: "12px" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <span>{tr.reqInlineNote}</span>
      </div>
    </section>
  );
}
