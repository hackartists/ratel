import { useNavigate } from "react-router-dom";
import { isGreetingEditable, useSpace } from "@/components/space/space-context";
import { useGreetingEntryI18n } from "./greeting-entry.i18n";

/** Route of the full-page greeting editor opened from the settings panel. */
export function greetingSettingsPath(spaceId: string): string {
  return `/spaces/${spaceId}/settings/greeting`;
}

/**
 * Admin-only settings-panel row that opens the full-page waiting greeting
 * editor, laid out like the installed-app rows of `AppsSection`.
 */
export function GreetingEntry({ spaceId }: { spaceId: string }) {
  const tr = useGreetingEntryI18n();
  const navigate = useNavigate();
  const editable = isGreetingEditable(useSpace().status);

  return (
    <section className="settings-section apps-section" data-testid="greeting-settings-entry">
      <div className="settings-section__sublabel">
        <span className="settings-section__sublabel-text">{tr.section}</span>
      </div>
      <div className="app-row">
        <div className="app-row__icon app-row__icon--general">
          <svg
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.6"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            <line x1="8" x2="16" y1="9" y2="9" />
            <line x1="8" x2="13" y1="13" y2="13" />
          </svg>
        </div>
        <div className="app-row__info">
          <div className="app-row__name-line">
            <span className="app-row__name">{tr.name}</span>
          </div>
          <div className="app-row__desc">{editable ? tr.description : tr.locked}</div>
        </div>
        <div className="app-row__action">
          <button className="app-row-btn" data-testid="settings-greeting" onClick={() => navigate(greetingSettingsPath(spaceId))}>
            {editable ? tr.open : tr.view}
          </button>
        </div>
      </div>
    </section>
  );
}
