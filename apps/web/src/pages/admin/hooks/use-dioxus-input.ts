import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * An `<input>`/`<textarea>` whose `value` behaves like RSX `value: "{x}"`:
 * the element is only written when the rendered string differs from the
 * previous render, so text the handler rejects (a number field mid-edit, a
 * value that fails to parse) stays in the box instead of being reset the way a
 * React-controlled input would.
 *
 * `onNativeChange` is RSX `onchange` on an input — the native `change` event
 * (commit / blur), which React's `onChange` does not expose.
 *
 *   const input = useDioxusInput<HTMLInputElement>(String(point), (v) => ...);
 *   <input type="number" {...input} />
 *
 * No `defaultValue` is handed to React: on a `<textarea>` React mirrors it
 * into the element's text content on every update, which the Dioxus DOM
 * doesn't have. The value is written through the element property instead.
 */
export function useDioxusInput<E extends HTMLInputElement | HTMLTextAreaElement>(
  value: string,
  onNativeChange?: (value: string) => void,
) {
  const ref = useRef<E>(null);
  const rendered = useRef<string | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && rendered.current !== value) el.value = value;
    rendered.current = value;
  }, [value]);

  const handler = useRef(onNativeChange);
  handler.current = onNativeChange;
  const listens = onNativeChange !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (!el || !listens) return;
    const listener = () => handler.current?.(el.value);
    el.addEventListener("change", listener);
    return () => el.removeEventListener("change", listener);
  }, [listens]);

  return { ref };
}
