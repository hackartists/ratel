import type { UiMembershipTier } from "@/components/membership/membership-tier";
import { useTeamSubscriptionI18n } from "@/pages/[username]/settings/subscription/i18n";

// `TierCard` / `EnterpriseCard` of app/ratel/src/features/social/pages/setting/team/views/subscription_page/mod.rs.

export type FeatureLine = { kind: "plain"; text: string } | { kind: "strong"; prefix: string; strong: string; suffix: string };

export type PriceDisplay = { kind: "amount"; amount: string } | { kind: "monthly"; prefix: string; amount: string; suffix: string };

export interface TierCardProps {
  tier: UiMembershipTier;
  currentTier: UiMembershipTier;
  name: string;
  desc: string;
  features: FeatureLine[];
  price: PriceDisplay;
  ctaLabel?: string;
  ribbon?: string;
  onClick: () => void;
}

const MOD_CLASS: Partial<Record<UiMembershipTier, string>> = {
  Pro: " tier-card--pro",
  Max: " tier-card--max",
  Vip: " tier-card--vip",
};

export function TierCard({ tier, currentTier, name, desc, features, price, ctaLabel, ribbon, onClick }: TierCardProps) {
  const tr = useTeamSubscriptionI18n();
  const isCurrent = tier === currentTier;

  return (
    <div className={`tier-card${MOD_CLASS[tier] ?? ""}`}>
      {ribbon !== undefined && <div className="tier-card__ribbon">{ribbon}</div>}

      <div className="tier-card__head">
        <div className="tier-card__name">{name}</div>
        <div className="tier-card__desc">{desc}</div>
      </div>

      <div className="tier-card__features">
        {features.map((line, idx) => (
          <div key={idx} className="feature">
            <span className="feature__dot" />
            {line.kind === "plain" ? (
              <span>{line.text}</span>
            ) : (
              <span>
                {line.prefix}
                <strong>{line.strong}</strong>
                {line.suffix}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="tier-card__price">
        {price.kind === "amount" ? (
          <span className="tier-card__price-amt">{price.amount}</span>
        ) : (
          <>
            <span className="tier-card__price-prefix">{price.prefix}</span>
            <span className="tier-card__price-amt">{price.amount}</span>
            <span className="tier-card__price-suffix">{price.suffix}</span>
          </>
        )}
      </div>

      {isCurrent ? (
        <button className="tier-btn tier-btn--current" disabled>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {tr.ctaCurrent}
        </button>
      ) : (
        ctaLabel !== undefined && (
          <button className="tier-btn" type="button" onClick={() => onClick()}>
            {ctaLabel}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        )
      )}
    </div>
  );
}

export interface EnterpriseCardProps {
  name: string;
  desc: string;
  feat1: string;
  feat2: string;
  pricePrefix: string;
  priceAmount: string;
  ctaLabel: string;
  onClick: () => void;
}

export function EnterpriseCard({ name, desc, feat1, feat2, pricePrefix, priceAmount, ctaLabel, onClick }: EnterpriseCardProps) {
  return (
    <div className="enterprise-card">
      <div className="enterprise-card__left">
        <div className="enterprise-card__name">{name}</div>
        <div className="enterprise-card__desc">{desc}</div>
      </div>
      <div className="enterprise-card__features">
        <div className="feature">
          <span className="feature__dot" />
          <span>{feat1}</span>
        </div>
        <div className="feature">
          <span className="feature__dot" />
          <span>{feat2}</span>
        </div>
      </div>
      <div className="enterprise-card__cta">
        <div className="enterprise-card__price">
          {pricePrefix}
          <strong>{priceAmount}</strong>
        </div>
        <button className="tier-btn" type="button" onClick={() => onClick()}>
          {ctaLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
