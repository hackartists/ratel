import type { ListResponse } from "@ratel/ts-bridges";
import { useMembershipPageI18n } from "./membership-page.i18n";
import type { PurchaseHistoryItem } from "../hooks/use-membership";
import { formatDate } from "./format";

// app/ratel/src/features/social/pages/membership/user/components/purchase_history.rs (`PurchaseHistory`)
export function PurchaseHistory({ history }: { history: ListResponse<PurchaseHistoryItem> }) {
  const tr = useMembershipPageI18n();

  if (history.items.length === 0) {
    return <div className="py-8 text-center text-text-secondary">{tr.noPurchases}</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-card-border">
            <th className="py-3 px-2 text-sm font-semibold text-left text-text-secondary">{tr.transactionType}</th>
            <th className="py-3 px-2 text-sm font-semibold text-left text-text-secondary">{tr.amount}</th>
            <th className="py-3 px-2 text-sm font-semibold text-left text-text-secondary">{tr.paymentId}</th>
            <th className="py-3 px-2 text-sm font-semibold text-left text-text-secondary">{tr.date}</th>
          </tr>
        </thead>
        <tbody>
          {history.items.map((item, idx) => (
            <tr key={idx} className="border-b last:border-0 border-card-border">
              <td className="py-3 px-2 text-sm text-text-primary">{item.tx_type}</td>
              <td className="py-3 px-2 text-sm text-text-primary">{`$${item.amount}`}</td>
              <td className="py-3 px-2 font-mono text-xs text-text-secondary">{item.payment_id}</td>
              <td className="py-3 px-2 text-sm text-text-secondary">{formatDate(item.created_at, tr.unlimited)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
