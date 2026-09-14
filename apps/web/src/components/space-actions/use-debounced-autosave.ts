import { useEffect, useRef } from "react";

// The Rust creator cards bump a `*_version` signal on every keystroke and run
// `use_effect` → `sleep(3s)` → "still the latest version and still unsaved?"
// → save. `schedule()` is that bump; `save` is read at fire time so it always
// sees the latest state.
export function useDebouncedAutosave(save: () => void, delayMs = 3000): () => void {
  const latest = useRef(save);
  latest.current = save;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current();
    }, delayMs);
  };
}
