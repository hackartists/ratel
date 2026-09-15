import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { getCredentialsHandler, getDidSummaryHandler, signAttributesHandler } from "@ratel/ts-bridges";
import { useCredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useUserContext } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { AttrsGrid } from "./components/attrs-grid";
import { HeroCard } from "./components/hero-card";
import { MethodsSection } from "./components/methods-section";
import { ProofCard, PrivacyNotice } from "./components/proof-and-privacy";
import { StatsStrip } from "./components/stats-strip";
import { buildVcDocument } from "./format";
import { clearKycHistory, exportVcDownload, takePgReturnId } from "./interop";

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`Home`): the
// `/:username/credentials` route (same page for a user's own wall — the
// route is only reachable for the signed-in user's own username since
// `get_did_summary_handler` / `get_credentials_handler` read the caller's own
// `did`/attributes; team walls fall through the `SocialLayout` team-arena
// branch instead, so this page never renders there).
export function Component() {
  const tr = useCredentialsI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const user = useUserContext().user;
  const queryClient = useQueryClient();

  const summaryKey = ["getDidSummary"] as const;
  const credentialKey = ["getCredentials"] as const;
  const summary = useSuspenseQuery({ queryKey: summaryKey, queryFn: getDidSummaryHandler }).data;
  // Rust also loads this but only uses it to warm the cache — never rendered.
  useSuspenseQuery({ queryKey: credentialKey, queryFn: getCredentialsHandler });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: summaryKey });
    void queryClient.invalidateQueries({ queryKey: credentialKey });
  };

  // PortOne identity verification on WebView/mobile redirects the whole
  // window to the PG page and returns here with the result in the query
  // string (the original verify-identity call was dropped when the page
  // navigated away). On mount, pick up that result, finalize the
  // credential, and refresh. No-op on desktop (popup flow resolves inline).
  useEffect(() => {
    const id = takePgReturnId();
    if (id == null) return;
    void (async () => {
      try {
        await signAttributesHandler({ type: "port_one", id });
        toast.info(tr.verificationSuccess);
        refresh();
        clearKycHistory();
      } catch (err) {
        toast.error(err);
        clearKycHistory();
      }
    })();
    // Run once on mount only, like the Rust `use_effect` (empty capture besides `id`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fallbackDid = user ? `did:web:ratel.foundation:${user.username}` : "-";

  const onExport = () => {
    const json = JSON.stringify(buildVcDocument(summary), null, 2);
    exportVcDownload(json);
  };

  return (
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
        <button className="topbar-btn" disabled={summary.verified_count === 0} onClick={onExport}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {tr.exportVc}
        </button>
      </div>

      <div className="page">
        <HeroCard tr={tr} summary={summary} fallbackDid={fallbackDid} />

        <StatsStrip tr={tr} summary={summary} />

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

        <MethodsSection tr={tr} summary={summary} onRefresh={refresh} />

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

        <AttrsGrid tr={tr} summary={summary} onRefresh={refresh} />

        <div className="section-head">
          <span className="section-head__title">{tr.proofTitle}</span>
          <span className="section-head__hint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            {tr.proofHint}
          </span>
        </div>

        <ProofCard tr={tr} summary={summary} />

        <PrivacyNotice tr={tr} did={summary.did} />
      </div>
    </div>
  );
}
