import { useCallback, useEffect, useRef } from "react";
import { useLoginModal } from "@/components/auth";
import {
  openEnterpriseContact,
  requestIdentityVerification,
  stashMembershipTier,
  takeMembershipReturn,
} from "@/components/membership/interop";
import { MembershipPurchaseModal, type CustomerInfo } from "@/components/membership/membership-purchase-modal";
import { MembershipReceiptModal } from "@/components/membership/membership-receipt-modal";
import { apiTierToUi, type UiMembershipTier } from "@/components/membership/membership-tier";
import { useRouteUsername, useTeamArena } from "@/components/social/use-wall-context";
import { useEnumI18n } from "@/i18n/generated/enums.i18n";
import { useTeamSubscriptionI18n } from "@/i18n/generated/features/social/pages/setting/team/views/subscription_page/team-subscription.i18n";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/language";
import { usePopup } from "@/lib/popup";
import { useToast } from "@/lib/toast";
import { EnterpriseCard, TierCard } from "./components/tier-card";
import { ViewerPage } from "./components/viewer-page";
import { useTeamSubscription } from "./hooks/use-team-subscription";

// app/ratel/src/features/social/pages/setting/team/views/subscription_page/mod.rs
// (`SubscriptionPage`, `/:username/settings/subscription`). The PortOne SDK
// `<script>` the Rust page re-injects is loaded once globally by the app shell.

/** `display_amount_for_tier`. */
function displayAmountForTier(tier: UiMembershipTier, isKo: boolean): number {
  const base = tier === "Pro" ? 20 : tier === "Max" ? 50 : tier === "Vip" ? 100 : 0;
  return isKo ? base * 1500 : base;
}

/** `tier_key` / `tier_from_key`. */
const TIER_KEYS: Partial<Record<UiMembershipTier, string>> = { Pro: "pro", Max: "max", Vip: "vip" };
function tierFromKey(key: string): UiMembershipTier | null {
  return key === "pro" ? "Pro" : key === "max" ? "Max" : key === "vip" ? "Vip" : null;
}

export function Component() {
  const username = useRouteUsername();
  // wall-context: `use_team_arena()` — `can_edit` gate; `active_tab = TeamArenaTab::Subscription` is layout-owned.
  const arena = useTeamArena(username);
  if (!arena.canEdit) return <ViewerPage username={username} />;
  return <SubscriptionPage username={username} />;
}

