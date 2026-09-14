import { useCallback, useEffect, useRef } from "react";
import type { ChangeMembershipRequest, MembershipTier as ApiMembershipTier } from "@ratel/ts-bridges";
import { useChangeMembership, useIdentify } from "@ratel/ts-bridges/hooks";
import { useLoginModal } from "@/components/auth";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { usePopup } from "@/lib/popup";
import { portoneEnv } from "@/lib/portone";
import { useToast } from "@/lib/toast";
import { MembershipPurchaseModal, type CustomerInfo } from "../components/membership-purchase-modal";
import { MembershipReceiptModal } from "../components/membership-receipt-modal";
import { MembershipTier, type MembershipPlanItem } from "../components/membership-plan-items";
import { requestIdentityVerification, stashMembershipTier, takeMembershipReturn } from "./identity";

// Controller for app/ratel/src/features/membership/components/membership_plan/mod.rs
// (`MembershipPlan`): plan selection (login gate, enterprise mailto, PortOne
// identity verification), the purchase modal, `change_membership_handler`, the
// receipt modal, and resuming the flow after a WebView PortOne redirect.

/** Toast text hardcoded (untranslated) in the Rust source: `toast.info("Membership downgrade scheduled")`. */
const DOWNGRADE_SCHEDULED = "Membership downgrade scheduled";

/**
 * Signed-out plan click title. Rust:
 * `popup.open(rsx! { LoginModal {} }).with_title("Join the Movement")` (hardcoded,
 * untranslated; nothing happens after login).
 */
const LOGIN_TITLE = "Join the Movement";

/** `display_amount_for_tier`. */
function displayAmountForTier(tier: MembershipTier, isKo: boolean): number {
  const base = tier === MembershipTier.Pro ? 20 : tier === MembershipTier.Max ? 50 : tier === MembershipTier.Vip ? 100 : 0;
  return isKo ? base * 1500 : base;
}

/** `tier_key` / `tier_from_key`: the sessionStorage marker values. */
function tierKey(tier: MembershipTier): string {
  return tier === MembershipTier.Pro ? "pro" : tier === MembershipTier.Max ? "max" : tier === MembershipTier.Vip ? "vip" : "";
}
function tierFromKey(key: string): MembershipTier | null {
  return key === "pro" ? MembershipTier.Pro : key === "max" ? MembershipTier.Max : key === "vip" ? MembershipTier.Vip : null;
}

/** UI tier → the API `MembershipTier` wire string (DynamoEnum Display: UPPER_SNAKE, `ENTERPRISE#<inner>`). */
function apiTier(tier: MembershipTier): ApiMembershipTier {
  switch (tier) {
    case MembershipTier.Free:
      return "FREE";
    case MembershipTier.Pro:
      return "PRO";
    case MembershipTier.Max:
      return "MAX";
    case MembershipTier.Vip:
      return "VIP";
    case MembershipTier.Enterprise:
      return "ENTERPRISE#Enterprise";
  }
}

/** API wire tier → UI tier (DynamoEnum FromStr accepts any casing). */
function tierFromApi(tier: ApiMembershipTier): MembershipTier {
  const upper = tier.toUpperCase();
  if (upper === "PRO") return MembershipTier.Pro;
  if (upper === "MAX") return MembershipTier.Max;
  if (upper === "VIP") return MembershipTier.Vip;
  if (upper === "ENTERPRISE" || upper.startsWith("ENTERPRISE#")) return MembershipTier.Enterprise;
  return MembershipTier.Free;
}

interface TauriWindow {
  __TAURI_INTERNALS__?: { invoke?: (cmd: string, args?: unknown) => Promise<unknown> };
}

/**
 * `enterprise_contact`. In the Android/iOS app `window.open("mailto:…")` does
 * nothing, so the Tauri build (`tauri-web` in Rust, `VITE_TAURI=1` here) asks
 * the opener plugin to open the mail app; the web build keeps `window.open`.
 */
function enterpriseContact(): void {
  const email = "hi@ratel.foundation";
  const subject = "Enterprise Membership Inquiry";
  const body =
    "Hello,%0D%0A%0D%0AI would like to learn more about the Enterprise membership plan.%0D%0A%0D%0AThank you.";
  const mailtoUrl = `mailto:${email}?subject=${subject}&body=${body}`;
  if (import.meta.env.VITE_TAURI === "1") {
    const invoke = (window as unknown as TauriWindow).__TAURI_INTERNALS__?.invoke;
    if (typeof invoke !== "function") {
      console.error("open enterprise contact mailto failed: Tauri bridge unavailable");
      return;
    }
    invoke("plugin:opener|open_url", { url: mailtoUrl }).catch((e: unknown) =>
      console.error("open enterprise contact mailto failed:", e),
    );
    return;
  }
  window.open(mailtoUrl);
}

