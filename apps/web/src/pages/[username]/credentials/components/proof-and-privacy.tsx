import type { DidSummaryResponse } from "@ratel/ts-bridges";
import type { CredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { formatDateTimeUtc } from "../format";

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`ProofCard`).
export function ProofCard({ tr, summary }: { tr: CredentialsI18n; summary: DidSummaryResponse }) {
  const issued = summary.issued_at > 0 ? formatDateTimeUtc(summary.issued_at) : "—";
  const subject = summary.did === "" ? "—" : summary.did;
  const issuerDisplay = "did:web:ratel.foundation:issuer#key-1";

  return (
    <div className="proof">
      <div className="proof__col">
        <div className="proof__col-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          {tr.proofMeta}
        </div>
        <div className="proof__row">
          <span>{tr.proofFormat}</span>
          <span>{tr.proofFormatValue}</span>
        </div>
        <div className="proof__row">
          <span>{tr.proofSuite}</span>
          <span>{tr.proofSuiteValue}</span>
        </div>
        <div className="proof__row">
          <span>{tr.proofSubject}</span>
          <span>{subject}</span>
        </div>
        <div className="proof__row">
          <span>{tr.proofIssued}</span>
          <span>{issued}</span>
        </div>
      </div>
      <div className="proof__col">
        <div className="proof__col-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          {tr.proofSigTitle}
        </div>
        <div className="proof__row proof__row--ok">
          <span>{tr.proofIssuerKey}</span>
          <span>{tr.proofIssuerKeyValue}</span>
        </div>
        <div className="proof__row proof__row--ok">
          <span>{tr.proofIntegrity}</span>
          <span>{tr.proofIntegrityValue}</span>
        </div>
        <div className="proof__row proof__row--ok">
          <span>{tr.proofRevocation}</span>
          <span>{tr.proofRevocationValue}</span>
        </div>
        <div className="proof__sig">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>
            {tr.proofSignedBy} <strong>{issuerDisplay}</strong> {tr.proofSignedBySuffix}
          </span>
        </div>
      </div>
    </div>
  );
}

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`PrivacyNotice`).
export function PrivacyNotice({ tr, did }: { tr: CredentialsI18n; did: string }) {
  const didDisplay = did === "" ? "did:web:ratel.foundation:{user}" : did;
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
          {tr.privacyDescPrefix} <code>{didDisplay}</code> {tr.privacyDescSuffix}
        </span>
      </div>
    </div>
  );
}
