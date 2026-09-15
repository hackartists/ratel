import type { ReactNode } from "react";
import { useActionEditTopbarI18n } from "@/i18n/generated/features/spaces/pages/actions/components/action_edit_topbar/action-edit-topbar.i18n";

// app/ratel/src/features/spaces/pages/actions/components/action_edit_topbar.

export interface ActionEditTopbarProps {
  spaceName: string;
  actionTypeLabel: string;
  /** Kebab-case action type (`poll`, `quiz`, `discussion`, `follow`) for the badge accent. */
  actionTypeKey?: string;
  title: string;
  onTitleChange: (value: string) => void;
  onCancel: () => void;
  editableTitle?: boolean;
  /** Extra actions rendered before the Cancel button. */
  rightActions?: ReactNode;
  onBack: () => void;
}

export function ActionEditTopbar({
  spaceName,
  actionTypeLabel,
  actionTypeKey = "",
  title,
  onTitleChange,
  onCancel,
  editableTitle = true,
  rightActions,
  onBack,
}: ActionEditTopbarProps) {
  const tr = useActionEditTopbarI18n();

  return (
    <header className="arena-topbar" role="banner">
      <div className="arena-topbar__left">
        <button className="back-btn" aria-label={tr.back} onClick={() => onBack()}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        {/* `breadcrumb--ae-topbar` lets main.css hide only this breadcrumb on mobile. */}
        <nav className="breadcrumb breadcrumb--ae-topbar">
          <span className="breadcrumb__item">{spaceName}</span>
          <span className="breadcrumb__sep">{"›"}</span>
          <span className="breadcrumb__item breadcrumb__current">{tr.actionsBreadcrumb}</span>
        </nav>
        <span className="type-badge type-badge--ae-topbar" data-action-type={actionTypeKey}>
          {actionTypeLabel}
        </span>
        {editableTitle ? (
          <input
            className="topbar-title-input"
            type="text"
            value={title}
            aria-label={tr.titleAria}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        ) : (
          <span className="topbar-title-input topbar-title-input--readonly">{title}</span>
        )}
      </div>
      <div className="arena-topbar__right">
        {rightActions}
        <button className="btn btn--ghost" onClick={() => onCancel()}>
          {tr.cancel}
        </button>
      </div>
    </header>
  );
}
