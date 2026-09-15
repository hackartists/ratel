import { useState } from "react";
import type { VerifiedCustomer } from "@ratel/ts-bridges";
import { Button, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, InputType } from "@/components/ui/input";
import {
  useMembershipPurchaseI18n,
  type MembershipPurchaseI18n,
} from "./membership-purchase.i18n";
import { useLanguage } from "@/lib/language";
import { usePopup } from "@/lib/popup";
import type { UiMembershipTier } from "./membership-tier";

// app/ratel/src/features/membership/components/membership_purchase_modal/mod.rs

export interface CustomerInfo {
  name: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  birthOrBiz: string;
  cardPassword: string;
}

function tierLabel(tier: UiMembershipTier, tr: MembershipPurchaseI18n): string {
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

const digits = (value: string) => value.replace(/[^0-9]/g, "");

export interface MembershipPurchaseModalProps {
  membership: UiMembershipTier;
  displayAmount: number;
  customer: VerifiedCustomer;
  onConfirm: (info: CustomerInfo) => void;
}

export function MembershipPurchaseModal({ membership, displayAmount, customer, onConfirm }: MembershipPurchaseModalProps) {
  const popup = usePopup();
  const tr = useMembershipPurchaseI18n();
  const lang = useLanguage();
  const currency = lang === "ko" ? "₩" : "$";
  const amountText = `${currency}${displayAmount}`;
  const customerName = customer.name;

  const [cardNumber, setCardNumber] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [birthOrBiz, setBirthOrBiz] = useState("");
  const [cardPassword, setCardPassword] = useState("");

  const isValid =
    customerName.trim() !== "" &&
    cardNumber.trim() !== "" &&
    expiryMonth.trim() !== "" &&
    expiryYear.trim() !== "" &&
    birthOrBiz.trim() !== "" &&
    cardPassword.trim() !== "";

  return (
    <div className="w-full max-w-[420px]">
      <div className="flex flex-col gap-5">
        {/* Membership Summary */}
        <Card>
          <div className="flex justify-between items-center w-full">
            <div className="flex flex-col gap-1">
              <h4 className="text-lg font-semibold text-text-primary">
                {tierLabel(membership, tr)} {tr.membershipLabel}
              </h4>
              <p className="text-sm text-text-secondary">{tr.monthlySubscription}</p>
            </div>
            <h3 className="text-xl font-semibold text-primary">{amountText}</h3>
          </div>
        </Card>

        {/* Customer Information Form */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-text-primary">{tr.fullNameLabel}</label>
            <Input value={customerName} disabled readOnly />
          </div>

          <div className="pt-4">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block mb-2 text-sm font-medium text-text-primary">{tr.cardNumberLabel}</label>
                <Input
                  placeholder={tr.cardNumberPlaceholder}
                  maxLength={16}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(digits(e.target.value))}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-text-primary">{tr.expiryLabel}</label>
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    placeholder={tr.expiryMonthPlaceholder}
                    maxLength={2}
                    value={expiryMonth}
                    onChange={(e) => setExpiryMonth(digits(e.target.value))}
                  />
                  <Input
                    className="flex-1"
                    placeholder={tr.expiryYearPlaceholder}
                    maxLength={2}
                    value={expiryYear}
                    onChange={(e) => setExpiryYear(digits(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-text-primary">{tr.birthOrBizLabel}</label>
                <Input
                  placeholder={tr.birthOrBizPlaceholder}
                  maxLength={10}
                  value={birthOrBiz}
                  onChange={(e) => setBirthOrBiz(digits(e.target.value))}
                />
              </div>

              <div>
                <label className="block mb-2 text-sm font-medium text-text-primary">{tr.cardPasswordLabel}</label>
                <Input
                  className="w-20"
                  type={InputType.Password}
                  placeholder={tr.cardPasswordPlaceholder}
                  maxLength={2}
                  value={cardPassword}
                  onChange={(e) => setCardPassword(digits(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-4 justify-end mt-4">
          <Button buttonStyle={ButtonStyle.Outline} onClick={() => popup.close()}>
            {tr.cancelButton}
          </Button>
          <Button
            buttonStyle={ButtonStyle.Primary}
            disabled={!isValid}
            onClick={() => {
              if (!isValid) return;
              onConfirm({ name: customerName, cardNumber, expiryMonth, expiryYear, birthOrBiz, cardPassword });
            }}
          >
            {tr.confirmButton}
          </Button>
        </div>
      </div>
    </div>
  );
}
