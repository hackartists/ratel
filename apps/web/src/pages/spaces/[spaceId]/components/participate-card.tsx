import * as React from "react";
import { useParticipateSpace } from "@ratel/ts-bridges/hooks";
import type { PanelRequirementStatus } from "@ratel/ts-bridges";
import { useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useSpaceViewerI18n } from "@/i18n/generated/features/spaces/pages/index/space-viewer.i18n";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/spaces/pages/index/participate_card/component.rs
// (`ParticipateCard` + `ConsentModal`). Participation failures are silent in Rust.

/** `PanelRequirementAttribute` wire value (`"age"`) → its enum variant (`Age`) for `.translate()`. */
export function attributeVariant(attribute: string): "Age" | "Gender" | "University" {
  return `${attribute.charAt(0).toUpperCase()}${attribute.slice(1)}` as "Age" | "Gender" | "University";
}

export function ParticipateCard({
  participants,
  remaining,
  rewards,
  requireConsent = false,
  onJoined,
}: {
  participants: string;
  remaining: string;
  rewards: string;
  requireConsent?: boolean;
  onJoined: () => void;
}) {
  const tr = useSpaceViewerI18n();
  const [showConsent, setShowConsent] = React.useState(false);
  const ctx = useSpaceContext();
  const participate = useParticipateSpace();

  if (showConsent) {
    return (
      <ConsentModal requirements={ctx.panelRequirements} onCancel={() => setShowConsent(false)} onJoined={onJoined} />
    );
  }

  return (
    <div className="participate-card" data-testid="card-participate">
      <span className="participate-card__heading">{tr.joinHeading}</span>
      <p className="participate-card__desc">{tr.joinDesc}</p>
      <div className="participate-card__stats">
        <div className="stat">
          <span className="stat__value">{participants}</span>
          <span className="stat__label">{tr.participants}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{remaining}</span>
          <span className="stat__label">{tr.remaining}</span>
        </div>
        <div className="stat">
          <span className="stat__value">{rewards}</span>
          <span className="stat__label">{tr.rewards}</span>
        </div>
      </div>
      <button
        className="cta-participate"
        data-testid="btn-participate"
        onClick={async () => {
          if (requireConsent) {
            setShowConsent(true);
            return;
          }
          try {
            await participate.mutateAsync({ spaceId: ctx.spaceId, body: { informed_agreed: true } });
          } catch {
            return;
          }
          onJoined();
          void ctx.restart();
        }}
      >
        {tr.participate}
      </button>
    </div>
  );
}

function ConsentModal({
  requirements,
  onCancel,
  onJoined,
}: {
  requirements: PanelRequirementStatus[];
  onCancel: () => void;
  onJoined: () => void;
}) {
  const tr = useSpaceViewerI18n();
  const t = useEnumI18n();
  const [consentChecked, setConsentChecked] = React.useState(false);
  const ctx = useSpaceContext();
  const participate = useParticipateSpace();

  return (
    <div className="consent-card" data-testid="card-consent">
      <span className="consent-card__heading">{tr.consentHeading}</span>
      <p className="consent-card__desc">{tr.consentDesc}</p>

      {requirements.length > 0 && (
        <div className="consent-card__attributes">
          <div className="consent-card__attr-title">{tr.requiredAttributes}</div>
          {requirements.map((requirement, i) => (
            <div key={i} className="consent-card__attr-row" data-satisfied={dataBool(requirement.satisfied)}>
              {requirement.satisfied ? (
                <svg
                  className="consent-card__attr-icon consent-card__attr-icon--ok"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg
                  className="consent-card__attr-icon consent-card__attr-icon--missing"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" x2="12" y1="8" y2="12" />
                  <line x1="12" x2="12.01" y1="16" y2="16" />
                </svg>
              )}
              <span className="consent-card__attr-label">{t("PanelRequirementAttribute", attributeVariant(requirement.attribute))}</span>
              {!requirement.collective && requirement.required_values.length > 0 && (
                <div className="consent-card__attr-values">
                  {requirement.required_values.map((value, j) => (
                    <span
                      key={j}
                      className={
                        requirement.current_value === value
                          ? "consent-card__attr-value consent-card__attr-value--mine"
                          : "consent-card__attr-value consent-card__attr-value--other"
                      }
                    >
                      {value}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <label className="consent-card__checkbox">
        <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.currentTarget.checked)} />
        <span className="consent-card__checkbox-label">{tr.consentLabel}</span>
      </label>

      <div className="consent-card__actions">
        <button className="consent-card__cancel" onClick={() => onCancel()}>
          {tr.consentCancel}
        </button>
        <button
          className="consent-card__confirm"
          data-testid="btn-consent-confirm"
          disabled={!consentChecked}
          onClick={async () => {
            try {
              await participate.mutateAsync({ spaceId: ctx.spaceId, body: { informed_agreed: true } });
            } catch {
              return;
            }
            onJoined();
            void ctx.restart();
          }}
        >
          {tr.consentConfirm}
        </button>
      </div>
    </div>
  );
}
