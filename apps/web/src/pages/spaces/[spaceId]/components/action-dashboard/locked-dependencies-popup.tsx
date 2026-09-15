// app/ratel/src/features/spaces/pages/index/action_dashboard/locked_dependencies_popup/component.rs —
// `LockedDependenciesPopup`: lists the unmet actions blocking a locked quest
// card; picking one scrolls its card into view and closes the popup.
import type { SpaceActionSummary, SpaceActionType, SpacePartition } from "@ratel/ts-bridges";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useLockedDependenciesPopupI18n } from "./i18n";
import { useToast } from "@/lib/toast";

export function LockedDependenciesPopup({
  spaceId: _spaceId,
  outstanding,
  onClose,
}: {
  spaceId: SpacePartition;
  outstanding: SpaceActionSummary[];
  onClose: () => void;
}) {
  const tr = useLockedDependenciesPopupI18n();
  const te = useEnumI18n();
  const toast = useToast();

  const onPick = (action: SpaceActionSummary) => {
    if (scrollToCard(action.action_id)) {
      onClose();
    } else {
      // Rust `toast.error(Error::NotFound(tr.scroll_failed))` — the toast shows
      // the translated `Error::NotFound` variant, not the inner string.
      toast.error(new Error(te("Error", "NotFound")));
    }
  };

  return (
    <div className="locked-deps">
      <div className="locked-deps__head">
        <span className="locked-deps__icon">
          <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
        <div className="locked-deps__head-text">
          <span className="locked-deps__title">{tr.title}</span>
          <span className="locked-deps__subtitle">{tr.subtitle}</span>
        </div>
      </div>

      <ul className="locked-deps__list">
        {outstanding.map((action) => (
          <li key={action.action_id} className="locked-deps__item">
            <button type="button" className="locked-deps__row" title={action.title} onClick={() => onPick(action)}>
              <span className="locked-deps__row-type">{typeLabel(action.action_type)}</span>
              <span className="locked-deps__row-title">{action.title}</span>
              <svg
                className="locked-deps__row-chevron"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function typeLabel(kind: SpaceActionType): string {
  switch (kind) {
    case "Poll":
      return "POLL";
    case "Quiz":
      return "QUIZ";
    case "TopicDiscussion":
      return "DISCUSSION";
    case "Follow":
      return "FOLLOW";
    case "Meet":
      return "MEET";
  }
}

/** Rust `scroll_to_card` (web): scroll the quest card into view; false when it is not on the page. */
function scrollToCard(actionId: string): boolean {
  const selector = `[data-testid="quest-card-${actionId.split('"').join("")}"]`;
  const el = document.querySelector(selector);
  if (!(el instanceof HTMLElement)) return false;
  el.scrollIntoView();
  return true;
}
