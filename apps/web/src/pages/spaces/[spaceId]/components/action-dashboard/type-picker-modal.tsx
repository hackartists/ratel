// app/ratel/src/features/spaces/pages/index/action_dashboard/type_picker_modal/component.rs —
// `TypePickerModal`: the admin bottom sheet choosing the type of a new action.
import type { SpaceActionType } from "@ratel/ts-bridges";
import { useSpaceViewerI18n } from "@/pages/spaces/[spaceId]/components/space-viewer.i18n";

export function TypePickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (type: SpaceActionType) => void;
}) {
  const tr = useSpaceViewerI18n();

  if (!open) return null;

  const pick = (type: SpaceActionType) => () => {
    onPick(type);
    onClose();
  };

  return (
    <div className="type-sheet open" data-testid="type-picker-modal" onClick={() => onClose()}>
      <div className="type-sheet__panel" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="type-sheet__header">
          <span className="type-sheet__title">{tr.chooseActionType}</span>
          <button aria-label="Close" className="type-sheet__close" onClick={() => onClose()}>
            <svg
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <line x1="18" x2="6" y1="6" y2="18" />
              <line x1="6" x2="18" y1="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="type-grid">
          {/* Poll */}
          <button className="type-option" data-testid="type-option-poll" data-type="poll" onClick={pick("Poll")}>
            <div className="type-option__icon">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M18 20V10" />
                <path d="M12 20V4" />
                <path d="M6 20v-6" />
              </svg>
            </div>
            <div className="type-option__name">{tr.pollName}</div>
            <div className="type-option__desc">{tr.pollDesc}</div>
          </button>
          {/* Discussion */}
          <button
            className="type-option"
            data-testid="type-option-discuss"
            data-type="discuss"
            onClick={pick("TopicDiscussion")}
          >
            <div className="type-option__icon">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="type-option__name">{tr.discussionName}</div>
            <div className="type-option__desc">{tr.discussionDesc}</div>
          </button>
          {/* Quiz */}
          <button className="type-option" data-testid="type-option-quiz" data-type="quiz" onClick={pick("Quiz")}>
            <div className="type-option__icon">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" x2="12.01" y1="17" y2="17" />
              </svg>
            </div>
            <div className="type-option__name">{tr.quizName}</div>
            <div className="type-option__desc">{tr.quizDesc}</div>
          </button>
          {/* Follow */}
          <button className="type-option" data-testid="type-option-follow" data-type="follow" onClick={pick("Follow")}>
            <div className="type-option__icon">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="19" x2="19" y1="8" y2="14" />
                <line x1="22" x2="16" y1="11" y2="11" />
              </svg>
            </div>
            <div className="type-option__name">{tr.followName}</div>
            <div className="type-option__desc">{tr.followDesc}</div>
          </button>
          {/* Meet */}
          <button className="type-option" data-testid="type-option-meet" data-type="meet" onClick={pick("Meet")}>
            <div className="type-option__icon">
              <svg
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="23 7 16 12 23 17 23 7" />
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
              </svg>
            </div>
            <div className="type-option__name">{tr.meetName}</div>
            <div className="type-option__desc">{tr.meetDesc}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
