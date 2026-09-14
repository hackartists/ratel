import * as React from "react";
import type { SpaceVisibility as ApiSpaceVisibility } from "@ratel/ts-bridges";
import { Internet } from "@/components/icons/internet-script";
import { Lock1 } from "@/components/icons/security";
import { Button, ButtonShape, ButtonStyle } from "@/components/ui/button";
import { useSpaceCommonSpaceVisibilityModalVisibilityModalI18n } from "@/i18n/generated/features/spaces/space_common/components/space_visibility_modal/space-common-space-visibility-modal-visibility-modal.i18n";
import { usePopup } from "@/lib/popup";
import { SpaceVisibility } from "./space-context";

// app/ratel/src/features/spaces/space_common/components/space_visibility_modal/mod.rs
// (`SpaceVisibilityModal`). Confirm calls `on_confirm(selected)` and closes the popup;
// Cancel calls `on_cancel` and closes it.

const CARD_SELECTED =
  "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors border-primary bg-primary/10";
const CARD_IDLE =
  "flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-colors border-border hover:border-text-tertiary";
const RADIO_SELECTED = "w-5 h-5 rounded-full border-2 flex items-center justify-center border-primary";
const RADIO_IDLE = "w-5 h-5 rounded-full border-2 flex items-center justify-center border-text-tertiary";

export interface SpaceVisibilityModalProps {
  /** Rust default `SpaceVisibility::Private`. */
  initial?: ApiSpaceVisibility;
  onConfirm: (visibility: ApiSpaceVisibility) => void;
  onCancel?: (e: React.MouseEvent) => void;
}

export function SpaceVisibilityModal({ initial = SpaceVisibility.Private, onConfirm, onCancel }: SpaceVisibilityModalProps) {
  const tr = useSpaceCommonSpaceVisibilityModalVisibilityModalI18n();
  const popup = usePopup();
  const [selected, setSelected] = React.useState(initial);
  const isPublic = selected === SpaceVisibility.Public;

  return (
    <div className="flex flex-col gap-6 max-w-full w-[400px]">
      <div className="flex flex-col gap-1">
        <div className="text-lg font-bold text-center text-text-primary">{tr.title}</div>
        <div className="text-sm text-center text-text-secondary">{tr.description}</div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className={isPublic ? CARD_SELECTED : CARD_IDLE}
          data-testid="public-option"
          onClick={() => setSelected(SpaceVisibility.Public)}
        >
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-primary/15 shrink-0">
            <Internet className="w-5 h-5 [&>path]:stroke-primary [&>path]:fill-none [&>circle]:stroke-primary [&>circle]:fill-none [&>ellipse]:stroke-primary [&>ellipse]:fill-none" />
          </div>
          <div className="flex flex-col gap-0.5 items-start">
            <span className="text-sm font-semibold text-text-primary">{tr.publicLabel}</span>
            <span className="text-xs text-text-secondary">{tr.publicDesc}</span>
          </div>
          <div className="ml-auto shrink-0">
            <div className={isPublic ? RADIO_SELECTED : RADIO_IDLE}>
              {isPublic && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
          </div>
        </button>

        <button
          type="button"
          className={!isPublic ? CARD_SELECTED : CARD_IDLE}
          data-testid="private-option"
          onClick={() => setSelected(SpaceVisibility.Private)}
        >
          <div className="flex justify-center items-center w-10 h-10 rounded-full bg-primary/15 shrink-0">
            <Lock1 className="w-5 h-5 [&>path]:stroke-primary [&>path]:fill-none [&>rect]:stroke-primary [&>rect]:fill-none [&>circle]:stroke-primary [&>circle]:fill-none" />
          </div>
          <div className="flex flex-col gap-0.5 items-start">
            <span className="text-sm font-semibold text-text-primary">{tr.privateLabel}</span>
            <span className="text-xs text-text-secondary">{tr.privateDesc}</span>
          </div>
          <div className="ml-auto shrink-0">
            <div className={!isPublic ? RADIO_SELECTED : RADIO_IDLE}>
              {!isPublic && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
            </div>
          </div>
        </button>
      </div>

      <div className="flex gap-3 justify-end items-center">
        <Button
          buttonStyle={ButtonStyle.Outline}
          shape={ButtonShape.Square}
          onClick={(e) => {
            onCancel?.(e);
            popup.close();
          }}
        >
          {tr.cancel}
        </Button>
        <Button
          aria-label="Confirm visibility selection"
          className="min-w-[100px]"
          onClick={() => {
            onConfirm(selected);
            popup.close();
          }}
        >
          {tr.confirm}
        </Button>
      </div>
    </div>
  );
}
