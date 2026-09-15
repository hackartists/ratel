import { useTeamMembershipI18n } from "./team-membership.i18n";
import { useTeamMembership } from "../hooks/use-membership";
import { formatExpiry, formatF64NoDecimals, formatMembershipTierLabel, formatTeamDate, I64_MAX } from "./format";

type TeamMembershipI18n = ReturnType<typeof useTeamMembershipI18n>;

type Tier = "Free" | "Pro" | "Max" | "Vip" | "Enterprise";

/** team/views/mod.rs:741 `tier_from_label` (case-insensitive). */
function tierFromLabel(label: string): Tier {
  switch (label.toLowerCase()) {
    case "pro":
      return "Pro";
    case "max":
      return "Max";
    case "vip":
      return "Vip";
    case "free":
      return "Free";
    default:
      return "Enterprise";
  }
}

/** team/views/mod.rs:751 `tier_modifier` + the `"current-card{mod_class}"` class. */
function currentCardClass(t: Tier): string {
  switch (t) {
    case "Free":
      return "current-card current-card--free";
    case "Pro":
      return "current-card current-card--pro";
    case "Max":
      return "current-card current-card--max";
    case "Vip":
      return "current-card current-card--vip";
    case "Enterprise":
      return "current-card current-card--ent";
  }
}

/** team/views/mod.rs:761 `tier_desc`. */
function tierDesc(t: Tier, tr: TeamMembershipI18n): string {
  switch (t) {
    case "Free":
      return tr.tierFreeDesc;
    case "Pro":
      return tr.tierProDesc;
    case "Max":
      return tr.tierMaxDesc;
    case "Vip":
      return tr.tierVipDesc;
    case "Enterprise":
      return tr.tierEnterpriseDesc;
  }
}

// app/ratel/src/features/social/pages/membership/team/views/mod.rs (`team::Home`)
export function TeamMembership({ username }: { username: string }) {
  const tr = useTeamMembershipI18n();
  const { membership, history } = useTeamMembership(username);

  if (membership === null) {
    return (
      <div className="tm-status-page">
        <div className="hero">
          <h1 className="hero__title">
            {tr.heroTitleEn}
            <span className="hero__title-ko">{tr.heroTitleKo}</span>
          </h1>
          <p className="hero__desc">{tr.noPermission}</p>
        </div>
      </div>
    );
  }

  const tierName = formatMembershipTierLabel(membership.tier, tr.enterpriseLabel);
  const tier = tierFromLabel(tierName);
  const desc = tierDesc(tier, tr);

  const remaining = Math.max(membership.remaining_credits, 0);
  const total = Math.max(membership.total_credits, 1);
  const pct = Math.min(Math.max((remaining / total) * 100, 0), 100);
  const pctText = formatF64NoDecimals(pct);

  const expiry = formatExpiry(membership.expired_at, tr.expiresUnlimited);
  const showAutoRenew = membership.expired_at !== I64_MAX && membership.expired_at !== 0;

  const nextTierLabel =
    membership.next_membership != null
      ? formatMembershipTierLabel(membership.next_membership, tr.enterpriseLabel)
      : null;

  const historyLen = history.length;
  const countSuffix = historyLen === 1 ? tr.historyCountSuffixOne : tr.historyCountSuffixMany;

  return (
    <div className="tm-status-page">
      <div className="section-label">
        <span className="section-label__dash" />
        <span className="section-label__title">
          {`${tr.sectionLabelPrefix} `}
          <strong>{tr.sectionLabelStrong}</strong>
        </span>
        <span className="section-label__dash" />
      </div>

      <div className="hero">
        <h1 className="hero__title">
          {tr.heroTitleEn}
          <span className="hero__title-ko">{tr.heroTitleKo}</span>
        </h1>
        <p className="hero__desc">
          {tr.heroDescPrefix}
          <strong>{tr.heroDescCredits}</strong>
          {tr.heroDescSuffix}
        </p>
      </div>

      <div className="page">
        <div className={currentCardClass(tier)}>
          <div className="cc-tier">
            <span className="cc-tier__label">{tr.currentPlanLabel}</span>
            <div className="cc-tier__name">{tierName}</div>
            <div className="cc-tier__desc">{desc}</div>
          </div>

          <div className="cc-stat">
            <span className="cc-stat__label">{tr.creditsLabel}</span>
            <div className="cc-stat__value-row">
              <span className="cc-stat__value cc-stat__value--tier">{remaining}</span>
              <span className="cc-stat__suffix">{`/ ${total}`}</span>
            </div>
            <div>
              <div className="cc-progress">
                <div className="cc-progress__fill" style={{ width: `${pctText}%` }} />
              </div>
              <div className="cc-progress__meta">
                <span>{tr.creditsRemainingHint}</span>
                <span>{`${pctText}%`}</span>
              </div>
            </div>
          </div>

          <div className="cc-expire">
            <span className="cc-stat__label">{tr.expiresLabel}</span>
            <div className="cc-expire__date">{expiry}</div>
            {showAutoRenew && <div className="cc-expire__hint">{tr.expiresAutoRenew}</div>}
          </div>

          {nextTierLabel !== null && (
            <div className="cc-footer">
              <div className="cc-footer__icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div className="cc-footer__text">
                {tr.downgradePrefix}
                <strong>{nextTierLabel}</strong>
                {tr.downgradeSuffix}
              </div>
            </div>
          )}
        </div>

        <div className="history-card">
          <div className="history-card__header">
            <span className="history-card__title">{tr.historyTitle}</span>
            <span className="history-card__count">{`${historyLen} ${countSuffix}`}</span>
          </div>

          {history.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty__icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="history-empty__title">{tr.historyEmptyTitle}</div>
              <div className="history-empty__desc">{tr.historyEmptyDesc}</div>
            </div>
          ) : (
            <table className="history-table">
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "26%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>{tr.thType}</th>
                  <th className="num">{tr.thAmount}</th>
                  <th>{tr.thPaymentId}</th>
                  <th className="date">{tr.thDate}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={idx}>
                    <td data-label={tr.thType}>
                      <span className="history-chip">{item.tx_type}</span>
                    </td>
                    <td className="num" data-label={tr.thAmount}>
                      {`₩${item.amount}`}
                    </td>
                    <td className="mono" data-label={tr.thPaymentId}>
                      {item.payment_id}
                    </td>
                    <td className="date" data-label={tr.thDate}>
                      {formatTeamDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