export interface UseMembershipPlan {
  /** A plan card's button (Rust `MembershipCard::on_click`). */
  selectPlan: (membership: MembershipPlanItem) => void;
}

export function useMembershipPlan(): UseMembershipPlan {
  const { loggedIn, userContext } = useAuth();
  const popup = usePopup();
  const loginModal = useLoginModal();
  const toast = useToast();
  const te = useEnumI18n();
  const isKo = useLanguage() === "ko";
  const identify = useIdentify();
  const changeMembership = useChangeMembership();

  // Rust reads these with `option_env!(..).unwrap_or_default()` (no placeholder).
  const storeId = portoneEnv.storeId ?? "";
  const channelKey = portoneEnv.inicisChannelKey ?? "";

  const confirmPurchase = useCallback(
    async (tier: MembershipTier, info: CustomerInfo) => {
      const req: ChangeMembershipRequest = {
        membership: apiTier(tier),
        currency: "KRW",
        cardInfo: {
          card_number: info.cardNumber,
          expiry_year: info.expiryYear,
          expiry_month: info.expiryMonth,
          birth_or_business_registration_number: info.birthOrBiz,
          password_two_digits: info.cardPassword,
        },
      };
      try {
        const resp = await changeMembership.mutateAsync(req);
        const membership = resp.membership;
        if (!membership) {
          toast.error(new Error(te("Error", "MembershipResponseMissing")));
          popup.close();
          return;
        }
        if (resp.receipt) {
          popup.open(
            <MembershipReceiptModal
              receipt={{
                txId: resp.receipt.tx_id,
                membership: tierFromApi(membership.tier),
                amount: resp.receipt.amount,
                durationDays: membership.duration_days,
                credits: membership.credits,
                paidAt: resp.receipt.paid_at,
              }}
            />,
          );
        } else {
          toast.info(DOWNGRADE_SCHEDULED);
          popup.close();
        }
      } catch (err) {
        console.error("Failed to change membership:", err);
        toast.error(new Error(te("Error", "MembershipChangeFailed")));
        popup.close();
      }
    },
    [changeMembership.mutateAsync, popup, te, toast],
  );

  /** `open_membership_purchase`: finalize identity, then the purchase modal (no close button). */
  const openPurchase = useCallback(
    async (tier: MembershipTier, identityId: string) => {
      const displayAmount = displayAmountForTier(tier, isKo);
      let customer;
      try {
        customer = await identify.mutateAsync({ id: identityId });
      } catch (err) {
        console.error("Failed to verify identity:", err);
        return;
      }
      popup.open(
        <MembershipPurchaseModal
          membership={tier}
          displayAmount={displayAmount}
          customer={customer}
          onConfirm={(info) => void confirmPurchase(tier, info)}
        />,
        { closable: false },
      );
    },
    [confirmPurchase, identify.mutateAsync, isKo, popup],
  );

  const selectPlan = useCallback(
    (membership: MembershipPlanItem) => {
      if (!loggedIn) {
        loginModal.open({ title: LOGIN_TITLE });
        return;
      }
      switch (membership.tier) {
        case MembershipTier.Enterprise:
          enterpriseContact();
          return;
        case MembershipTier.Pro:
        case MembershipTier.Max:
        case MembershipTier.Vip: {
          const tier = membership.tier;
          const prefix = userContext.user ? String(userContext.user.pk) : "";
          void (async () => {
            await stashMembershipTier(tierKey(tier));
            // On mobile this navigates away (redirect) and resumes on return.
            let identityId: unknown;
            try {
              identityId = await requestIdentityVerification(storeId, channelKey, prefix);
            } catch (err) {
              console.error("identity verification failed:", err instanceof Error ? err.message : err);
              return;
            }
            if (typeof identityId !== "string") {
              console.error("identity verification: missing id");
              return;
            }
            await openPurchase(tier, identityId);
          })();
          return;
        }
        case MembershipTier.Free:
          return;
      }
    },
    [channelKey, loggedIn, loginModal, openPurchase, storeId, userContext.user],
  );

  // Resume after a WebView PortOne redirect back to /membership (no-op on desktop).
  const openPurchaseRef = useRef(openPurchase);
  openPurchaseRef.current = openPurchase;
  const returnStarted = useRef(false);
  useEffect(() => {
    if (returnStarted.current) return;
    returnStarted.current = true;
    void (async () => {
      const ret = await takeMembershipReturn();
      if (!ret) return;
      const [identityId, key] = ret;
      const tier = tierFromKey(key);
      if (tier) await openPurchaseRef.current(tier, identityId);
    })();
  }, []);

  return { selectPlan };
}
