import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

// Dioxus form semantics the tabs rely on:
//   - `value:` / `checked:` are written to the DOM property only when the
//     rendered value changes, so what the user typed (or ticked) stays until
//     the server echo re-renders a different value;
//   - `onchange:` is the native `change` event (commit on blur / Enter /
//     toggle), not React's per-keystroke `onChange`.

/** Keeps `el[prop]` in step with `value`, writing only when `value` changes. */
export function useDomProp<E extends HTMLElement, K extends keyof E>(ref: RefObject<E | null>, prop: K, value: E[K]) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el[prop] !== value) el[prop] = value;
  }, [ref, prop, value]);
}

/** Native `change` listener; always calls the latest handler. */
export function useNativeChange<E extends HTMLElement>(ref: RefObject<E | null>, handler: (el: E) => void) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const listener = () => latest.current(el);
    el.addEventListener("change", listener);
    return () => el.removeEventListener("change", listener);
  }, [ref]);
}
