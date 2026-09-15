import { useMembershipPlanI18n } from "./i18n";
import { useLanguage } from "@/lib/language";
import { useMembershipPlan } from "../hooks/use-membership-plan";
import { MembershipCard } from "./membership-card";
import { membershipPlanItems } from "./membership-plan-items";

// app/ratel/src/features/membership/components/membership_plan/mod.rs
// (`MembershipPlan`, `MembershipPlanHeader`).

export function MembershipPlanHeader() {
  const tr = useMembershipPlanI18n();
  return (
    <div className="flex flex-col gap-2.5 items-center text-center">
      <h1 className="text-3xl font-bold md:text-4xl lg:text-5xl text-text-primary">{tr.title}</h1>
      {/* The translation carries its own markup (Rust `dangerous_inner_html`). */}
      <div className="text-[17px]/[20px] text-text-secondary" dangerouslySetInnerHTML={{ __html: tr.description }} />
    </div>
  );
}

export function MembershipPlan() {
  const memberships = membershipPlanItems(useLanguage() === "ko");
  const { selectPlan } = useMembershipPlan();

  return (
    <div className="py-8 px-4 mx-auto w-full max-w-desktop">
      <MembershipPlanHeader />
      <div className="gap-2.5 mt-8 membership-plan-grid">
        {memberships.map((membership, idx) => (
          <MembershipCard
            key={membership.name}
            membership={membership}
            variant={idx + 1 === memberships.length ? "horizontal" : "vertical"}
            onClick={() => selectPlan(membership)}
          />
        ))}
      </div>
    </div>
  );
}
