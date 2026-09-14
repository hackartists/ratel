// app/ratel/src/features/spaces/pages/index/action_dashboard/quest_edit_button/component.rs —
// `QuestEditButton`: the admin "edit" icon on a quest card (does not open the card).
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";

export function QuestEditButton({ actionId, onEdit }: { actionId: string; onEdit: () => void }) {
  const tr = useSpaceViewerI18n();

  return (
    <button
      aria-label={tr.edit}
      className="quest-card__edit-btn"
      data-testid={`quest-edit-btn-${actionId}`}
      onClick={(e) => {
        e.stopPropagation();
        onEdit();
      }}
    >
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" x2="8" y1="13" y2="13" />
        <line x1="16" x2="8" y1="17" y2="17" />
        <line x1="10" x2="8" y1="9" y2="9" />
      </svg>
    </button>
  );
}
