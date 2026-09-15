import { useEffect, useRef, type RefObject } from "react";

// app/ratel/src/common/hooks/use_dismiss_on_outside_click.rs (+ dismiss_outside.js):
// a document `pointerdown` listener in the CAPTURE phase, installed for the
// component's lifetime. A press inside the root (including on the trigger)
// is never "outside", so the trigger's own handler owns the toggle. Capture
// phase means an inner `stopPropagation()` can't swallow the dismissal.

/**
 * Calls `onDismiss` for every press that starts outside `root`. `onDismiss`
 * may change between renders; the listener always calls the latest one.
 */
export function useDismissOnOutside(root: RefObject<Element | null>, onDismiss: () => void): void {
  const latest = useRef(onDismiss);
  latest.current = onDismiss;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = root.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      latest.current();
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [root]);
}

/** The `bool` form: closes `open` on an outside press (no state write when already closed). */
export function useDismissOnOutsideClick(
  root: RefObject<Element | null>,
  open: boolean,
  setOpen: (open: boolean) => void,
): void {
  useDismissOnOutside(root, () => {
    if (open) setOpen(false);
  });
}
