import { useNavigate } from "react-router-dom";
import { useEssenceSourcesI18n } from "@/pages/essence/i18n";

// app/ratel/src/features/essence/pages/sources/topbar/component.rs
export function EssenceTopbar() {
  const tr = useEssenceSourcesI18n();
  const navigate = useNavigate();

  return (
    <div className="essence-topbar">
      <div className="essence-topbar__left">
        <button className="essence-topbar__back" aria-label={tr.backLabel} onClick={() => navigate(-1)}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="essence-topbar__title">
          <span className="essence-topbar__eyebrow">{tr.topbarEyebrow}</span>
          <span className="essence-topbar__main">{tr.topbarMain}</span>
        </div>
      </div>
    </div>
  );
}
