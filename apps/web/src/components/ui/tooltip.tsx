import * as React from "react";
import { dataBool, joinClass } from "@/lib/dom";

// app/ratel/src/common/components/tooltip + dioxus_primitives::tooltip.
// Tooltip (div, data-state/data-disabled) > TooltipTrigger (focusable div that
// opens on hover/focus, closes on leave/blur/Escape) + TooltipContent
// (role=tooltip, only in the DOM while open or finishing its exit animation).

export const ContentSide = { Top: "top", Right: "right", Bottom: "bottom", Left: "left" } as const;
export type ContentSide = (typeof ContentSide)[keyof typeof ContentSide];

export const ContentAlign = { Start: "start", Center: "center", End: "end" } as const;
export type ContentAlign = (typeof ContentAlign)[keyof typeof ContentAlign];

interface TooltipCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  tooltipId: string;
  setTooltipId: (id: string) => void;
}

const TooltipContext = React.createContext<TooltipCtx | null>(null);

function useTooltipCtx(): TooltipCtx {
  const ctx = React.useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip parts must be used inside <Tooltip>");
  return ctx;
}

export interface TooltipProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Controlled open state; leave undefined for uncontrolled. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
}

export function Tooltip({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  ...props
}: TooltipProps) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultOpen);
  const open = controlledOpen ?? uncontrolled;
  const [tooltipId, setTooltipId] = React.useState("");

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(next);
      onOpenChange?.(next);
    },
    [controlledOpen, onOpenChange],
  );

  const ctx = React.useMemo(
    () => ({ open, setOpen, disabled, tooltipId, setTooltipId }),
    [open, setOpen, disabled, tooltipId],
  );

  return (
    <TooltipContext.Provider value={ctx}>
      <div
        data-state={open ? "open" : "closed"}
        data-disabled={dataBool(disabled)}
        className={joinClass("tooltip", className)}
        {...props}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Render a custom element instead of the div; receives the trigger props. */
  as?: (props: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
}

export function TooltipTrigger({
  as,
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: TooltipTriggerProps) {
  const ctx = useTooltipCtx();
  const triggerProps: React.HTMLAttributes<HTMLDivElement> = {
    tabIndex: 0,
    "aria-describedby": ctx.tooltipId,
    ...props,
    className: joinClass("tooltip-trigger", className),
    onMouseEnter: (e) => {
      if (!ctx.disabled) ctx.setOpen(true);
      onMouseEnter?.(e);
    },
    onMouseLeave: (e) => {
      if (!ctx.disabled) ctx.setOpen(false);
      onMouseLeave?.(e);
    },
    onFocus: (e) => {
      if (!ctx.disabled) ctx.setOpen(true);
      onFocus?.(e);
    },
    onBlur: (e) => {
      if (!ctx.disabled) ctx.setOpen(false);
      onBlur?.(e);
    },
    onKeyDown: (e) => {
      if (e.key === "Escape" && ctx.open) {
        e.preventDefault();
        ctx.setOpen(false);
      }
      onKeyDown?.(e);
    },
  };
  if (as) return <>{as(triggerProps as React.HTMLAttributes<HTMLElement>)}</>;
  return <div {...triggerProps}>{children}</div>;
}

export interface TooltipContentProps extends React.HTMLAttributes<HTMLDivElement> {
  side?: ContentSide;
  align?: ContentAlign;
}

/**
 * dioxus_primitives `use_animated_open`: shows as soon as `open` turns true;
 * on close, keeps the element until its running animations finish.
 */
function useAnimatedOpen(id: string, open: boolean): boolean {
  const [showInDom, setShowInDom] = React.useState(open);
  React.useEffect(() => {
    if (open) {
      setShowInDom(true);
      return;
    }
    let cancelled = false;
    const element = document.getElementById(id);
    const animations = element?.getAnimations?.() ?? [];
    Promise.all(animations.map((a) => a.finished.catch(() => undefined))).then(() => {
      if (!cancelled) setShowInDom(false);
    });
    return () => {
      cancelled = true;
    };
  }, [id, open]);
  return showInDom;
}

export function TooltipContent({
  id: providedId,
  side = ContentSide.Top,
  align = ContentAlign.Center,
  className,
  children,
  ...props
}: TooltipContentProps) {
  const ctx = useTooltipCtx();
  const uniqueId = React.useId();
  const id = providedId ?? uniqueId;
  const { setTooltipId } = ctx;

  React.useEffect(() => {
    setTooltipId(id);
  }, [id, setTooltipId]);

  if (!useAnimatedOpen(id, ctx.open)) return null;
  return (
    <div
      id={id}
      role="tooltip"
      data-state={ctx.open ? "open" : "closed"}
      data-side={side}
      data-align={align}
      className={joinClass("tooltip-content", className)}
      {...props}
    >
      {children}
    </div>
  );
}
