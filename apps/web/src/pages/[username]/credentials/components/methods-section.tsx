import type { DidSummaryResponse } from "@ratel/ts-bridges";
import type { CredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useUserContext } from "@/lib/auth";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { getPortoneConfig } from "../config";
import { PortOneError, verifyIdentity } from "../interop";
import { CodeModal } from "./code-modal";

// app/ratel/src/features/social/pages/credentials/views/mod.rs
// (`MethodsSection`, `MethodChip`).
export function MethodsSection({
  tr,
  summary,
  onRefresh,
}: {
  tr: CredentialsI18n;
  summary: DidSummaryResponse;
  onRefresh: () => void;
}) {
  const enumText = useEnumI18n();
  const user = useUserContext().user;
  const toast = useToast();
  const popup = usePopup();

  const kycAgeVerified = summary.attributes.some((a) => a.key === "age" && a.verified);
  const kycGenderVerified = summary.attributes.some((a) => a.key === "gender" && a.verified);
  const uniVerified = summary.attributes.some((a) => a.key === "university" && a.verified);
  const kycHasAny = kycAgeVerified && kycGenderVerified;

  const onKyc = async () => {
    if (!user) {
      toast.warn(tr.verificationError);
      return;
    }
    const conf = getPortoneConfig();
    try {
      await verifyIdentity(conf.storeId, conf.inicisChannelKey, user.id);
      onRefresh();
    } catch (err) {
      if (err instanceof PortOneError) {
        toast.error(new Error(enumText("Error", err.code === "request_failed" ? "PortOneRequestFailure" : "PortOneInicisInvalidIdentity")));
      } else {
        toast.error(err);
      }
    }
  };

  const onCode = () => {
    popup.open(<CodeModal tr={tr} onSuccess={onRefresh} />);
  };

  return (
    <div className="methods">
      <div className="method-card method-card--kyc">
        <div className="method-card__head">
          <div className="method-card__badge method-card__badge--kyc">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div className="method-card__head-body">
            <span className="method-card__title">{tr.kycTitle}</span>
            <span className="method-card__sub method-card__sub--kyc">
              {tr.kycSubPrefix} <strong>{tr.kycSubHighlight}</strong>
            </span>
          </div>
        </div>
        <div className="method-card__desc">{tr.kycDesc}</div>
        <div className="method-card__attrs">
          <MethodChip label={tr.attrAge} verified={kycAgeVerified} />
          <MethodChip label={tr.attrGender} verified={kycGenderVerified} />
        </div>
        <button className={kycHasAny ? "method-card__cta method-card__cta--ghost" : "method-card__cta method-card__cta--kyc"} onClick={() => void onKyc()}>
          {kycHasAny ? tr.kycRerun : tr.kycRun}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 4v6h6" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
      </div>

      <div className="method-card method-card--code">
        <div className="method-card__head">
          <div className="method-card__badge method-card__badge--code">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
              <line x1="15" y1="3" x2="15" y2="21" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
            </svg>
          </div>
          <div className="method-card__head-body">
            <span className="method-card__title">{tr.codeTitle}</span>
            <span className="method-card__sub method-card__sub--code">
              {tr.codeSubPrefix} <strong>{tr.codeSubHighlight}</strong>
            </span>
          </div>
        </div>
        <div className="method-card__desc">{tr.codeDesc}</div>
        <div className="method-card__attrs">
          <MethodChip label={tr.attrUniversity} verified={uniVerified} />
          <MethodChip label={tr.attrEmployer} verified={false} />
          <MethodChip label={tr.attrMembership} verified={false} />
        </div>
        <div className="code-hint">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
          <span>{tr.codeHint}</span>
        </div>
        <button className="method-card__cta method-card__cta--code" onClick={onCode}>
          {tr.codeCta}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function MethodChip({ label, verified }: { label: string; verified: boolean }) {
  return (
    <span className={verified ? "method-chip" : "method-chip method-chip--missing"}>
      {verified && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
      {label}
    </span>
  );
}
