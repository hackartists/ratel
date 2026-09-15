// app/ratel/src/common/hooks/use_scroll_lock.rs — reference-counted body
// scroll lock shared by every overlay.
import { useEffect } from "react";

interface Snapshot {
  scrollY: number;
  previousStyle: string | null;
}

let count = 0;
let snapshot: Snapshot | null = null;

function lockPageScroll(): void {
  const body = document.body;
  if (!body) return;
  count += 1;
  if (count !== 1) return;
  const scrollY = window.scrollY;
  snapshot = { scrollY, previousStyle: body.getAttribute("style") };
  // `position:fixed` resolves against the full viewport, bypassing `:root`'s
  // safe-area padding, so pin `top` to the inset and size to the padded area.
  // `var(--vv-offset-top)` counters iOS's keyboard-avoidance shift. This MUST
  // use `top`, never `transform`: a transform on body becomes the containing
  // block of fixed descendants and would drag the modal popup down with it.
  body.setAttribute(
    "style",
    `position:fixed;top:calc(env(safe-area-inset-top) - ${scrollY}px + var(--vv-offset-top, 0px));left:env(safe-area-inset-left);right:env(safe-area-inset-right);width:auto;height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow:hidden;overscroll-behavior:none;`,
  );
}

function unlockPageScroll(): void {
  const body = document.body;
  if (!body || count === 0) return;
  count -= 1;
  if (count !== 0 || !snapshot) return;
  const { scrollY, previousStyle } = snapshot;
  snapshot = null;
  if (previousStyle !== null) body.setAttribute("style", previousStyle);
  else body.removeAttribute("style");
  window.scrollTo(0, scrollY);
}

/** Locks page scrolling while `lock` is true; releases on change or unmount. */
export function useScrollLock(lock: boolean): void {
  useEffect(() => {
    if (!lock) return;
    lockPageScroll();
    return unlockPageScroll;
  }, [lock]);
}
