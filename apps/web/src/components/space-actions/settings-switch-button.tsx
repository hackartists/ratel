import * as React from "react";
import { LineArrowLeft } from "@/components/icons/arrows";
import { Settings2 } from "@/components/icons/settings";
import { Button, ButtonShape, ButtonSize, ButtonStyle } from "@/components/ui/button";
import { useSettingsSwitchButtonI18n } from "@/i18n/generated/features/spaces/pages/actions/components/settings_switch_button/settings-switch-button.i18n";
import { useActionSpace, useActionSpaceRole } from "./space-data";

// app/ratel/src/features/spaces/pages/actions/components/settings_switch_button.
//
// `ActionEditMode` is provided by each `*ActionPage` dispatcher. When true a
// creator sees the configuration view even after the action started.

export interface ActionEditMode {
  editMode: boolean;
  setEditMode: (value: boolean) => void;
}

export const ActionEditModeContext = React.createContext<ActionEditMode | null>(null);

/** The dispatcher's `ActionEditMode(Signal::new(initial))`, seeded once. */
export function useActionEditModeState(initial: boolean): ActionEditMode {
  const [editMode, setEditMode] = React.useState(initial);
  return React.useMemo(() => ({ editMode, setEditMode }), [editMode]);
}

export function useActionEditMode(): ActionEditMode {
  const ctx = React.useContext(ActionEditModeContext);
  if (!ctx) throw new Error("useActionEditMode must be used under ActionEditModeContext");
  return ctx;
}

/** Floating button that toggles a creator between the participant and the configuration view. */
export function SettingsSwitchButton({ spaceId }: { spaceId: string }) {
  const tr = useSettingsSwitchButtonI18n();
  const { currentRole } = useActionSpaceRole(spaceId); // space-context: use_space_role()
  const space = useActionSpace(spaceId); // space-context: use_space()
  const { editMode, setEditMode } = useActionEditMode();

  if (currentRole !== "Creator") return null;
  // Once the space has ended creators lose the settings entry point too.
  if (space.status === "Processing" || space.status === "Finished") return null;

  return (
    <div className="flex justify-end items-center mb-2 w-full">
      <Button
        buttonStyle={ButtonStyle.Outline}
        shape={ButtonShape.Rounded}
        size={ButtonSize.Small}
        data-testid="action-settings-switch"
        onClick={() => setEditMode(!editMode)}
      >
        {editMode ? (
          <div className="flex flex-row items-center gap-1">
            <LineArrowLeft width="16" height="16" className="[&>path]:stroke-current" />
            <span>{tr.backToParticipant}</span>
          </div>
        ) : (
          <div className="flex flex-row items-center gap-1">
            <Settings2
              width="16"
              height="16"
              className="[&>path]:stroke-current [&>circle]:stroke-current [&>path]:fill-none [&>circle]:fill-none"
            />
            <span>{tr.settings}</span>
          </div>
        )}
      </Button>
    </div>
  );
}
