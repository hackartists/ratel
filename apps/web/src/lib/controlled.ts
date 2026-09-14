// dioxus_primitives `use_controlled` (primitives/src/lib.rs): a value that is
// controlled when `prop` is defined and uncontrolled (seeded from `defaultValue`)
// otherwise. The setter always updates the internal value and fires `onChange`.
import { useCallback, useRef, useState } from "react";

export function useControlled<T>(
  prop: T | undefined,
  defaultValue: T,
  onChange?: (value: T) => void,
): [T, (value: T) => void] {
  const [internal, setInternal] = useState<T>(prop === undefined ? defaultValue : prop);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const setValue = useCallback((value: T) => {
    setInternal(value);
    onChangeRef.current?.(value);
  }, []);
  return [prop === undefined ? internal : prop, setValue];
}
