import { useCredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useCredentials } from "../hooks/use-credentials";

// `PrivacyNotice` (credentials/views/mod.rs).
export function PrivacyNotice() {
  const tr = useCredentialsI18n();
  const { summary } = useCredentials();
  // Literal placeholder, as in Rust.
  const didDisplay = summary.did === "" ? "did:web:ratel.foundation:{user}" : summary.did;

  return (
    <div className="privacy">
      <div className="privacy__icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="privacy__body">
        <span className="privacy__title">{tr.privacyTitle}</span>
        <span className="privacy__desc">
          {`${tr.privacyDescPrefix} `}
          <code>{didDisplay}</code>
          {` ${tr.privacyDescSuffix}`}
        </span>
      </div>
    </div>
  );
}
