import { useState } from "react";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { Switch } from "@/components/ui/switch";
import { usePrerequisiteTileI18n } from "./prerequisite-tile.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/actions/components/prerequisite_tile —
// toggles whether the action is required to join the space (optimistic, rolled
// back on failure).

export interface PrerequisiteTileProps {
  spaceId: string;
  actionId: string;
  initialPrerequisite: boolean;
  onChanged?: (value: boolean) => void;
}

export function PrerequisiteTile({ spaceId, actionId, initialPrerequisite, onChanged }: PrerequisiteTileProps) {
  const tr = usePrerequisiteTileI18n();
  const toast = useToast();
  const [prereq, setPrereq] = useState(initialPrerequisite);
  const update = useUpdateSpaceAction();

  const toggle = () => {
    const next = !prereq;
    setPrereq(next);
    update
      .mutateAsync({ spaceId, actionId, req: { prerequisite: next } })
      .then(() => onChanged?.(next))
      .catch((err) => {
        toast.error(err);
        setPrereq(!next);
      });
  };

  return (
    <div className="tile" data-testid="tile-prereq">
      <span className="tile__label">{tr.title}</span>
      <div className="tile__row">
        <span style={{ fontSize: "13px", color: "var(--qc-text-muted)" }}>{tr.description}</span>
        <Switch active={prereq} onToggle={toggle} label={tr.title} />
      </div>
    </div>
  );
}
