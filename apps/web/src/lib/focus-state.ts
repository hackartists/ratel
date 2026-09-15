// dioxus_primitives `focus.rs`: roving focus shared by menus, tabs and selects.
// Items register themselves (`itemCount`), the provider tracks the current and
// most recent focus index, and the item whose index is focused grabs DOM focus.
//
// Dioxus signal writes notify even when the value is unchanged, and effects in
// the primitives rely on that (e.g. a context menu closes when `blur()` runs
// with nothing focused), so every focus write bumps `version`.
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

export interface FocusState {
  /** Increments on every focus write; use as an effect dependency. */
  version: number;
  itemCount(): number;
  currentFocus(): number | null;
  recentFocus(): number | null;
  anyFocused(): boolean;
  isFocused(index: number): boolean;
  setFocus(index: number | null): void;
  focusNext(): void;
  focusPrev(): void;
  focusFirst(): void;
  focusLast(): void;
  blur(): void;
  addItem(): void;
  removeItem(index: number): void;
}

export function useFocusState(rovingLoop: boolean): FocusState {
  const state = useRef({ itemCount: 0, recent: null as number | null, current: null as number | null });
  const loop = useRef(rovingLoop);
  loop.current = rovingLoop;
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  const api = useMemo(() => {
    const s = state.current;
    const setFocus = (index: number | null) => {
      if (index !== null) s.recent = index;
      s.current = index;
      bump();
    };
    return {
      itemCount: () => s.itemCount,
      currentFocus: () => s.current,
      recentFocus: () => s.recent,
      anyFocused: () => s.current !== null,
      isFocused: (index: number) => s.current === index,
      setFocus,
      focusNext: () => {
        let next = s.recent === null ? 0 : s.recent + 1;
        if (next >= s.itemCount) next = loop.current ? 0 : Math.max(s.itemCount - 1, 0);
        setFocus(next);
      },
      focusPrev: () => {
        let next = s.recent === null ? 0 : Math.max(s.recent - 1, 0);
        if ((s.recent ?? 0) === 0 && loop.current) next = Math.max(s.itemCount - 1, 0);
        setFocus(next);
      },
      focusFirst: () => setFocus(0),
      focusLast: () => setFocus(Math.max(s.itemCount - 1, 0)),
      blur: () => setFocus(null),
      // `item_count` is a separate signal in Dioxus: effects that follow the
      // focus (e.g. the context menu's open sync) must not re-run on it.
      addItem: () => {
        s.itemCount += 1;
      },
      removeItem: (index: number) => {
        s.itemCount -= 1;
        if (s.current === index) setFocus(null);
      },
    };
  }, []);

  return useMemo(() => ({ ...api, version }), [api, version]);
}

/**
 * `use_focus_controlled_item`: registers the item while enabled and moves DOM
 * focus to it when its index becomes the focused one. Returns the ref callback.
 */
export function useFocusItem<E extends HTMLElement>(
  focus: FocusState,
  index: number,
  disabled = false,
): (element: E | null) => void {
  const element = useRef<E | null>(null);
  const { addItem, removeItem } = focus;
  useEffect(() => {
    if (disabled) return;
    addItem();
    return () => removeItem(index);
  }, [addItem, removeItem, index, disabled]);
  useEffect(() => {
    if (!disabled && focus.isFocused(index)) element.current?.focus();
  }, [focus, index, disabled]);
  return useCallback((el: E | null) => {
    element.current = el;
  }, []);
}
