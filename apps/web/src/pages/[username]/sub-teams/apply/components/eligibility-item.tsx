import { Check, Clock } from "@/components/icons/lucide";
import { dataBool } from "@/lib/dom";

// app/ratel/src/features/sub_team/pages/apply/component.rs (`EligibilityItem`).

export interface EligibilityItemProps {
  met: boolean;
  title: string;
  desc: string;
}

export function EligibilityItem({ met, title, desc }: EligibilityItemProps) {
  return (
    <div className="elig-item" data-met={dataBool(met)}>
      <div className="elig-item__check">
        {met ? <Check className="w-3 h-3 [&>path]:stroke-current" /> : <Clock className="w-3 h-3 [&>path]:stroke-current" />}
      </div>
      <div className="elig-item__body">
        <div className="elig-item__title">{title}</div>
        <div className="elig-item__desc">{desc}</div>
      </div>
    </div>
  );
}
