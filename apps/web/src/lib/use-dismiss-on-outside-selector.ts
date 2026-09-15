import { useEffect, useRef } from "react";

// app/ratel/src/common/hooks/use_dismiss_on_outside_click.rs (`use_dismiss_on_outside`,
// `use_dismiss_on_outside_click`) + dismiss_outside.js, selector form: a document
// `pointerdown` listener in the CAPTURE phase, installed for the component's
// lifetime. A press whose target sits inside any element matching the
// (comma-separated) selector list is not "outside" — that is how a trigger that
// lives outside its panel keeps owning its own toggle.
//
// The Rust driver also stops listening once nothing matches the selector (the
// component unmounted); here the effect cleanup removes the listener instead.

/** Calls `onDismiss` for every press outside all elements matching `selectors`. */
export function useDismissOnOutsideSelector(selectors: string, onDismiss: () => void): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (!document.querySelector(selectors)) return;
      if (e.target instanceof Element && e.target.closest(selectors)) return;
      latest.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [selectors]);
}
