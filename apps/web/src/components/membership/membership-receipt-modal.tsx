import { Check } from "@/components/icons/validations";
import { Button, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  useMembershipReceiptI18n,
  type MembershipReceiptI18n,
} from "./membership-receipt.i18n";
import { usePopup } from "@/lib/popup";
import type { UiMembershipTier } from "./membership-tier";

// app/ratel/src/features/membership/components/membership_receipt_modal/mod.rs

export interface MembershipReceiptData {
  txId: string;
  membership: UiMembershipTier;
  amount: number;
  durationDays: number;
  credits: number;
  paidAt: number;
}

function tierLabel(tier: UiMembershipTier, tr: MembershipReceiptI18n): string {
  switch (tier) {
    case "Free":
      return tr.tierFree;
    case "Pro":
      return tr.tierPro;
    case "Max":
      return tr.tierMax;
    case "Vip":
      return tr.tierVip;
    case "Enterprise":
      return tr.tierEnterprise;
  }
}

/** `format_with_commas`. */
function formatWithCommas(value: number): string {
  const sign = value < 0 ? "-" : "";
  const digits = String(Math.abs(Math.trunc(value)));
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** `format_date_time`: local `%Y-%m-%d %H:%M`. */
function formatDateTime(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return String(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MembershipReceiptModal({ receipt }: { receipt: MembershipReceiptData }) {
  const popup = usePopup();
  const tr = useMembershipReceiptI18n();
  const amountText = `₩${formatWithCommas(receipt.amount)}`;
  const durationText = `${receipt.durationDays} ${tr.receiptDays}`;
  const txId = receipt.txId.length > 16 ? `${receipt.txId.slice(0, 16)}...` : receipt.txId;

  return (
    <div className="w-full max-w-[420px]">
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <Check className="w-12 h-12 [&>path]:stroke-primary" />
          </div>
          <h4 className="mb-2 text-lg font-semibold md:text-xl lg:text-2xl text-primary">{tr.receiptTitle}</h4>
          <p className="text-sm text-text-secondary">{tr.receiptThankYou}</p>
        </div>

        <Card>
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.receiptTransactionId}</p>
              <p className="font-mono text-sm text-text-primary">{txId}</p>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.membershipLabel}</p>
              <p className="text-sm font-semibold text-text-primary">{tierLabel(receipt.membership, tr)}</p>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.receiptAmount}</p>
              <h5 className="text-base font-semibold md:text-lg lg:text-xl text-primary">{amountText}</h5>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.receiptDuration}</p>
              <p className="text-sm text-text-primary">{durationText}</p>
            </div>

            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.receiptCredits}</p>
              <p className="text-sm text-text-primary">{formatWithCommas(receipt.credits)}</p>
            </div>

            <div className="h-px bg-border" />

            <div className="flex justify-between items-center">
              <p className="text-sm font-medium text-text-secondary">{tr.receiptPaidAt}</p>
              <p className="text-sm text-text-primary">{formatDateTime(receipt.paidAt)}</p>
            </div>
          </div>
        </Card>

        <Button buttonStyle={ButtonStyle.Primary} onClick={() => popup.close()}>
          {tr.receiptClose}
        </Button>
      </div>
    </div>
  );
}
