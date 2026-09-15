import * as React from "react";
import { X } from "@/components/icons/lucide";
import { CrossAxisAlign, MainAxisAlign } from "./layout";
import { Row } from "./row";

// app/ratel/src/common/components/bottom_sheet — mobile panel sliding up from
// the bottom. Renders nothing when closed; when open, the backdrop and the
// panel are siblings (a fragment, no wrapper). `main.css` animates
// `.bottom-sheet-panel`.

export interface BottomSheetProps {
  open: boolean;
  onClose: React.MouseEventHandler<HTMLDivElement>;
  className?: string;
  children?: React.ReactNode;
}

export function BottomSheet({ open, onClose, className = "", children }: BottomSheetProps) {
  if (!open) return null;
  return (
    <>
      <div className="bottom-sheet-backdrop" onClick={onClose} />
      <div className={`bottom-sheet-panel ${className}`}>{children}</div>
    </>
  );
}

export interface BottomSheetHeaderProps {
  title?: string;
  showClose?: boolean;
  onClose?: React.MouseEventHandler<HTMLButtonElement>;
}

/** Title (when non-empty) and a close button (when `showClose` and `onClose` are set). */
export function BottomSheetHeader({ title = "", showClose = false, onClose }: BottomSheetHeaderProps) {
  return (
    <Row className="w-full" mainAxisAlign={MainAxisAlign.Between} crossAxisAlign={CrossAxisAlign.Center}>
      {title !== "" && <span className="text-base font-semibold text-foreground">{title}</span>}
      {showClose && onClose && (
        <button className="p-1 rounded-md cursor-pointer hover:bg-card-bg transition-colors" onClick={onClose}>
          <X className="w-5 h-5 text-foreground-muted" />
        </button>
      )}
    </Row>
  );
}
