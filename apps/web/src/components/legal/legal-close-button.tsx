import { useLocation, useNavigate } from "react-router-dom";
import { useLegalCloseI18n } from "@/i18n/generated/views/legal-close.i18n";

// app/ratel/src/views/legal_close.rs — the "X" on the standalone legal pages
// (privacy, terms, child safety). Pops history like Dioxus `nav.go_back()`;
// with nothing to pop (opened directly by URL) it falls back to home.
export function LegalCloseButton() {
  const tr = useLegalCloseI18n();
  const navigate = useNavigate();
  // React Router marks the first entry of a session with key "default",
  // which is Dioxus `nav.can_go_back() == false`.
  const canGoBack = useLocation().key !== "default";

  return (
    <button
      type="button"
      className="legal-close"
      aria-label={tr.close}
      data-testid="legal-close"
      onClick={() => {
        if (canGoBack) navigate(-1);
        else navigate("/");
      }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}
