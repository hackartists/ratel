import { useState } from "react";
import type { SpaceActionStatus } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { Button, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { useActionStatusControlI18n } from "@/i18n/generated/features/spaces/pages/actions/components/action_status_control/action-status-control.i18n";
import { useToast } from "@/lib/toast";

// app/ratel/src/features/spaces/pages/actions/components/action_status_control —
// shows the action lifecycle and moves it one step: legacy → Designing →
// Ongoing (publish) → Finish (close).

export interface ActionStatusControlProps {
  spaceId: string;
  actionId: string;
  initialStatus: SpaceActionStatus | null;
  onChanged?: (status: SpaceActionStatus) => void;
}

export function ActionStatusControl({ spaceId, actionId, initialStatus, onChanged }: ActionStatusControlProps) {
  const tr = useActionStatusControlI18n();
  const toast = useToast();
  const [status, setStatus] = useState<SpaceActionStatus | null>(initialStatus);
  const [saving, setSaving] = useState(false);
  const update = useUpdateSpaceAction();

  const transition = async (next: SpaceActionStatus) => {
    if (saving) return;
    setSaving(true);
    try {
      await update.mutateAsync({ spaceId, actionId, req: { status: next } });
      setStatus(next);
      onChanged?.(next);
    } catch (e) {
      toast.error(e);
    }
    setSaving(false);
  };

  const badgeLabel =
    status === null
      ? tr.statusLegacy
      : status === "Designing"
        ? tr.statusDesigning
        : status === "Ongoing"
          ? tr.statusOngoing
          : tr.statusFinish;

  return (
    <div className="flex gap-3 justify-between items-center w-full">
      <span className="font-medium text-[12px]/[16px] text-foreground-muted">{badgeLabel}</span>
      {status === null && (
        <Button
          size={ButtonSize.Small}
          buttonStyle={ButtonStyle.Primary}
          disabled={saving}
          onClick={() => void transition("Designing")}
        >
          {tr.activate}
        </Button>
      )}
      {status === "Designing" && (
        <Button
          size={ButtonSize.Small}
          buttonStyle={ButtonStyle.Primary}
          disabled={saving}
          data-testid="action-publish"
          onClick={() => void transition("Ongoing")}
        >
          {tr.publish}
        </Button>
      )}
      {status === "Ongoing" && (
        <Button
          size={ButtonSize.Small}
          buttonStyle={ButtonStyle.Outline}
          disabled={saving}
          data-testid="action-close"
          onClick={() => void transition("Finish")}
        >
          {tr.close}
        </Button>
      )}
      {status === "Finish" && (
        <Button size={ButtonSize.Small} buttonStyle={ButtonStyle.Text} disabled>
          {tr.closed}
        </Button>
      )}
    </div>
  );
}
