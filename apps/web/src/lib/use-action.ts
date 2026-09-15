import { useCallback, useRef, useState } from "react";

// Dioxus `use_action` as the ported controllers use it: `call(...)` starts the
// async body without awaiting it, and `pending` is true while any call is in
// flight. Bodies handle their own errors (toasts), like the Rust actions that
// always return `Ok(())`.

export interface Action<A extends unknown[]> {
  call: (...args: A) => void;
  pending: boolean;
}

export function useAction<A extends unknown[]>(body: (...args: A) => Promise<void>): Action<A> {
  const [inFlight, setInFlight] = useState(0);
  const latest = useRef(body);
  latest.current = body;

  const call = useCallback((...args: A) => {
    setInFlight((n) => n + 1);
    latest
      .current(...args)
      .catch((err: unknown) => console.error(err))
      .finally(() => setInFlight((n) => n - 1));
  }, []);

  return { call, pending: inFlight > 0 };
}
