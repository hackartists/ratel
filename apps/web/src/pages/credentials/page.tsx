import { useNavigate } from "react-router-dom";
import { useCredentialsI18n } from "./credentials.i18n";
import { AttrsGrid } from "./components/attrs-grid";
import { HeroCard } from "./components/hero-card";
import { MethodsSection } from "./components/methods-section";
import { PrivacyNotice } from "./components/privacy-notice";
import { ProofCard } from "./components/proof-card";
import { StatsStrip } from "./components/stats-strip";
import { CredentialsProvider, useCredentialsProvider } from "./hooks/use-credentials";

// `CredentialsHome` (app/ratel/src/route.rs, `/credentials`) →
// app/ratel/src/features/social/pages/credentials/views/mod.rs (`Home`).
export function Component() {
  const tr = useCredentialsI18n();
  const controller = useCredentialsProvider();
  const { summary, exportVc } = controller;
  const navigate = useNavigate();

  return (
    <CredentialsProvider value={controller}>
      <div className="credentials-arena">
        <div className="arena-topbar">
          <div className="arena-topbar__left">
            <button className="back-btn" aria-label={tr.back} onClick={() => navigate(-1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="topbar-title">
              <span className="topbar-title__main">{tr.pageTitle}</span>
              {summary.verified_count > 0 ? (
                <span className="topbar-title__status">{tr.statusVerified}</span>
              ) : (
                <span className="topbar-title__status topbar-title__status--pending">{tr.statusPending}</span>
              )}
            </div>
          </div>
          <button className="topbar-btn" disabled={summary.verified_count === 0} onClick={exportVc}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {tr.exportVc}
          </button>
        </div>

        <div className="page">
          <HeroCard />

          <StatsStrip />

          <div className="section-head">
            <span className="section-head__title">{tr.methodsTitle}</span>
            <span className="section-head__hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {tr.methodsHint}
            </span>
          </div>

          <MethodsSection />

          <div className="section-head">
            <span className="section-head__title">{tr.attrsTitle}</span>
            <span className="section-head__hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {tr.attrsHint}
            </span>
          </div>

          <AttrsGrid />

          <div className="section-head">
            <span className="section-head__title">{tr.proofTitle}</span>
            <span className="section-head__hint">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {tr.proofHint}
            </span>
          </div>

          <ProofCard />

          <PrivacyNotice />
        </div>
      </div>
    </CredentialsProvider>
  );
}