function SubscriptionPage({ username }: { username: string }) {
  const tr = useTeamSubscriptionI18n();
  const enumText = useEnumI18n();
  const lang = useLanguage();
  const auth = useAuth();
  const popup = usePopup();
  const toast = useToast();
  const loginModal = useLoginModal();
  const { currentTier, identifyTeam, changeMembership, restartCurrent } = useTeamSubscription(username);

  const isKo = lang === "ko";
  const portoneStoreId = import.meta.env.VITE_PORTONE_STORE_ID ?? "";
  const portoneChannelKey = import.meta.env.VITE_PORTONE_INICIS_CHANNEL_KEY ?? "";

  // Finalize identity and open the purchase modal. Shared by the desktop popup
  // path and the mobile WebView redirect return.
  const proceedPurchase = useCallback(
    async (tier: UiMembershipTier, identityId: string) => {
      const displayAmount = displayAmountForTier(tier, isKo);
      let customer;
      try {
        customer = await identifyTeam(identityId);
      } catch (err) {
        console.error("Failed to verify identity:", err);
        return;
      }
      const onConfirm = async (info: CustomerInfo) => {
        try {
          const resp = await changeMembership(tier, {
            card_number: info.cardNumber,
            expiry_year: info.expiryYear,
            expiry_month: info.expiryMonth,
            birth_or_business_registration_number: info.birthOrBiz,
            password_two_digits: info.cardPassword,
          });
          const membershipResp = resp.membership;
          if (!membershipResp) {
            toast.error(enumText("Error", "MembershipResponseMissing"));
            popup.close();
            return;
          }
          // Refresh the current-tier loader so the "Current Plan" badge moves.
          restartCurrent();
          if (resp.receipt) {
            popup.open(
              <MembershipReceiptModal
                receipt={{
                  txId: resp.receipt.tx_id,
                  membership: apiTierToUi(membershipResp.tier),
                  amount: resp.receipt.amount,
                  durationDays: membershipResp.duration_days,
                  credits: membershipResp.credits,
                  paidAt: resp.receipt.paid_at,
                }}
              />,
            );
          } else {
            toast.info("Membership downgrade scheduled");
            popup.close();
          }
        } catch (err) {
          console.error("Failed to change team membership:", err);
          toast.error(enumText("Error", "MembershipChangeFailed"));
          popup.close();
        }
      };
      popup.open(
        <MembershipPurchaseModal
          membership={tier}
          displayAmount={displayAmount}
          customer={customer}
          onConfirm={(info) => void onConfirm(info)}
        />,
        { closable: false },
      );
    },
    [isKo, identifyTeam, changeMembership, restartCurrent, toast, enumText, popup],
  );

  // Resume the purchase flow after a mobile WebView PortOne redirect. No-op on desktop.
  const proceedRef = useRef(proceedPurchase);
  proceedRef.current = proceedPurchase;
  useEffect(() => {
    const ret = takeMembershipReturn();
    if (!ret) return;
    const tier = tierFromKey(ret[1]);
    if (tier) void proceedRef.current(tier, ret[0]);
  }, []);

  const onTierClick = async (tier: UiMembershipTier) => {
    const user = auth.userContext.user;
    if (!user) {
      loginModal.open({ title: "Join the Movement" });
      return;
    }
    switch (tier) {
      case "Enterprise":
        openEnterpriseContact();
        return;
      case "Pro":
      case "Max":
      case "Vip": {
        const prefix = user.pk;
        // Stash the tier so a mobile WebView redirect can resume the purchase.
        stashMembershipTier(TIER_KEYS[tier] ?? "");
        let identityId: string;
        try {
          const id: unknown = await requestIdentityVerification(portoneStoreId, portoneChannelKey, prefix);
          if (typeof id !== "string") {
            console.error("identity verification: missing id");
            return;
          }
          identityId = id;
        } catch (err) {
          console.error("identity verification failed:", err instanceof Error ? err.message : err);
          return;
        }
        await proceedPurchase(tier, identityId);
        return;
      }
      case "Free":
        return;
    }
  };

  return (
    <div className="ts-sub-page">
      {/* Section label */}
      <div className="section-label">
        <span className="section-label__dash" />
        <span className="section-label__title">
          {`${tr.sectionLabelPrefix} `}
          <strong>{tr.sectionLabelStrong}</strong>
        </span>
        <span className="section-label__dash" />
      </div>

      {/* Hero */}
      <div className="hero">
        <h1 className="hero__title">
          {tr.heroTitleEn}
          <span className="hero__title-ko">{tr.heroTitleKo}</span>
        </h1>
        <p className="hero__desc">
          {tr.heroDescPrefix}
          <strong>{tr.heroDescCredits}</strong>
          {tr.heroDescMiddle}
          <em>{tr.heroDescRewardSpace}</em>
          {tr.heroDescSuffix}
        </p>
      </div>

      {/* Page */}
      <div className="page">
        <div className="tier-grid">
          <TierCard
            tier="Free"
            currentTier={currentTier}
            name={tr.freeName}
            desc={tr.freeDesc}
            features={[
              { kind: "plain", text: tr.freeFeat1 },
              { kind: "plain", text: tr.freeFeat2 },
              { kind: "plain", text: tr.freeFeat3 },
              { kind: "plain", text: tr.freeFeat4 },
            ]}
            price={{ kind: "amount", amount: tr.freePriceAmount }}
            // Rust `on_click: move |_| {}` on the Free card, which has no CTA to call it.
            onClick={() => void onTierClick("Free")}
          />

          <TierCard
            tier="Pro"
            currentTier={currentTier}
            name={tr.proName}
            desc={tr.proDesc}
            features={[
              { kind: "plain", text: tr.proFeat1 },
              { kind: "strong", prefix: tr.proFeat2Prefix, strong: tr.proFeat2Strong, suffix: tr.proFeat2Suffix },
              { kind: "plain", text: tr.proFeat3 },
              { kind: "plain", text: tr.proFeat4 },
            ]}
            price={{ kind: "monthly", prefix: tr.pricePrefix, amount: "30,000", suffix: tr.priceSuffixKrw }}
            ctaLabel={tr.ctaApplyPro}
            onClick={() => void onTierClick("Pro")}
          />

          <TierCard
            tier="Max"
            currentTier={currentTier}
            name={tr.maxName}
            desc={tr.maxDesc}
            features={[
              { kind: "plain", text: tr.maxFeat1 },
              { kind: "strong", prefix: tr.maxFeat2Prefix, strong: tr.maxFeat2Strong, suffix: tr.maxFeat2Suffix },
              { kind: "plain", text: tr.maxFeat3 },
              { kind: "plain", text: tr.maxFeat4 },
              { kind: "plain", text: tr.maxFeat5 },
            ]}
            price={{ kind: "monthly", prefix: tr.pricePrefix, amount: "75,000", suffix: tr.priceSuffixKrw }}
            ctaLabel={tr.ctaApplyMax}
            onClick={() => void onTierClick("Max")}
          />

          <TierCard
            tier="Vip"
            currentTier={currentTier}
            name={tr.vipName}
            desc={tr.vipDesc}
            features={[
              { kind: "plain", text: tr.vipFeat1 },
              { kind: "strong", prefix: tr.vipFeat2Prefix, strong: tr.vipFeat2Strong, suffix: tr.vipFeat2Suffix },
              { kind: "plain", text: tr.vipFeat3 },
              { kind: "plain", text: tr.vipFeat4 },
              { kind: "plain", text: tr.vipFeat5 },
              { kind: "plain", text: tr.vipFeat6 },
            ]}
            price={{ kind: "monthly", prefix: tr.pricePrefix, amount: "150,000", suffix: tr.priceSuffixKrw }}
            ctaLabel={tr.ctaApplyVip}
            ribbon={tr.vipRibbon}
            onClick={() => void onTierClick("Vip")}
          />
        </div>

        {/* Enterprise wide card */}
        <EnterpriseCard
          name={tr.enterpriseName}
          desc={tr.enterpriseDesc}
          feat1={tr.enterpriseFeat1}
          feat2={tr.enterpriseFeat2}
          pricePrefix={tr.enterprisePrice}
          priceAmount={tr.enterprisePriceAmount}
          ctaLabel={tr.enterpriseCta}
          onClick={() => void onTierClick("Enterprise")}
        />

        {/* Footer note */}
        <div className="footer-note">{tr.footerNote}</div>
      </div>
    </div>
  );
}
