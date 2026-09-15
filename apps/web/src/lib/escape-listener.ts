// dioxus_primitives `use_global_escape_listener` (primitives/src/lib.rs): a
// document-level Escape listener where only the most recently mounted
// listener fires, so nested dialogs close one at a time.
import { useEffect, useId, useRef } from "react";

const stack: string[] = [];

export function useGlobalEscapeListener(onEscape: () => void): void {
  const id = useId();
  const handler = useRef(onEscape);
  handler.current = onEscape;
  useEffect(() => {
    stack.push(id);
    const listener = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // The Dioxus driver prevents the default for every Escape press.
      event.preventDefault();
      if (stack[stack.length - 1] === id) handler.current();
    };
    document.addEventListener("keydown", listener);
    return () => {
      document.removeEventListener("keydown", listener);
      const at = stack.lastIndexOf(id);
      if (at >= 0) stack.splice(at, 1);
    };
  }, [id]);
}
