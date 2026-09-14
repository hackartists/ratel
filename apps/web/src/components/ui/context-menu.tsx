import * as React from "react";
import { useAnimatedOpen } from "@/lib/animated-open";
import { useControlled } from "@/lib/controlled";
import { dataBool, joinClass } from "@/lib/dom";
import { useFocusItem, useFocusState, type FocusState } from "@/lib/focus-state";

// app/ratel/src/common/components/context_menu + dioxus_primitives::context_menu.
// ContextMenu (focusable div[data-state]) > ContextMenuTrigger (div that opens
// the menu at the pointer on right-click) + ContextMenuContent (fixed
// div[role=menu], only in the DOM while open or animating out) >
// ContextMenuItem (div[role=menuitem]).
//
// Behaviour kept from the primitive: the menu closes whenever roving focus is
// cleared (Escape, selecting an item, blurring the menu); while open,
// `body.style.pointerEvents` is "none" and `html.style.overflow` is "hidden",
// and both are written back to "auto" when it closes (including on mount).

interface ContextMenuCtx {
  open: boolean;
  setOpen: (open: boolean) => void;
  disabled: boolean;
  position: [number, number];
  setPosition: (position: [number, number]) => void;
  focus: FocusState;
}

const ContextMenuContext = React.createContext<ContextMenuCtx | null>(null);

function useContextMenuCtx(): ContextMenuCtx {
  const ctx = React.useContext(ContextMenuContext);
  if (!ctx) throw new Error("ContextMenu parts must be used inside <ContextMenu>");
  return ctx;
}

function setPagePointerEventsDisabled(disabled: boolean): void {
  document.body.style.pointerEvents = disabled ? "none" : "auto";
  document.documentElement.style.overflow = disabled ? "hidden" : "auto";
}

export interface ContextMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  /** Controlled open state; leave undefined for uncontrolled. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  rovingLoop?: boolean;
}

export function ContextMenu({
  disabled = false,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  rovingLoop = true,
  onKeyDown,
  children,
  ...props
}: ContextMenuProps) {
  const [open, setOpen] = useControlled(openProp, defaultOpen, onOpenChange);
  const [position, setPosition] = React.useState<[number, number]>([0, 0]);
  const focus = useFocusState(rovingLoop);
  const openRef = React.useRef(open);
  openRef.current = open;

  // Follow roving focus: any focus write re-syncs `open` with "an item is focused".
  React.useEffect(() => {
    const focused = focus.anyFocused();
    if (openRef.current !== focused) setOpen(focused);
  }, [focus, setOpen]);

  React.useEffect(() => {
    setPagePointerEventsDisabled(open);
  }, [open]);
  React.useEffect(
    () => () => {
      if (openRef.current) setPagePointerEventsDisabled(false);
    },
    [],
  );

  const ctx = React.useMemo(
    () => ({ open, setOpen, disabled, position, setPosition, focus }),
    [open, setOpen, disabled, position, focus],
  );

  return (
    <ContextMenuContext.Provider value={ctx}>
      <div
        tabIndex={0}
        onKeyDown={(e) => {
          if (open && e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
            focus.blur();
          }
          onKeyDown?.(e);
        }}
        data-state={open ? "open" : "closed"}
        data-disabled={dataBool(disabled)}
        {...props}
      >
        {children}
      </div>
    </ContextMenuContext.Provider>
  );
}

export function ContextMenuTrigger({ onContextMenu, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useContextMenuCtx();
  return (
    <div
      onContextMenu={(e) => {
        if (!ctx.disabled) {
          ctx.setPosition([Math.trunc(e.clientX), Math.trunc(e.clientY)]);
          ctx.setOpen(true);
          e.preventDefault();
        }
        onContextMenu?.(e);
      }}
      role="button"
      aria-haspopup="menu"
      aria-expanded={ctx.open}
      {...props}
    />
  );
}

export function ContextMenuContent({ id, className, style, onKeyDown, onBlur, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const ctx = useContextMenuCtx();
  const { focus, open } = ctx;
  const [x, y] = ctx.position;
  const generatedId = React.useId();
  const contentId = id ?? generatedId;
  const menu = React.useRef<HTMLDivElement | null>(null);
  const openRef = React.useRef(open);
  openRef.current = open;
  const isFocused = () => openRef.current && !focus.anyFocused();

  // Open with no item focused: focus the menu itself to capture keys.
  React.useEffect(() => {
    if (open && !focus.anyFocused()) menu.current?.focus();
  }, [open, focus]);

  const render = useAnimatedOpen(contentId, open);
  if (!render) return null;

  return (
    <div
      ref={menu}
      id={contentId}
      role="menu"
      aria-orientation="vertical"
      style={{ position: "fixed", left: `${x}px`, top: `${y}px`, pointerEvents: open ? "auto" : undefined, ...style }}
      tabIndex={open && !focus.anyFocused() ? 0 : -1}
      data-state={open ? "open" : "closed"}
      onKeyDown={(e) => {
        switch (e.key) {
          case "Escape":
            focus.blur();
            break;
          case "ArrowDown":
            focus.focusNext();
            break;
          case "ArrowUp":
            if (open) focus.focusPrev();
            break;
          case "Home":
            focus.focusFirst();
            break;
          case "End":
            focus.focusLast();
            break;
          default:
            onKeyDown?.(e);
            return;
        }
        e.preventDefault();
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        // Dioxus `onblur` doesn't bubble; React's does.
        if (e.target === e.currentTarget && isFocused()) focus.blur();
        onBlur?.(e);
      }}
      {...props}
      className={joinClass("context-menu-content", className)}
    >
      {children}
    </div>
  );
}

export interface ContextMenuItemProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  disabled?: boolean;
  value: string;
  /** Keyboard focus order. */
  index: number;
  onSelect?: (value: string) => void;
}

export function ContextMenuItem({
  disabled = false,
  value,
  index,
  onSelect,
  className,
  onPointerDown,
  onKeyDown,
  onBlur,
  children,
  ...props
}: ContextMenuItemProps) {
  const ctx = useContextMenuCtx();
  const { focus } = ctx;
  const isDisabled = disabled || ctx.disabled;
  const ref = useFocusItem<HTMLDivElement>(focus, index);

  return (
    <div
      ref={ref}
      role="menuitem"
      tabIndex={focus.isFocused(index) ? 0 : -1}
      onPointerDown={(e) => {
        if (!isDisabled) {
          onSelect?.(value);
          focus.blur();
          e.preventDefault();
          e.stopPropagation();
        }
        onPointerDown?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          if (!isDisabled) {
            onSelect?.(value);
            focus.blur();
          }
          e.preventDefault();
          e.stopPropagation();
        }
        onKeyDown?.(e);
      }}
      onBlur={(e) => {
        if (e.target === e.currentTarget && focus.isFocused(index)) focus.blur();
        onBlur?.(e);
      }}
      aria-disabled={dataBool(isDisabled)}
      data-disabled={dataBool(isDisabled)}
      {...props}
      className={joinClass("context-menu-item", className)}
    >
      {children}
    </div>
  );
}
