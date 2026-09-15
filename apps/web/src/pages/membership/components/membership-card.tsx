import { Check } from "@/components/icons/validations";
import { Button, ButtonStyle } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { MembershipPlanItem } from "./membership-plan-items";

// app/ratel/src/features/membership/components/membership_card/mod.rs.

export interface MembershipCardProps {
  membership: MembershipPlanItem;
  variant: "horizontal" | "vertical";
  onClick: () => void;
}

function Features({ features }: { features: string[] }) {
  return (
    <div className="flex flex-col flex-1 gap-3 text-[15px]/[20px] text-text-primary">
      {features.map((feature) => (
        <div key={feature} className="flex gap-3 items-center">
          <Check className="w-[13px] h-[13px] min-w-[13px] [&>path]:stroke-primary" />
          {feature}
        </div>
      ))}
    </div>
  );
}

export function MembershipCard({ membership, variant, onClick }: MembershipCardProps) {
  if (variant === "horizontal") {
    return (
      <Card className="flex flex-col justify-start items-start w-full min-h-70 membership-plan-span-full">
        <div className="flex flex-col gap-5 w-full h-full">
          <h3 className="text-base font-semibold md:text-lg lg:text-xl text-text-primary">{membership.name}</h3>
          <p className="font-semibold text-[17px]/[20px] text-text-primary">{membership.description}</p>
          <Features features={membership.features} />
          {membership.price !== null && (
            <div className="flex justify-between items-center w-full">
              <p className="font-semibold text-[17px]/[20px] text-text-primary">{membership.price}</p>
              {membership.btn !== null && (
                <Button buttonStyle={ButtonStyle.Secondary} onClick={onClick}>
                  {membership.btn}
                </Button>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col justify-start items-start w-full min-h-140">
      <div className="flex flex-col gap-5 h-full">
        <h3 className="text-base font-semibold md:text-lg lg:text-xl text-text-primary">{membership.name}</h3>
        <p className="font-semibold text-[17px]/[20px] text-text-primary">{membership.description}</p>
        <Features features={membership.features} />
        {membership.price !== null && (
          <p className="font-semibold text-[17px]/[20px] text-text-primary">{membership.price}</p>
        )}
        {membership.btn !== null && (
          <div className="flex justify-end w-full">
            <Button buttonStyle={ButtonStyle.Secondary} onClick={onClick}>
              {membership.btn}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
