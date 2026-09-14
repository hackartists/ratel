import * as React from "react";
import { useAnimatedOpen } from "@/lib/animated-open";
import { useControlled } from "@/lib/controlled";
import { joinClass } from "@/lib/dom";
import { useGlobalEscapeListener } from "@/lib/escape-listener";
import { createFocusTrap, type FocusTrap } from "@/lib/focus-trap";
import { ContentAlign, ContentSide } from "./tooltip";

// app/ratel/src/common/components/popover + dioxus_primitives::popover.
// PopoverRoot (div.popover[data-state]) > PopoverTrigger (button.popover-trigger
// that toggles) + PopoverContent (div.popover-content[role=dialog], only in the
// DOM while open or finishing its exit animation; traps focus when modal and
// closes on Escape). Clicking outside does not close it (same as the primitive).

export { ContentAlign, ContentSide };

interface PopoverCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  isModal: boolean;
  labelledBy: string;
  setLabelledBy: (id: string) => void;
}

const PopoverContext = React.createContext<PopoverCtx | null>(null);

function usePopoverCtx(): PopoverCtx {
  const ctx = React.useContext(PopoverContext);
  if (!ctx) throw new Error("Popover parts must be used inside <PopoverRoot>");
  return ctx;
}

export interface PopoverRootProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state; leave undefined for uncontrolled. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Traps focus inside the content while open (default true). */
  isModal?: boolean;
}

export function PopoverRoot({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  isModal = true,
  className,
  children,
  ...props
}: PopoverRootProps) {
  const generated = React.useId();
  const [labelledBy, setLabelledBy] = React.useState(generated);
  const [open, setOpen] = useControlled(controlledOpen, defaultOpen, onOpenChange);
  const ctx = React.useMemo(
    () => ({ open, setOpen, isModal, labelledBy, setLabelledBy }),
    [open, setOpen, isModal, labelledBy],
  );
  return (
    <PopoverContext.Provider value={ctx}>
      <div data-state={open ? "open" : "closed"} className={joinClass("popover", className)} {...props}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export type PopoverTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function PopoverTrigger({ className, id, onClick, children, ...props }: PopoverTriggerProps) {
  const ctx = usePopoverCtx();
  const { setLabelledBy } = ctx;
  React.useEffect(() => {
    if (id !== undefined) setLabelledBy(id);
  }, [id, setLabelledBy]);
  return (
    <button
      id={id ?? ctx.labelledBy}
      type="button"
      className={joinClass("popover-trigger", className)}
      onClick={(e) => {
        // Prevent the click from propagating to an overlay.
        e.stopPropagation();
        ctx.setOpen(!ctx.open);
        onClick?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: ContentSide;
  align?: ContentAlign;
}

export function PopoverContent({
  side = ContentSide.Bottom,
  align = ContentAlign.Center,
  id: idProp,
  className,
  children,
  ...props
}: PopoverContentProps) {
  const ctx = usePopoverCtx();
  const generated = React.useId();
  const id = idProp ?? generated;
  const render = useAnimatedOpen(id, ctx.open);

  // Focus trap while a modal popover is open (primitive `FOCUS_TRAP_JS`).
  const trap = React.useRef<FocusTrap | null>(null);
  React.useEffect(() => {
    if (!render || !ctx.isModal) return;
    const element = document.getElementById(id);
    if (ctx.open && element) trap.current = createFocusTrap(element);
    return () => {
      trap.current?.remove();
      trap.current = null;
    };
  }, [render, ctx.isModal, ctx.open, id]);

  if (!render) return null;
  return (
    <PopoverContentRendered id={id} side={side} align={align} className={className} {...props}>
      {children}
    </PopoverContentRendered>
  );
}

function PopoverContentRendered({
  id,
  side,
  align,
  className,
  children,
  ...props
}: PopoverContentProps & { id: string; side: ContentSide; align: ContentAlign }) {
  const ctx = usePopoverCtx();
  const { setOpen } = ctx;
  useGlobalEscapeListener(() => setOpen(false));
  return (
    <div
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ctx.labelledBy}
      aria-hidden={ctx.open ? undefined : "true"}
      className={joinClass("popover-content", className)}
      data-state={ctx.open ? "open" : "closed"}
      data-side={side}
      data-align={align}
      {...props}
    >
      {children}
    </div>
  );
}
