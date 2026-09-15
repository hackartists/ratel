import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getPanelRequirements } from "@ratel/ts-bridges";
import type { PanelRequirementStatus } from "@ratel/ts-bridges";
import { spaceQueryKeys, useSpaceContext } from "@/components/space/space-context";
import { useEnumI18n } from "@/i18n/enums.i18n";
import { useSpaceViewerI18n } from "./space-viewer.i18n";
import { useUserContext } from "@/lib/auth";
import { dataBool } from "@/lib/dom";
import { PORTONE_INICIS_CHANNEL_KEY, PORTONE_STORE_ID, verifyIdentity } from "@/lib/identity-verification";
import { useToast } from "@/lib/toast";
import { attributeVariant } from "./participate-card";

// app/ratel/src/features/spaces/pages/index/verification_card/component.rs (`VerificationCard`):
// PortOne identity verification, then re-reads the panel requirements; all satisfied →
// `on_verified(next)`, otherwise the "still missing" error line.

export function VerificationCard({
  requirements,
  onVerified,
}: {
  requirements: PanelRequirementStatus[];
  onVerified: (next: PanelRequirementStatus[]) => void;
}) {
  const tr = useSpaceViewerI18n();
  const t = useEnumI18n();
  const toast = useToast();
  const { spaceId } = useSpaceContext();
  const user = useUserContext().user;
  const queryClient = useQueryClient();
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const onVerify = async () => {
    // Rust `user_ctx().user_id().unwrap_or_default()` — `User::id()`.
    const prefix = user ? user.id : "";
    try {
      await verifyIdentity(PORTONE_STORE_ID, PORTONE_INICIS_CHANNEL_KEY, prefix);
    } catch (err) {
      toast.error(err);
      return;
    }
    let next: PanelRequirementStatus[];
    try {
      next = await queryClient.fetchQuery({
        queryKey: spaceQueryKeys.panelRequirements(spaceId),
        queryFn: () => getPanelRequirements(spaceId),
        staleTime: 0,
      });
    } catch (err) {
      toast.error(err);
      return;
    }
    if (next.every((r) => r.satisfied)) {
      setErrorMessage(null);
      onVerified(next);
    } else {
      setErrorMessage(tr.verificationFailed);
    }
  };

  return (
    <div className="verification-card" data-testid="card-verification">
      <span className="verification-card__heading">{tr.verificationHeading}</span>

      <div className="verification-card__alert">
        <svg
          className="verification-card__alert-icon"
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
        {tr.verificationAlert}
      </div>

      {errorMessage !== null && <div className="verification-card__error">{errorMessage}</div>}

      <div className="verification-card__requirements">
        <div className="verification-card__req-title">{tr.requiredAttributes}</div>
        {requirements.map((requirement, i) => (
          <div key={i} className="verification-card__req-row" data-satisfied={dataBool(requirement.satisfied)}>
            {requirement.satisfied ? (
              <svg
                className="verification-card__req-icon verification-card__req-icon--ok"
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
                className="verification-card__req-icon verification-card__req-icon--missing"
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
            <span className="verification-card__req-label">{t("PanelRequirementAttribute", attributeVariant(requirement.attribute))}</span>
            {!requirement.collective && requirement.required_values.length > 0 && (
              <div className="verification-card__req-values">
                {requirement.required_values.map((value, j) => (
                  <span
                    key={j}
                    className={
                      requirement.current_value === value
                        ? "verification-card__req-value verification-card__req-value--mine"
                        : "verification-card__req-value verification-card__req-value--other"
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

      <button className="cta-verify" data-testid="btn-verify" onClick={() => void onVerify()}>
        {tr.verifyCredentials}
      </button>
    </div>
  );
}
