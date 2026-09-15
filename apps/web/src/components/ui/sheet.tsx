import * as React from "react";
import { joinClass } from "@/lib/dom";
import {
  DialogContentBase,
  DialogDescriptionBase,
  DialogRootBase,
  DialogTitleBase,
  useDialogCtx,
  type DialogRootBaseProps,
} from "./dialog";

// app/ratel/src/common/components/sheet — a dialog that slides in from a side.
// Sheet (div.sheet-root overlay) > SheetContent (div.sheet[data-side] with the
// close button appended after the children).

export const SheetSide = { Top: "top", Right: "right", Bottom: "bottom", Left: "left" } as const;
export type SheetSide = (typeof SheetSide)[keyof typeof SheetSide];

export function Sheet({ className, ...props }: DialogRootBaseProps) {
  return <DialogRootBase data-slot="sheet-root" {...props} className={joinClass("sheet-root", className)} />;
}

export interface SheetContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: SheetSide;
}

export function SheetContent({ side = SheetSide.Right, className, children, ...props }: SheetContentProps) {
  return (
    <DialogContentBase
      {...props}
      className={className === undefined ? "sheet" : `sheet ${className}`}
      data-slot="sheet-content"
      data-side={side}
    >
      {children}
      <SheetClose className="sheet-close">
        <svg className="sheet-close-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </SheetClose>
    </DialogContentBase>
  );
}

export function SheetHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sheet-header" {...props} className={joinClass("sheet-header", className)} />;
}

export function SheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="sheet-footer" {...props} className={joinClass("sheet-footer", className)} />;
}

export function SheetTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <DialogTitleBase data-slot="sheet-title" {...props} className={joinClass("sheet-title", className)} />;
}

export function SheetDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <DialogDescriptionBase data-slot="sheet-description" {...props} className={joinClass("sheet-description", className)} />
  );
}

export interface SheetCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render a custom element with the close attributes (children are not passed). */
  as?: (attributes: React.ButtonHTMLAttributes<HTMLButtonElement>) => React.ReactNode;
}

export function SheetClose({ as, onClick, children, ...props }: SheetCloseProps) {
  const ctx = useDialogCtx();
  const attributes: React.ButtonHTMLAttributes<HTMLButtonElement> = {
    ...props,
    onClick: (e) => {
      ctx.setOpen(false);
      onClick?.(e);
    },
  };
  if (as) return <>{as(attributes)}</>;
  return <button {...attributes}>{children}</button>;
}
