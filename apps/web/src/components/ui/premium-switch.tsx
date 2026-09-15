import type * as React from "react";
import { useNavigate } from "react-router-dom";
import { Lock1 } from "@/components/icons/security";
import { usePremiumUnlockI18n } from "./i18n";
import { useUserContext, useUserMembership } from "@/lib/auth";
import { Switch } from "./switch";

// app/ratel/src/common/components/premium_switch — a `Switch` for paid
// members, otherwise an "Unlock" button to the signed-in user's memberships
// page. Rust `UserMembershipResponse::is_paid`: the tier doesn't contain "Free";
// no membership (signed out, or not loaded yet) reads as unpaid.

export interface PremiumSwitchProps {
  active: boolean;
  onToggle: React.MouseEventHandler<HTMLButtonElement>;
  label: string;
  disabled?: boolean;
}

export function PremiumSwitch({ active, onToggle, label, disabled = false }: PremiumSwitchProps) {
  const membership = useUserMembership();
  const isPaid = membership !== null && !membership.tier.includes("Free");

  return isPaid ? (
    <Switch active={active} onToggle={onToggle} label={label} disabled={disabled} />
  ) : (
    <PremiumUnlockButton />
  );
}

function PremiumUnlockButton() {
  const tr = usePremiumUnlockI18n();
  const navigate = useNavigate();
  const username = useUserContext().user?.username ?? "";

  return (
    <button
      type="button"
      className="inline-flex gap-1.5 items-center py-1.5 px-3 text-xs font-semibold rounded-full transition-all bg-primary/10 text-primary hover:bg-primary/20"
      onClick={() => navigate(`/${username}/memberships`)}
    >
      <Lock1 width="14" height="14" className="[&>path]:stroke-current" />
      {tr.unlock}
    </button>
  );
}
