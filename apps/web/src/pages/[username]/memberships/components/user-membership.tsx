import { Sparkles } from "@/components/icons/lucide";
import { useMembershipPageI18n } from "./membership-page.i18n";
import { useUserMembership } from "../hooks/use-membership";
import { formatDate, formatMembershipTierLabel } from "./format";
import { PurchaseHistory } from "./purchase-history";

// Tier label → colour, verbatim from user/views/mod.rs:365-370 (the labels are
// Rust string literals outside `translate!`).
function tierColorOf(tierName: string): string {
  switch (tierName) {
    case "Pro":
      return "text-blue-500";
    case "Max":
      return "text-purple-500";
    case "Vip":
      return "text-amber-500";
    default:
      return "text-text-secondary";
  }
}

// app/ratel/src/features/social/pages/membership/user/views/mod.rs (`user::Home`)
export function UserMembership() {
  const tr = useMembershipPageI18n();
  const { membership, history } = useUserMembership();

  const tierName = formatMembershipTierLabel(membership.tier, tr.enterprise);
  const tierColor = tierColorOf(tierName);

  return (
    <div className="flex flex-col gap-6 p-6 mx-auto w-full max-w-4xl">
      <h1 className="text-2xl font-bold text-text-primary">{tr.title}</h1>

      <div className="p-6 rounded-lg border bg-card-bg border-card-border">
        <h2 className="mb-4 text-xl font-semibold text-text-primary">{tr.currentPlan}</h2>

        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-center">
            <Sparkles className={`w-6 h-6 ${tierColor}`} />
            <div>
              <div className="text-sm text-text-secondary">{tr.tier}</div>
              <div className={`text-lg font-bold ${tierColor}`}>{tierName}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-text-secondary">{tr.totalCredits}</div>
              <div className="text-lg font-semibold text-text-primary">{membership.total_credits}</div>
            </div>
            <div>
              <div className="text-sm text-text-secondary">{tr.remainingCredits}</div>
              <div className="text-lg font-semibold text-text-primary">{membership.remaining_credits}</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-text-secondary">{tr.expiration}</div>
            <div className="text-lg font-semibold text-text-primary">
              {formatDate(membership.expired_at, tr.unlimited)}
            </div>
          </div>

          {membership.next_membership != null && (
            <div className="p-3 rounded border bg-background-secondary border-amber-500/30">
              <div className="text-sm font-semibold text-amber-500">{tr.scheduledDowngrade}</div>
              <div className="text-sm text-text-secondary">
                {`${tr.nextMembership}: ${formatMembershipTierLabel(membership.next_membership, tr.enterprise)}`}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-lg border bg-card-bg border-card-border">
        <h2 className="mb-4 text-xl font-semibold text-text-primary">{tr.purchaseHistory}</h2>

        <PurchaseHistory history={history} />
      </div>
    </div>
  );
}
