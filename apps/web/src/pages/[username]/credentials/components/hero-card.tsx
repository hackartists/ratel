import type { DidSummaryResponse } from "@ratel/ts-bridges";
import type { CredentialsI18n } from "@/i18n/generated/features/social/pages/credentials/views/credentials.i18n";
import { formatDate, YEAR_MS } from "../format";

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`HeroCard`,
// `render_qr_placeholder`) — decorative-only static QR silhouette; replace
// with a real QR render once the VC resolver endpoint is live (same TODO as
// the Rust source).
const QR_PLACEHOLDER_SVG =
  '<svg width="100%" height="100%" viewBox="0 0 29 29" xmlns="http://www.w3.org/2000/svg"><rect width="29" height="29" fill="#ffffff"/><g fill="#0a0a0a"><rect x="0" y="0" width="7" height="7"/><rect x="1" y="1" width="5" height="5" fill="#ffffff"/><rect x="2" y="2" width="3" height="3"/><rect x="22" y="0" width="7" height="7"/><rect x="23" y="1" width="5" height="5" fill="#ffffff"/><rect x="24" y="2" width="3" height="3"/><rect x="0" y="22" width="7" height="7"/><rect x="1" y="23" width="5" height="5" fill="#ffffff"/><rect x="2" y="24" width="3" height="3"/><rect x="9" y="3" width="2" height="1"/><rect x="12" y="3" width="1" height="1"/><rect x="14" y="3" width="3" height="1"/><rect x="19" y="3" width="2" height="1"/><rect x="8" y="8" width="1" height="1"/><rect x="10" y="8" width="2" height="1"/><rect x="13" y="8" width="1" height="1"/><rect x="15" y="8" width="1" height="1"/><rect x="17" y="8" width="3" height="1"/><rect x="21" y="8" width="1" height="1"/><rect x="9" y="10" width="2" height="1"/><rect x="12" y="10" width="1" height="1"/><rect x="14" y="10" width="2" height="1"/><rect x="17" y="10" width="1" height="1"/><rect x="19" y="10" width="2" height="1"/><rect x="22" y="10" width="2" height="1"/><rect x="8" y="12" width="1" height="1"/><rect x="10" y="12" width="1" height="1"/><rect x="12" y="12" width="3" height="1"/><rect x="16" y="12" width="2" height="1"/><rect x="19" y="12" width="1" height="1"/><rect x="21" y="12" width="3" height="1"/><rect x="9" y="14" width="3" height="1"/><rect x="13" y="14" width="1" height="1"/><rect x="15" y="14" width="3" height="1"/><rect x="19" y="14" width="2" height="1"/><rect x="22" y="14" width="1" height="1"/><rect x="8" y="16" width="2" height="1"/><rect x="11" y="16" width="1" height="1"/><rect x="13" y="16" width="2" height="1"/><rect x="16" y="16" width="1" height="1"/><rect x="18" y="16" width="2" height="1"/><rect x="21" y="16" width="2" height="1"/></g></svg>';

export function HeroCard({
  tr,
  summary,
  fallbackDid,
}: {
  tr: CredentialsI18n;
  summary: DidSummaryResponse;
  fallbackDid: string;
}) {
  const didDisplay = summary.did === "" ? fallbackDid : summary.did;
  const issuedAt = summary.issued_at > 0 ? summary.issued_at : Date.now();
  const expiresAt = issuedAt + YEAR_MS;

  return (
    <div className="vc-hero">
      <div className="vc-hero__main">
        <div className="vc-hero__eyebrow">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{tr.heroEyebrow}</span>
          <span style={{ color: "var(--text-dim)" }}>·</span>
          <strong>{tr.heroMethods}</strong>
        </div>
        <div className="vc-hero__crest">
          <div className="vc-hero__shield">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div className="vc-hero__crest-body">
            <span className="vc-hero__crest-title">{tr.heroCrestTitle}</span>
            <span className="vc-hero__crest-sub">{tr.heroCrestSub}</span>
          </div>
        </div>
        <div className="vc-hero__did">
          <span className="vc-hero__did-label">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            {tr.heroDidLabel}
          </span>
          <div className="vc-hero__did-value">
            <span className="vc-hero__did-value-text" data-did-value="true">
              {didDisplay}
            </span>
            <button className="vc-hero__did-copy" aria-label={tr.heroCopyDid} data-did-copy="true">
              <svg className="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg className="icon-ok" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="vc-hero__meta">
          <span className="vc-hero__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {tr.heroIssued} <strong>{formatDate(issuedAt)}</strong>
          </span>
          <span className="vc-hero__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {tr.heroExpires} <strong>{formatDate(expiresAt)}</strong>
          </span>
          <span className="vc-hero__meta-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <strong>{summary.verified_count}</strong>/{summary.total_slots} {tr.heroVerifiedCount}
          </span>
        </div>
      </div>
      <div className="vc-hero__qr" aria-label={tr.heroQrHint}>
        <div className="vc-hero__qr-canvas" dangerouslySetInnerHTML={{ __html: QR_PLACEHOLDER_SVG }} />
        <span className="vc-hero__qr-hint">{tr.heroQrHint}</span>
      </div>
    </div>
  );
}
