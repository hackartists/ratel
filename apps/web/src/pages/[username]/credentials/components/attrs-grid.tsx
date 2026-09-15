import type { DidAttributeItem, DidSummaryResponse } from "@ratel/ts-bridges";
import type { CredentialsI18n } from "@/pages/credentials/credentials.i18n";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useUserContext } from "@/lib/auth";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { attrLabelFor, genderLabel } from "../format";
import { getPortoneConfig } from "../config";
import { PortOneError, verifyIdentity } from "../interop";
import { CodeModal } from "./code-modal";

// app/ratel/src/features/social/pages/credentials/views/mod.rs (`AttrsGrid`,
// `AttrCard`, `attr_icon_for`).
export function AttrsGrid({ tr, summary, onRefresh }: { tr: CredentialsI18n; summary: DidSummaryResponse; onRefresh: () => void }) {
  return (
    <div className="attrs">
      {summary.attributes.map((item) => (
        <AttrCard key={item.key} tr={tr} item={item} onRefresh={onRefresh} />
      ))}
    </div>
  );
}

function AttrCard({ tr, item, onRefresh }: { tr: CredentialsI18n; item: DidAttributeItem; onRefresh: () => void }) {
  const enumText = useEnumI18n();
  const user = useUserContext().user;
  const toast = useToast();
  const popup = usePopup();

  const label = attrLabelFor(item.key, tr);
  const verified = item.verified;
  const cardClass = verified ? "attr-card attr-card--verified" : "attr-card attr-card--unverified";
  const methodClass = item.method === "kyc" ? "attr-card__method attr-card__method--kyc" : "attr-card__method attr-card__method--code";
  const methodLabel = item.method === "kyc" ? tr.methodKyc : tr.methodCode;

  const displayValue = verified ? (item.key === "gender" ? genderLabel(item.value ?? "", tr) : item.value ?? "") : "";

  const unverifiedLabel = item.key === "membership" ? tr.noCodesRedeemed : tr.notVerified;
  const addLabel = item.key === "employer" ? tr.addCodeEmployer : item.key === "membership" ? tr.addCodeMembership : tr.addCodeGeneric;

  const onAdd = () => {
    popup.open(<CodeModal tr={tr} onSuccess={onRefresh} />);
  };

  const onKycRedo = async () => {
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

  return (
    <div className={cardClass}>
      <div className="attr-card__head">
        <div className="attr-card__title">
          <div className="attr-card__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {attrIconFor(item.key)}
            </svg>
          </div>
          <span className="attr-card__label">{label}</span>
        </div>
        <span className={methodClass}>{methodLabel}</span>
      </div>
      {verified ? (
        <>
          <div className="attr-card__value">
            {item.key === "age" ? (
              <>
                <span className="attr-card__value-main">{displayValue}</span>
                <span className="attr-card__value-sub">{tr.attrAgeSub}</span>
              </>
            ) : item.key === "university" || item.key !== "gender" ? (
              <span className="attr-card__value-main attr-card__value-main--text">{displayValue}</span>
            ) : (
              <span className="attr-card__value-main">{displayValue}</span>
            )}
          </div>
          <div className="attr-card__meta">
            {item.method === "kyc" ? (
              <>
                <span className="attr-card__meta-item">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <strong>{tr.metaPortone}</strong> · KCB
                </span>
                <span className="attr-card__meta-item" onClick={() => void onKycRedo()} style={{ cursor: "pointer" }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4v6h6" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                  {tr.kycRerun}
                </span>
              </>
            ) : (
              <span className="attr-card__meta-item">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="3" x2="9" y2="21" />
                  <line x1="15" y1="3" x2="15" y2="21" />
                </svg>
                {tr.metaCodeLabel}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="attr-card__value">
            <span className="attr-card__value-missing">{unverifiedLabel}</span>
          </div>
          <button className="attr-card__add" onClick={onAdd}>
            {addLabel}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

function attrIconFor(key: string) {
  switch (key) {
    case "age":
      return (
        <>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </>
      );
    case "gender":
      return (
        <>
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </>
      );
    case "university":
      return (
        <>
          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
          <path d="M6 12v5c3 3 9 3 12 0v-5" />
        </>
      );
    case "employer":
      return (
        <>
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </>
      );
    default:
      return (
        <>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
      );
  }
}
