// app/ratel/src/features/spaces/pages/index/action_dashboard/add_action_card/component.rs —
// `AddActionCard`: the admin "new action" card at the end of the carousel.
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";

export function AddActionCard({ onClick }: { onClick: () => void }) {
  const tr = useSpaceViewerI18n();

  return (
    <button
      aria-label={tr.createAction}
      className="quest-card quest-card--add"
      data-testid="admin-add-action-card"
      data-type="add"
      onClick={() => onClick()}
    >
      <div className="add-card__plus">
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <line x1="12" x2="12" y1="5" y2="19" />
          <line x1="5" x2="19" y1="12" y2="12" />
        </svg>
      </div>
      <div className="add-card__title">{tr.newAction}</div>
      <div className="add-card__desc">{tr.newActionDesc}</div>
    </button>
  );
}
