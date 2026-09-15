import * as React from "react";
import { useControlled } from "@/lib/controlled";
import { dataBool, joinClass } from "@/lib/dom";
import { useFocusItem, useFocusState, type FocusState } from "@/lib/focus-state";

// app/ratel/src/common/components/tabs + dioxus_primitives::tabs.
// Tabs (div[data-variant][data-orientation]) > TabList (div[role=tablist]) >
// TabTrigger (button[role=tab]); TabContent (div[role=tabpanel], `hidden`
// unless its value is active). Arrow keys move roving focus between triggers.
//
// Class strings are the wrapper's verbatim: Tabs is `{class} tabs` and
// TabContent is `{class} tabs-content tabs-content-themed` (both keep the
// leading space when no class is given). The TabTrigger wrapper drops the
// caller's class, so it isn't accepted.

export const TabsVariant = { Default: "default", Ghost: "ghost" } as const;
export type TabsVariant = (typeof TabsVariant)[keyof typeof TabsVariant];

interface TabsCtx {
  value: string;
  setValue: (value: string) => void;
  disabled: boolean;
  horizontal: boolean;
  rovingLoop: boolean;
  focus: FocusState;
  tabContentIds: string[];
  setTabContentId: (index: number, id: string) => void;
}

const TabsContext = React.createContext<TabsCtx | null>(null);

function useTabsCtx(): TabsCtx {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("Tabs parts must be used inside <Tabs>");
  return ctx;
}

export interface TabsProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "defaultValue"> {
  /** Controlled active tab; leave undefined for uncontrolled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  horizontal?: boolean;
  rovingLoop?: boolean;
  variant?: TabsVariant;
}

export function Tabs({
  className = "",
  value: valueProp,
  defaultValue = "",
  onValueChange,
  disabled = false,
  horizontal = false,
  rovingLoop = true,
  variant = TabsVariant.Default,
  onBlur,
  children,
  ...props
}: TabsProps) {
  const [value, setValue] = useControlled(valueProp, defaultValue, onValueChange);
  const focus = useFocusState(rovingLoop);
  const [tabContentIds, setTabContentIds] = React.useState<string[]>([]);
  const setTabContentId = React.useCallback((index: number, id: string) => {
    setTabContentIds((ids) => {
      if (ids[index] === id) return ids;
      const next = [...ids];
      while (next.length <= index) next.push("");
      next[index] = id;
      return next;
    });
  }, []);

  const ctx = React.useMemo(
    () => ({ value, setValue, disabled, horizontal, rovingLoop, focus, tabContentIds, setTabContentId }),
    [value, setValue, disabled, horizontal, rovingLoop, focus, tabContentIds, setTabContentId],
  );

  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-orientation={horizontal ? "horizontal" : "vertical"}
        data-disabled={dataBool(disabled)}
        onBlur={(e) => {
          // Dioxus `onfocusout`; React's onBlur bubbles the same way.
          focus.blur();
          onBlur?.(e);
        }}
        {...props}
        className={`${className} tabs`}
        data-variant={variant}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div role="tablist" {...props} className={joinClass("tabs-list", className)} />;
}

export interface TabTriggerProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "className"> {
  value: string;
  /** Keyboard focus order. */
  index: number;
  disabled?: boolean;
}

export function TabTrigger({ value, index, disabled = false, id, onClick, onFocus, onKeyDown, children, ...props }: TabTriggerProps) {
  const ctx = useTabsCtx();
  const { focus } = ctx;
  const selected = ctx.value === value;
  const ref = useFocusItem<HTMLButtonElement>(focus, index);
  const tabIndex = !ctx.rovingLoop || selected || focus.isFocused(index) ? 0 : -1;
  const isDisabled = ctx.disabled || disabled;

  return (
    <button
      ref={ref}
      role="tab"
      id={id}
      className="tabs-trigger"
      tabIndex={tabIndex}
      type="button"
      aria-selected={selected}
      aria-controls={ctx.tabContentIds[index] || undefined}
      data-state={selected ? "active" : "inactive"}
      data-disabled={dataBool(isDisabled)}
      disabled={isDisabled}
      onClick={(e) => {
        if (!selected) ctx.setValue(value);
        onClick?.(e);
      }}
      onFocus={(e) => {
        focus.setFocus(index);
        onFocus?.(e);
      }}
      onKeyDown={(e) => {
        let handled = true;
        if (e.key === "ArrowUp" && !ctx.horizontal) focus.focusPrev();
        else if (e.key === "ArrowDown" && !ctx.horizontal) focus.focusNext();
        else if (e.key === "ArrowLeft" && ctx.horizontal) focus.focusPrev();
        else if (e.key === "ArrowRight" && ctx.horizontal) focus.focusNext();
        else if (e.key === "Home") focus.focusFirst();
        else if (e.key === "End") focus.focusLast();
        else handled = false;
        if (handled) e.preventDefault();
        onKeyDown?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  index: number;
}

export function TabContent({ value, index, id, className, children, ...props }: TabContentProps) {
  const ctx = useTabsCtx();
  const selected = ctx.value === value;
  const generatedId = React.useId();
  const contentId = id ?? generatedId;
  const { setTabContentId } = ctx;

  React.useEffect(() => {
    setTabContentId(index, contentId);
  }, [index, contentId, setTabContentId]);

  return (
    <div
      role="tabpanel"
      id={contentId}
      className={`${className ?? ""} tabs-content tabs-content-themed`}
      tabIndex={0}
      data-state={selected ? "active" : "inactive"}
      hidden={!selected}
      {...props}
    >
      {children}
    </div>
  );
}
