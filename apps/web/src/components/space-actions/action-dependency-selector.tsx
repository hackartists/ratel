import { useState } from "react";
import type { SpaceActionSummary } from "@ratel/ts-bridges";
import { useUpdateSpaceAction } from "@ratel/ts-bridges/hooks";
import { ContentAlign, PopoverContent, PopoverRoot, PopoverTrigger } from "@/components/ui/popover";
import { useActionDependencySelectorI18n } from "./action-dependency-selector.i18n";
import { useToast } from "@/lib/toast";
import { useSpaceActionList } from "./use-space-action-list";

// app/ratel/src/features/spaces/pages/actions/components/action_dependency_selector —
// picks the actions a participant must finish before this one unlocks. Follow
// actions and anything that already depends (transitively) on this action are
// excluded so no cycle can be created.

export interface ActionDependencySelectorProps {
  spaceId: string;
  actionId: string;
  initialDependsOn: string[];
  onChanged?: (next: string[]) => void;
}

export function ActionDependencySelector({ spaceId, actionId, initialDependsOn, onChanged }: ActionDependencySelectorProps) {
  const tr = useActionDependencySelectorI18n();
  const toast = useToast();
  const [dependsOn, setDependsOn] = useState<string[]>(initialDependsOn);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const update = useUpdateSpaceAction();

  const actions = useSpaceActionList(spaceId);
  const selected = dependsOn;

  const blockedByCycle = new Set<string>();
  const frontier = [actionId];
  while (frontier.length > 0) {
    const id = frontier.pop() as string;
    for (const a of actions) {
      if (a.depends_on.includes(id) && !blockedByCycle.has(a.action_id)) {
        blockedByCycle.add(a.action_id);
        frontier.push(a.action_id);
      }
    }
  }

  const available: SpaceActionSummary[] = actions.filter(
    (a) =>
      a.action_id !== actionId &&
      !selected.includes(a.action_id) &&
      a.action_type !== "Follow" &&
      a.action_type !== "Announcement" &&
      !blockedByCycle.has(a.action_id),
  );

  const save = (next: string[]) => {
    if (saving) return;
    setSaving(true);
    update
      .mutateAsync({ spaceId, actionId, req: { depends_on: next } })
      .then(() => {
        setDependsOn(next);
        onChanged?.(next);
      })
      .catch((e) => toast.error(e))
      .finally(() => setSaving(false));
  };

  const selectedView = actions.filter((a) => selected.includes(a.action_id));
  const hasAvailable = available.length > 0;
  const hasSelected = selectedView.length > 0;

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="font-medium text-[12px]/[16px] text-foreground-muted">{tr.dependsOnHint}</span>

      {!hasAvailable && !hasSelected ? (
        <span className="font-medium italic text-[12px]/[16px] text-foreground-muted">{tr.noActionsAvailable}</span>
      ) : (
        <div className="flex flex-wrap gap-2">
          {selectedView.map((dep) => (
            <button
              key={dep.action_id}
              type="button"
              className="inline-flex gap-1.5 items-center py-1 px-2.5 font-medium rounded-full bg-primary/10 text-[12px]/[16px] text-primary"
              onClick={() => save(selected.filter((id) => id !== dep.action_id))}
            >
              <span>{dep.title}</span>
              <span>×</span>
            </button>
          ))}

          {hasAvailable && (
            <PopoverRoot open={menuOpen} onOpenChange={setMenuOpen}>
              <PopoverTrigger className="inline-flex gap-1 items-center py-1 px-2.5 font-medium rounded-full border border-separator text-[12px]/[16px] text-foreground-muted hover:bg-hover">
                {tr.addDependency}
              </PopoverTrigger>
              {/* `align: Start` anchors the popover's left edge to the trigger's. */}
              <PopoverContent align={ContentAlign.Start}>
                <div className="flex flex-col gap-1 p-2 min-w-[220px] border rounded-[10px] border-separator bg-popover shadow-lg">
                  {available.map((action) => (
                    <button
                      key={action.action_id}
                      type="button"
                      className="py-2 px-3 text-left rounded-[8px] text-[13px]/[18px] text-text-primary hover:bg-hover"
                      onClick={() => {
                        save([...selected, action.action_id]);
                        setMenuOpen(false);
                      }}
                    >
                      {action.title}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </PopoverRoot>
          )}
        </div>
      )}
    </div>
  );
}
